import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PassengerConfirmationModal from './components/PassengerConfirmationModal'
import PotholeMapPreview from './components/PotholeMapPreview'
import { buildArcGisAddsPayload, isSuccessfulArcGisAddResponse } from './utils/arcgis'
import {
  persistProfile,
  PROFILE_REMEMBER_DURATION_DAYS,
  readStoredProfile,
} from './utils/profileStorage'
import { updatePotholePosition } from './utils/potholes'
import {
  MOVEMENT_SPEED_THRESHOLD_KMH,
  MOVEMENT_SPEED_THRESHOLD_MPS,
  deriveMovementState,
  movementStateLabel,
  resolveMovementSpeed,
} from './utils/movement'

const ARCGIS_ENDPOINT =
  'https://services1.arcgis.com/niuNnVx0H92jOc5F/arcgis/rest/services/NidDePouleSignale/FeatureServer/0/applyEdits'
const REAL_SUBMISSION_ENABLED = import.meta.env.VITE_ALLOW_REAL_SUBMISSION === 'true'
const SAFETY_CONSENT_STORAGE_KEY = 'safetyConsent.v1'
const TEST_POINT_BASE = { latitude: 46.8123, longitude: -71.1776 }
const INITIAL_PROFILE = { firstName: '', lastName: '', email: '' }

const GPS_WARMUP_OPTIONS = { enableHighAccuracy: true, timeout: 10000 }
const LOG_CAPTURE_OPTIONS = { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
const WATCH_OPTIONS = { enableHighAccuracy: true, maximumAge: 1500, timeout: 12000 }

const ROLE_OPTIONS = [
  {
    value: 'passenger',
    title: 'Je suis passager',
    description: "Le telephone est entre les mains d'un passager pendant le trajet.",
    tone: 'safe',
  },
  {
    value: 'stationary',
    title: "Je suis a l'arret",
    description: "Le vehicule est immobilise ou le signalement se fait a pied.",
    tone: 'neutral',
  },
  {
    value: 'driver',
    title: 'Je conduis',
    description: "L'application reste bloquee tant que la conduite est en cours.",
    tone: 'warning',
  },
]

const ROLE_LABELS = {
  passenger: 'Passager',
  stationary: "A l'arret",
  driver: 'Conducteur',
}

function StatusBadge({ tone = 'neutral', children }) {
  return <span className={`status-badge ${tone}`}>{children}</span>
}

function ScreenHeader({ title, copy }) {
  return (
    <header className="screen-header">
      <p className="eyebrow">Ville de Levis (Quebec)</p>
      <h1>{title}</h1>
      <p className="screen-copy">{copy}</p>
    </header>
  )
}

function AdvisoryNotice({ title, children }) {
  return (
    <section className="surface-card tone-warning">
      <p className="section-kicker">Avis important</p>
      <h2>{title}</h2>
      {children}
    </section>
  )
}

function formatDisplayName(profile) {
  return [profile?.firstName?.trim(), profile?.lastName?.trim()].filter(Boolean).join(' ')
}

function hasCompleteProfile(profile) {
  return Boolean(profile?.firstName?.trim() && profile?.lastName?.trim() && profile?.email?.trim())
}

function readSavedSession() {
  try {
    const rawSession = sessionStorage.getItem(SAFETY_CONSENT_STORAGE_KEY)
    if (!rawSession) {
      return null
    }

    const parsedSession = JSON.parse(rawSession)
    if (!parsedSession?.acceptedAt || !parsedSession?.role) {
      return null
    }

    return parsedSession
  } catch {
    return null
  }
}

function formatConsentTimestamp(value) {
  if (!value) {
    return 'Session non confirmee'
  }

  return new Date(value).toLocaleString('fr-CA', {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  })
}

function gpsStatusLabel(status) {
  if (status === 'ready') {
    return 'GPS pret'
  }
  if (status === 'unavailable') {
    return 'GPS limite'
  }
  return 'GPS initialisation'
}

function pointLabel(count) {
  return count > 1 ? `${count} points` : `${count} point`
}

function potholeLabel(count) {
  return count > 1 ? `${count} nids-de-poule` : `${count} nid-de-poule`
}

function modeSummaryLabel(isSafeMode) {
  return isSafeMode ? 'Mode simulation' : 'Mode reel'
}

function formatPointCoordinates(point) {
  return `Lat: ${point.latitude.toFixed(4)}, Long: ${point.longitude.toFixed(4)}`
}

function validateProfile(profile) {
  const nextErrors = {}

  if (!profile?.firstName?.trim()) {
    nextErrors.firstName = 'Le prenom est requis.'
  }

  if (!profile?.lastName?.trim()) {
    nextErrors.lastName = 'Le nom de famille est requis.'
  }

  if (!profile?.email?.trim()) {
    nextErrors.email = 'Le courriel est requis.'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
    nextErrors.email = 'Veuillez entrer un courriel valide.'
  }

  return nextErrors
}

function App() {
  const [screen, setScreen] = useState('entry')
  const [sessionRole, setSessionRole] = useState(null)
  const [consentTimestamp, setConsentTimestamp] = useState(null)

  const [userSettings, setUserSettings] = useState(null)
  const [profileDraft, setProfileDraft] = useState(INITIAL_PROFILE)
  const [profileErrors, setProfileErrors] = useState({})
  const [isEditingProfile, setIsEditingProfile] = useState(true)
  const [rememberProfile, setRememberProfile] = useState(false)

  const [isTraveling, setIsTraveling] = useState(false)
  const [potholes, setPotholes] = useState([])
  const [selectedIndexes, setSelectedIndexes] = useState([])
  const [simulationMode, setSimulationMode] = useState(true)
  const [showSimulationTools, setShowSimulationTools] = useState(false)
  const [reviewExpanded, setReviewExpanded] = useState(false)
  const [resultState, setResultState] = useState(null)
  const [editingPointIndex, setEditingPointIndex] = useState(null)
  const [editingDraftPosition, setEditingDraftPosition] = useState(null)

  const [gpsStatus, setGpsStatus] = useState('initializing')
  const [feedback, setFeedback] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLogging, setIsLogging] = useState(false)

  const [movementState, setMovementState] = useState('stationary')
  const [passengerConfirmed, setPassengerConfirmed] = useState(false)
  const [watchId, setWatchId] = useState(null)
  const [showPassengerModal, setShowPassengerModal] = useState(false)

  const gpsInitializedRef = useRef(false)
  const movementSampleRef = useRef(null)
  const passengerConfirmedRef = useRef(false)
  const movementNotifiedRef = useRef(false)
  const firstNameInputRef = useRef(null)
  const lastNameInputRef = useRef(null)
  const emailInputRef = useRef(null)

  const isSafeMode = simulationMode || !REAL_SUBMISSION_ENABLED
  const hasAcceptedSession = sessionRole === 'passenger' || sessionRole === 'stationary'
  const selectedCount = selectedIndexes.length
  const selectedPotholes = useMemo(
    () => potholes.filter((_, index) => selectedIndexes.includes(index)),
    [potholes, selectedIndexes]
  )
  const selectedMapPoints = useMemo(
    () =>
      potholes.flatMap((pothole, index) =>
        selectedIndexes.includes(index)
          ? [
              {
                ...pothole,
                latitude:
                  editingPointIndex === index && editingDraftPosition
                    ? editingDraftPosition.latitude
                    : pothole.latitude,
                longitude:
                  editingPointIndex === index && editingDraftPosition
                    ? editingDraftPosition.longitude
                    : pothole.longitude,
                label: `Point ${index + 1}`,
                shortLabel: String(index + 1),
                sourceIndex: index,
              },
            ]
          : []
      ),
    [editingDraftPosition, editingPointIndex, potholes, selectedIndexes]
  )
  const editingPointLabel = editingPointIndex !== null ? `Point ${editingPointIndex + 1}` : null
  const isMovementLocked = movementState === 'moving'
  const canLog = isTraveling && !isMovementLocked

  useEffect(() => {
    const savedProfile = readStoredProfile()
    if (savedProfile) {
      setUserSettings(savedProfile.profile)
      setProfileDraft(savedProfile.profile)
      setRememberProfile(savedProfile.rememberProfile)
      setIsEditingProfile(false)
    }

    const savedSession = readSavedSession()
    if (!savedSession) {
      return
    }

    setSessionRole(savedSession.role)
    setConsentTimestamp(savedSession.acceptedAt)
    if (savedSession.role === 'passenger' || savedSession.role === 'stationary') {
      setScreen('setup')
    }
  }, [])

  useEffect(() => {
    passengerConfirmedRef.current = passengerConfirmed
  }, [passengerConfirmed])

  useEffect(() => {
    if (!feedback) {
      return undefined
    }

    const timeoutId = window.setTimeout(
      () => setFeedback((current) => (current === feedback ? null : current)),
      feedback.type === 'error' ? 5200 : 3200
    )

    return () => window.clearTimeout(timeoutId)
  }, [feedback])

  useEffect(() => {
    if (gpsInitializedRef.current || !hasAcceptedSession) {
      return undefined
    }

    gpsInitializedRef.current = true

    if (!navigator.geolocation) {
      setGpsStatus('unavailable')
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setGpsStatus('unavailable')
      setFeedback({
        type: 'warning',
        text: 'Initialisation GPS lente. Le suivi continuera en mode degrade.',
      })
    }, 15000)

    navigator.geolocation.getCurrentPosition(
      () => {
        window.clearTimeout(timeoutId)
        setGpsStatus('ready')
      },
      () => {
        window.clearTimeout(timeoutId)
        setGpsStatus('unavailable')
      },
      GPS_WARMUP_OPTIONS
    )

    return () => window.clearTimeout(timeoutId)
  }, [hasAcceptedSession])

  useEffect(() => {
    if (!isTraveling) {
      setSelectedIndexes(potholes.map((_, index) => index))
    }
  }, [isTraveling, potholes])

  useEffect(() => {
    if (editingPointIndex === null) {
      return
    }

    if (
      screen !== 'review' ||
      !selectedIndexes.includes(editingPointIndex) ||
      !potholes[editingPointIndex]
    ) {
      setEditingPointIndex(null)
      setEditingDraftPosition(null)
    }
  }, [editingPointIndex, potholes, screen, selectedIndexes])

  useEffect(() => {
    if (!isTraveling || !navigator.geolocation) {
      return undefined
    }

    const handlePosition = (position) => {
      const timestamp = position.timestamp || Date.now()
      const previousSample = movementSampleRef.current

      const resolution = resolveMovementSpeed({
        coords: position.coords,
        timestamp,
        previousSample,
      })

      movementSampleRef.current = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        timestamp,
      }

      if (resolution.speedMps === null) {
        return
      }

      const moving = resolution.speedMps >= MOVEMENT_SPEED_THRESHOLD_MPS
      const nextMovementState = deriveMovementState({
        moving,
        passengerConfirmed: passengerConfirmedRef.current,
      })

      setMovementState(nextMovementState)

      if (moving && !passengerConfirmedRef.current) {
        setShowSimulationTools(false)
        setShowPassengerModal(true)
        if (!movementNotifiedRef.current) {
          setFeedback({
            type: 'warning',
            text: `Mouvement detecte (>= ${MOVEMENT_SPEED_THRESHOLD_KMH} km/h). Confirmation passager requise.`,
          })
          movementNotifiedRef.current = true
        }
      }

      if (!moving) {
        movementNotifiedRef.current = false
      }
    }

    const handleWatchError = (error) => {
      setGpsStatus('unavailable')
      setFeedback({
        type: 'warning',
        text: `Suivi GPS limite: ${error.message}`,
      })
    }

    const id = navigator.geolocation.watchPosition(handlePosition, handleWatchError, WATCH_OPTIONS)
    setWatchId(id)

    return () => {
      navigator.geolocation.clearWatch(id)
      setWatchId((current) => (current === id ? null : current))
    }
  }, [isTraveling])

  const resetPointEditing = useCallback(() => {
    setEditingPointIndex(null)
    setEditingDraftPosition(null)
  }, [])

  const clearCapturedPotholes = useCallback(() => {
    setPotholes([])
    setSelectedIndexes([])
    setReviewExpanded(false)
    resetPointEditing()
  }, [resetPointEditing])

  const resetTravelSafetyState = useCallback(() => {
    setMovementState('stationary')
    setPassengerConfirmed(false)
    setShowPassengerModal(false)
    setShowSimulationTools(false)
    movementSampleRef.current = null
    movementNotifiedRef.current = false
  }, [])

  const focusFirstProfileError = useCallback((errors) => {
    if (errors.firstName) {
      window.setTimeout(() => firstNameInputRef.current?.focus(), 0)
      return
    }

    if (errors.lastName) {
      window.setTimeout(() => lastNameInputRef.current?.focus(), 0)
      return
    }

    if (errors.email) {
      window.setTimeout(() => emailInputRef.current?.focus(), 0)
    }
  }, [])

  const persistSessionChoice = useCallback((role, acceptedAt) => {
    try {
      sessionStorage.setItem(
        SAFETY_CONSENT_STORAGE_KEY,
        JSON.stringify({
          acceptedAt,
          role,
        })
      )
    } catch {
      // Session persistence is optional.
    }
  }, [])

  const saveProfile = useCallback((profile) => {
    const normalizedProfile =
      persistProfile({
        profile,
        rememberProfile,
      }) ?? {
        firstName: profile.firstName.trim(),
        lastName: profile.lastName.trim(),
        email: profile.email.trim(),
      }

    setUserSettings(normalizedProfile)
    setProfileDraft(normalizedProfile)
    setProfileErrors({})
    setIsEditingProfile(false)

    return normalizedProfile
  }, [rememberProfile])

  const keepProfileForSessionOnly = useCallback(() => {
    if (!userSettings) {
      return
    }

    persistProfile({
      profile: userSettings,
      rememberProfile: false,
    })
    setRememberProfile(false)
    setFeedback({
      type: 'success',
      text: 'Le profil restera disponible seulement pour cette session.',
    })
  }, [userSettings])

  const handleRoleSelection = useCallback(
    (role) => {
      const acceptedAt = new Date().toISOString()
      setSessionRole(role)
      setConsentTimestamp(acceptedAt)
      setFeedback(null)
      setResultState(null)
      persistSessionChoice(role, acceptedAt)
      resetTravelSafetyState()
      setIsTraveling(false)

      if (role === 'driver') {
        setScreen('entry')
        return
      }

      setScreen('setup')
      setIsEditingProfile(!hasCompleteProfile(userSettings))
    },
    [persistSessionChoice, resetTravelSafetyState, userSettings]
  )

  const startTravel = useCallback(() => {
    setIsTraveling(true)
    clearCapturedPotholes()
    resetTravelSafetyState()
    setScreen('active')
    setResultState(null)
    setFeedback({
      type: 'success',
      text: 'Parcours demarre. Utilisez seulement les actions essentielles.',
    })
  }, [clearCapturedPotholes, resetTravelSafetyState])

  const stopTravel = useCallback(() => {
    setIsTraveling(false)
    resetTravelSafetyState()
    setScreen(potholes.length > 0 ? 'review' : 'setup')
    setFeedback({
      type: 'success',
      text:
        potholes.length > 0
          ? 'Parcours arrete. Les points sont prets a etre verifies.'
          : 'Parcours arrete.',
    })
  }, [potholes.length, resetTravelSafetyState])

  const handleProfileChange = useCallback((field, value) => {
    setProfileDraft((current) => ({
      ...current,
      [field]: value,
    }))

    setProfileErrors((current) => {
      if (!current[field]) {
        return current
      }

      const nextErrors = { ...current }
      delete nextErrors[field]
      return nextErrors
    })
  }, [])

  const handleSetupSubmit = useCallback(
    (event) => {
      event?.preventDefault()

      const profileCandidate = isEditingProfile || !userSettings ? profileDraft : userSettings
      const nextErrors = validateProfile(profileCandidate)

      if (Object.keys(nextErrors).length > 0) {
        setProfileErrors(nextErrors)
        setIsEditingProfile(true)
        focusFirstProfileError(nextErrors)
        return
      }

      if (isEditingProfile || !userSettings) {
        saveProfile(profileCandidate)
      }

      startTravel()
    },
    [
      focusFirstProfileError,
      isEditingProfile,
      profileDraft,
      saveProfile,
      startTravel,
      userSettings,
    ]
  )

  const appendPothole = useCallback((position) => {
    setPotholes((previous) => [...previous, position])
    setFeedback({ type: 'success', text: 'Nid-de-poule ajoute a la liste.' })
  }, [])

  const capturePotholeFromGps = useCallback(() => {
    if (!canLog) {
      setShowPassengerModal(true)
      return
    }

    if (!navigator.geolocation) {
      setFeedback({ type: 'error', text: 'Geolocalisation non supportee sur cet appareil.' })
      return
    }

    setIsLogging(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        appendPothole({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: new Date().toISOString(),
          simulated: false,
        })
        setIsLogging(false)
      },
      (error) => {
        setFeedback({
          type: 'error',
          text: `Erreur GPS: ${error.message}`,
        })
        setIsLogging(false)
      },
      LOG_CAPTURE_OPTIONS
    )
  }, [appendPothole, canLog])

  const addTestPothole = useCallback(() => {
    if (!canLog) {
      setShowPassengerModal(true)
      return
    }

    const randomOffset = () => (Math.random() - 0.5) * 0.01

    appendPothole({
      latitude: TEST_POINT_BASE.latitude + randomOffset(),
      longitude: TEST_POINT_BASE.longitude + randomOffset(),
      timestamp: new Date().toISOString(),
      simulated: true,
    })

    setShowSimulationTools(false)
  }, [appendPothole, canLog])

  const confirmPassenger = useCallback(() => {
    setPassengerConfirmed(true)
    setMovementState((current) => (current === 'moving' ? 'passenger-confirmed' : current))
    setShowPassengerModal(false)
    setFeedback({
      type: 'success',
      text: 'Confirmation passager enregistree pour ce parcours.',
    })
  }, [])

  const toggleSelection = useCallback((index, checked) => {
    setSelectedIndexes((current) => {
      if (checked) {
        return [...new Set([...current, index])].sort((left, right) => left - right)
      }

      return current.filter((item) => item !== index)
    })
  }, [])

  const selectAllPotholes = useCallback(() => {
    setSelectedIndexes(potholes.map((_, index) => index))
  }, [potholes])

  const clearSelectedPotholes = useCallback(() => {
    setSelectedIndexes([])
  }, [])

  const beginPointEdit = useCallback(
    (index) => {
      if (editingPointIndex !== null && editingPointIndex !== index) {
        return
      }

      if (editingPointIndex === index && editingDraftPosition) {
        return
      }

      const pothole = potholes[index]
      if (!pothole) {
        return
      }

      setReviewExpanded(true)
      setEditingPointIndex(index)
      setEditingDraftPosition({
        latitude: pothole.latitude,
        longitude: pothole.longitude,
      })
    },
    [editingDraftPosition, editingPointIndex, potholes]
  )

  const updatePointDraft = useCallback(
    (index, coordinates) => {
      if (editingPointIndex !== index) {
        return
      }

      setEditingDraftPosition({
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      })
    },
    [editingPointIndex]
  )

  const cancelPointMove = useCallback(() => {
    resetPointEditing()
  }, [resetPointEditing])

  const confirmPointMove = useCallback(() => {
    if (editingPointIndex === null || !editingDraftPosition) {
      return
    }

    setPotholes((current) => updatePotholePosition(current, editingPointIndex, editingDraftPosition))
    setFeedback({
      type: 'success',
      text: `${editingPointLabel} mis a jour sur la carte.`,
    })
    resetPointEditing()
  }, [editingDraftPosition, editingPointIndex, editingPointLabel, resetPointEditing])

  const beginNewReport = useCallback(() => {
    clearCapturedPotholes()
    setResultState(null)
    setScreen('setup')
    setFeedback(null)
  }, [clearCapturedPotholes])

  const reportSelectedPotholes = useCallback(async () => {
    if (!selectedPotholes.length || isSubmitting || editingPointIndex !== null) {
      return
    }

    const handledCount = selectedPotholes.length
    setIsSubmitting(true)

    try {
      if (isSafeMode) {
        setResultState({
          title: 'Simulation terminee',
          message: `${pointLabel(handledCount)} ${handledCount > 1 ? 'ont ete traites' : 'a ete traite'} sans envoi reel.`,
          mode: 'safe',
          count: handledCount,
        })
        clearCapturedPotholes()
        setScreen('result')
        return
      }

      const shouldSubmit = window.confirm(
        `Confirmer la soumission reelle de ${handledCount} nid(s)-de-poule vers ArcGIS?`
      )

      if (!shouldSubmit) {
        setFeedback({
          type: 'warning',
          text: 'Soumission annulee.',
        })
        return
      }

      const data = buildArcGisAddsPayload(selectedPotholes, userSettings)

      const encodedData = encodeURIComponent(JSON.stringify(data))
      const body = `f=json&adds=${encodedData}`

      const response = await fetch(ARCGIS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })
      const result = await response.json()
      if (response.ok && isSuccessfulArcGisAddResponse(result, handledCount)) {
        setResultState({
          title: 'Signalement envoye',
          message: `${pointLabel(handledCount)} ${handledCount > 1 ? 'ont ete envoyes' : 'a ete envoye'} vers ArcGIS.`,
          mode: 'live',
          count: handledCount,
        })
        clearCapturedPotholes()
        setScreen('result')
      } else {
        setFeedback({
          type: 'error',
          text: result?.error?.message || 'Erreur lors du signalement des nids-de-poule.',
        })
      }
    } catch (error) {
      setFeedback({
        type: 'error',
        text: `Erreur reseau: ${error.message}`,
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [
    clearCapturedPotholes,
    editingPointIndex,
    isSafeMode,
    isSubmitting,
    selectedPotholes,
    userSettings,
  ])

  const screenContent = (() => {
    if (screen === 'entry') {
      return (
        <>
          <ScreenHeader
            title="Signalement mobile de nids-de-poule"
            copy="Choisissez votre situation avant d'ouvrir le parcours mobile."
          />

          <section className="surface-card role-card">
            <p className="section-kicker">Acces securise</p>
            <div className="role-list">
              {ROLE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`role-option ${option.tone} ${
                    sessionRole === option.value ? 'selected' : ''
                  }`}
                  onClick={() => handleRoleSelection(option.value)}
                >
                  <span className="role-title">{option.title}</span>
                  <span className="role-copy">{option.description}</span>
                </button>
              ))}
            </div>
          </section>

          <AdvisoryNotice title="Projet independant non officiel">
            <p className="section-copy">
              Cette application n'est pas affiliee ni approuvee par la Ville de Levis.
            </p>
            <p className="section-copy">
              Utilisez-la seulement lorsque le vehicule est immobilise. Pour un signalement
              officiel, utilisez l'interface de la Ville de Levis.
            </p>
          </AdvisoryNotice>

          {sessionRole === 'driver' && (
            <section className="surface-card tone-warning">
              <p className="section-kicker">Protection</p>
              <h2>Utilisation bloquee pendant la conduite</h2>
              <p className="section-copy">
                Passez l'appareil a un passager ou arretez-vous completement avant de poursuivre.
              </p>
            </section>
          )}
        </>
      )
    }

    if (screen === 'setup') {
      return (
        <>
          <ScreenHeader
            title="Preparer le parcours"
            copy="Gardez seulement l'essentiel avant de commencer le signalement."
          />

          <div className="status-cluster">
            <StatusBadge tone="safe">{ROLE_LABELS[sessionRole]}</StatusBadge>
            <StatusBadge tone={gpsStatus === 'ready' ? 'info' : gpsStatus === 'unavailable' ? 'warning' : 'neutral'}>
              {gpsStatusLabel(gpsStatus)}
            </StatusBadge>
            <StatusBadge tone={isSafeMode ? 'safe' : 'accent'}>{modeSummaryLabel(isSafeMode)}</StatusBadge>
          </div>

          <form id="setup-profile-form" className="surface-card profile-card" noValidate onSubmit={handleSetupSubmit}>
            <div className="row-between">
              <div>
                <p className="section-kicker">Session</p>
                <h2>{ROLE_LABELS[sessionRole]}</h2>
              </div>
              <p className="timestamp-pill">{formatConsentTimestamp(consentTimestamp)}</p>
            </div>

            {!isEditingProfile && (
              <p className="section-copy">
                {sessionRole === 'passenger'
                  ? "Le parcours restera bloque si le vehicule est en mouvement sans confirmation passager."
                  : "Le parcours est prepare pour un usage a l'arret ou lors d'un transfert au passager."}
              </p>
            )}

            {REAL_SUBMISSION_ENABLED ? (
              <div className="mode-switch" role="group" aria-label="Mode de transmission">
                <button
                  type="button"
                  className={isSafeMode ? 'active' : ''}
                  onClick={() => setSimulationMode(true)}
                >
                  Simulation
                </button>
                <button
                  type="button"
                  className={!isSafeMode ? 'active' : ''}
                  onClick={() => setSimulationMode(false)}
                >
                  Reel
                </button>
              </div>
            ) : (
              <div className="mode-readonly">
                <StatusBadge tone="safe">Mode simulation securise</StatusBadge>
                <p className="section-copy">Aucune soumission reelle n'est activee dans cette configuration.</p>
              </div>
            )}

            <div className="card-divider" />

            <div className="row-between">
              <div>
                <p className="section-kicker">Profil</p>
                <h2>{isEditingProfile ? 'Profil' : 'Profil pret'}</h2>
              </div>
              {userSettings && !isEditingProfile && (
                <button
                  type="button"
                  className="inline-link"
                  onClick={() => {
                    setIsEditingProfile(true)
                    setProfileDraft(userSettings)
                    setProfileErrors({})
                  }}
                >
                  Modifier
                </button>
              )}
            </div>

            {userSettings && !isEditingProfile ? (
              <>
                <div className="profile-summary">
                  <p className="profile-name">{formatDisplayName(userSettings)}</p>
                  <p className="profile-email">{userSettings.email}</p>
                </div>

                <div className="profile-retention">
                  <p className="inline-note">
                    {rememberProfile
                      ? `Le profil est memorise sur cet appareil pendant ${PROFILE_REMEMBER_DURATION_DAYS} jours.`
                      : "Le profil est conserve seulement pour cette session sur cet appareil."}
                  </p>

                  {rememberProfile && (
                    <button
                      type="button"
                      className="inline-link"
                      onClick={keepProfileForSessionOnly}
                    >
                      Conserver seulement pour cette session
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="profile-form-grid">
                <label className="field">
                  <span>Prenom</span>
                  <input
                    ref={firstNameInputRef}
                    type="text"
                    placeholder="Prenom"
                    value={profileDraft.firstName}
                    onChange={(event) => handleProfileChange('firstName', event.target.value)}
                    aria-invalid={Boolean(profileErrors.firstName)}
                  />
                  {profileErrors.firstName && (
                    <span className="field-error">{profileErrors.firstName}</span>
                  )}
                </label>

                <label className="field">
                  <span>Nom de famille</span>
                  <input
                    ref={lastNameInputRef}
                    type="text"
                    placeholder="Nom de famille"
                    value={profileDraft.lastName}
                    onChange={(event) => handleProfileChange('lastName', event.target.value)}
                    aria-invalid={Boolean(profileErrors.lastName)}
                  />
                  {profileErrors.lastName && (
                    <span className="field-error">{profileErrors.lastName}</span>
                  )}
                </label>

                <label className="field">
                  <span>Courriel</span>
                  <input
                    ref={emailInputRef}
                    type="email"
                    placeholder="Courriel"
                    value={profileDraft.email}
                    onChange={(event) => handleProfileChange('email', event.target.value)}
                    aria-invalid={Boolean(profileErrors.email)}
                  />
                  {profileErrors.email && <span className="field-error">{profileErrors.email}</span>}
                </label>

                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={rememberProfile}
                    onChange={(event) => setRememberProfile(event.target.checked)}
                  />
                  <span>
                    Garder ce profil sur cet appareil pendant {PROFILE_REMEMBER_DURATION_DAYS}{' '}
                    jours.
                  </span>
                </label>

                <p className="field-hint">
                  Sans cette option, le profil reste disponible seulement pour la session en
                  cours.
                </p>
              </div>
            )}
          </form>
        </>
      )
    }

    if (screen === 'active') {
      return (
        <>
          <ScreenHeader
            title="Parcours actif"
            copy="Ajoutez les nids-de-poule, puis touchez Revoir pour preparer la liste a transmettre."
          />

          <div className="status-cluster">
            <StatusBadge tone={movementState === 'moving' ? 'warning' : movementState === 'passenger-confirmed' ? 'safe' : 'neutral'}>
              {movementStateLabel(movementState)}
            </StatusBadge>
            <StatusBadge tone={gpsStatus === 'ready' ? 'info' : gpsStatus === 'unavailable' ? 'warning' : 'neutral'}>
              {gpsStatusLabel(gpsStatus)}
            </StatusBadge>
            {watchId !== null && <StatusBadge tone="safe">Suivi actif</StatusBadge>}
          </div>

          <section className="surface-card hero-card">
            <p className="section-kicker">Capture rapide</p>
            <h2>{potholeLabel(potholes.length)} dans la liste</h2>
            <p className="section-copy">
              Touchez <strong>Ajouter un nid-de-poule</strong>, puis <strong>Revoir</strong> pour
              verifier la liste avant {isSafeMode ? 'simulation' : 'soumission'}.
            </p>
            {!canLog && (
              <p className="inline-note warning">
                Le signalement est verrouille jusqu'a la confirmation passager.
              </p>
            )}
          </section>

          <section className="surface-card compact-card">
            <div className="row-between">
              <div>
                <p className="section-kicker">Mode</p>
                <h2>{isSafeMode ? 'Simulation securisee' : 'Soumission reelle'}</h2>
              </div>
              {isSafeMode && (
                <button
                  type="button"
                  className="inline-link"
                  onClick={() => setShowSimulationTools(true)}
                >
                  Outils de simulation
                </button>
              )}
            </div>

            <p className="section-copy">
              {isSafeMode
                ? "Les nids-de-poule ajoutes restent locaux tant que vous demeurez dans le mode simulation."
                : "Les nids-de-poule ajoutes pourront etre soumis a ArcGIS apres Revoir."}
            </p>

            {gpsStatus !== 'ready' && (
              <p className="inline-note">
                GPS en mode degrade: l'enregistrement peut etre plus lent sur cet appareil.
              </p>
            )}
          </section>
        </>
      )
    }

    if (screen === 'review') {
      return (
        <>
          <ScreenHeader
            title="Verifier la liste"
            copy={`Quand la liste est prete, touchez ${
              isSafeMode ? 'Simuler la liste' : 'Soumettre la liste'
            }.`}
          />

          <div className="status-cluster">
            <StatusBadge tone={isSafeMode ? 'safe' : 'accent'}>{modeSummaryLabel(isSafeMode)}</StatusBadge>
            <StatusBadge tone="neutral">{pointLabel(potholes.length)} pret(s)</StatusBadge>
          </div>

          <section className="surface-card hero-card">
            <p className="section-kicker">Pret a transmettre</p>
            <h2>{potholeLabel(selectedCount)} selectionne(s)</h2>
            <p className="section-copy">
              La selection complete est activee par defaut pour aller plus vite.
            </p>
            {editingPointLabel && (
              <p className="inline-note">Ajustez {editingPointLabel}, puis confirmez le nouvel emplacement.</p>
            )}
            <button
              type="button"
              className="secondary-chip"
              onClick={() => setReviewExpanded((current) => !current)}
            >
              {reviewExpanded ? 'Masquer le detail' : 'Modifier la selection'}
            </button>
          </section>

          <PotholeMapPreview
            points={selectedMapPoints}
            editingPointIndex={editingPointIndex}
            editingDraftPosition={editingDraftPosition}
            onBeginPointEdit={beginPointEdit}
            onUpdatePointDraft={updatePointDraft}
            onConfirmPointMove={confirmPointMove}
            onCancelPointMove={cancelPointMove}
          />

          {reviewExpanded && (
            <section className="surface-card review-card">
              <div className="summary-toolbar">
                <button type="button" className="secondary-chip" onClick={selectAllPotholes}>
                  Tout selectionner
                </button>
                <button type="button" className="secondary-chip" onClick={clearSelectedPotholes}>
                  Tout deselectionner
                </button>
              </div>

              <div className="summary-list">
                {potholes.map((pothole, index) => (
                  <label
                    key={index}
                    className={`summary-item ${editingPointIndex === index ? 'editing' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIndexes.includes(index)}
                      onChange={(event) => toggleSelection(index, event.target.checked)}
                    />
                    <span className="summary-item-text">
                      <strong>Point {index + 1}</strong>
                      <span>
                        {formatPointCoordinates(
                          editingPointIndex === index && editingDraftPosition
                            ? editingDraftPosition
                            : pothole
                        )}
                      </span>
                      <span className="summary-item-meta">
                        {editingPointIndex === index && (
                          <span className="draft-tag">Ajustement en cours</span>
                        )}
                        {pothole.simulated && <span className="simulated-tag">Point simule</span>}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </section>
          )}

          {selectedCount === 0 && (
            <p className="inline-note warning">
              Selectionnez au moins un point avant de continuer.
            </p>
          )}

          {!isSafeMode && (
            <AdvisoryNotice title="Avant de transmettre la liste">
              <p className="section-copy">
                Vous etes sur le point de transmettre des donnees a un service municipal externe.
              </p>
              <p className="section-copy">
                Projet independant non officiel. Verifiez que le vehicule est immobilise avant de
                poursuivre. Pour un usage officiel, privilegiez l'interface de la Ville de Levis.
              </p>
            </AdvisoryNotice>
          )}
        </>
      )
    }

    return (
      <>
        <ScreenHeader
          title={resultState?.title || 'Traitement termine'}
          copy="Le flux est complete. Vous pouvez repartir rapidement vers un nouveau parcours."
        />

        <section className="surface-card result-card">
          <div className={`result-count ${resultState?.mode || 'safe'}`}>
            <span>{resultState?.count ?? 0}</span>
          </div>
          <div className="result-copy">
            <p className="section-kicker">{resultState?.mode === 'live' ? 'ArcGIS' : 'Simulation'}</p>
            <h2>{resultState?.message || 'Aucun resultat a afficher.'}</h2>
            <p className="section-copy">
              {resultState?.mode === 'live'
                ? "Les points ont ete traites et le prochain parcours peut etre prepare."
                : "Aucune soumission reelle n'a ete envoyee dans ce mode."}
            </p>
          </div>
        </section>

        <div className="status-cluster">
          <StatusBadge tone={resultState?.mode === 'live' ? 'accent' : 'safe'}>
            {resultState?.mode === 'live' ? 'Envoi confirme' : 'Mode simulation'}
          </StatusBadge>
          <StatusBadge tone="neutral">{formatDisplayName(userSettings) || 'Profil conserve'}</StatusBadge>
        </div>
      </>
    )
  })()

  const actionBar = (() => {
    if (showPassengerModal) {
      return null
    }

    if (screen === 'setup') {
      return {
        primary: {
          label: 'Commencer le parcours',
          type: 'submit',
          form: 'setup-profile-form',
        },
      }
    }

    if (screen === 'active') {
      return {
        secondary: {
          label: potholes.length > 0 ? `Revoir (${potholes.length})` : 'Terminer',
          onClick: stopTravel,
          tone: 'secondary',
        },
        primary: {
          label: isLogging ? 'Ajout...' : 'Ajouter un nid-de-poule',
          onClick: capturePotholeFromGps,
          disabled: isLogging || !canLog,
          tone: 'accent',
        },
      }
    }

    if (screen === 'review') {
      return {
        primary: {
          label: isSubmitting
            ? 'Transmission...'
            : isSafeMode
              ? `Simuler la liste (${selectedCount})`
              : `Soumettre la liste (${selectedCount})`,
          onClick: reportSelectedPotholes,
          disabled: selectedCount === 0 || isSubmitting || editingPointIndex !== null,
          tone: isSafeMode ? 'safe' : 'accent',
        },
      }
    }

    if (screen === 'result') {
      return {
        primary: {
          label: 'Nouveau parcours',
          onClick: beginNewReport,
          tone: 'accent',
        },
      }
    }

    return null
  })()

  const appClassName = [
    'app-shell',
    `screen-${screen}`,
    actionBar ? 'has-action-bar' : '',
    reviewExpanded ? 'is-review-expanded' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={appClassName}>
      <main className="screen-shell">{screenContent}</main>

      {feedback && (
        <div
          className={`feedback-toast ${feedback.type} ${actionBar ? 'with-action-bar' : ''}`}
          role="status"
          aria-live="polite"
        >
          {feedback.text}
        </div>
      )}

      {actionBar && (
        <div
          key={`${screen}-${actionBar.primary.label}`}
          className={`sticky-action-bar ${actionBar.secondary ? 'double' : 'single'}`}
          role="group"
          aria-label="Actions principales"
        >
          {actionBar.secondary && (
            <button
              type="button"
              className="secondary-cta action-secondary"
              onClick={actionBar.secondary.onClick}
              disabled={actionBar.secondary.disabled}
            >
              {actionBar.secondary.label}
            </button>
          )}

          <button
            type={actionBar.primary.type || 'button'}
            form={actionBar.primary.form}
            className={`primary-cta action-primary ${actionBar.primary.tone || 'accent'}`}
            onClick={actionBar.primary.onClick}
            disabled={actionBar.primary.disabled}
          >
            {actionBar.primary.label}
          </button>
        </div>
      )}

      {showSimulationTools && isSafeMode && (
        <div className="sheet-backdrop" role="presentation" onClick={() => setShowSimulationTools(false)}>
          <div
            className="sheet-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="simulation-tools-title"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="section-kicker">Mode simulation</p>
            <h2 id="simulation-tools-title">Outils de simulation</h2>
            <p className="section-copy">
              Les outils avances restent separes du flux principal pour garder l'ecran simple.
            </p>

            <button type="button" className="primary-cta sheet-button" onClick={addTestPothole}>
              Ajouter un nid-de-poule simule
            </button>
            <button
              type="button"
              className="secondary-cta sheet-button"
              onClick={() => setShowSimulationTools(false)}
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      <PassengerConfirmationModal
        isOpen={showPassengerModal}
        onConfirmPassenger={confirmPassenger}
        onStopTravel={stopTravel}
      />
    </div>
  )
}

export default App
