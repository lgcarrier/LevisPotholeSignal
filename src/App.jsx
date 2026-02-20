import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Settings from './components/Settings'
import TravelControl from './components/TravelControl'
import PotholeLogger from './components/PotholeLogger'
import ReportSummary from './components/ReportSummary'
import SafetyConsentGate from './components/SafetyConsentGate'
import PassengerConfirmationModal from './components/PassengerConfirmationModal'
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

const GPS_WARMUP_OPTIONS = { enableHighAccuracy: true, timeout: 10000 }
const LOG_CAPTURE_OPTIONS = { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
const WATCH_OPTIONS = { enableHighAccuracy: true, maximumAge: 1500, timeout: 12000 }

function App() {
  const [userSettings, setUserSettings] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [isTraveling, setIsTraveling] = useState(false)
  const [potholes, setPotholes] = useState([])
  const [selectedIndexes, setSelectedIndexes] = useState([])
  const [simulationMode, setSimulationMode] = useState(true)
  const [gpsStatus, setGpsStatus] = useState('initializing')
  const [feedback, setFeedback] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLogging, setIsLogging] = useState(false)

  const [safetyConsent, setSafetyConsent] = useState(false)
  const [consentTimestamp, setConsentTimestamp] = useState(null)
  const [movementState, setMovementState] = useState('stationary')
  const [passengerConfirmed, setPassengerConfirmed] = useState(false)
  const [watchId, setWatchId] = useState(null)
  const [showPassengerModal, setShowPassengerModal] = useState(false)

  const consentMemoryRef = useRef(null)
  const gpsInitializedRef = useRef(false)
  const movementSampleRef = useRef(null)
  const passengerConfirmedRef = useRef(false)
  const movementNotifiedRef = useRef(false)

  const isSafeMode = simulationMode || !REAL_SUBMISSION_ENABLED
  const selectedCount = selectedIndexes.length
  const selectedPotholes = useMemo(
    () => potholes.filter((_, index) => selectedIndexes.includes(index)),
    [potholes, selectedIndexes]
  )
  const isMovementLocked = movementState === 'moving'
  const canLog = isTraveling && !isMovementLocked

  useEffect(() => {
    const savedSettings = localStorage.getItem('userSettings')
    if (savedSettings) {
      setUserSettings(JSON.parse(savedSettings))
    }

    try {
      const rawConsent = sessionStorage.getItem(SAFETY_CONSENT_STORAGE_KEY)
      if (rawConsent) {
        const parsedConsent = JSON.parse(rawConsent)
        if (parsedConsent?.acceptedAt) {
          setSafetyConsent(true)
          setConsentTimestamp(parsedConsent.acceptedAt)
        }
      }
    } catch {
      if (consentMemoryRef.current?.acceptedAt) {
        setSafetyConsent(true)
        setConsentTimestamp(consentMemoryRef.current.acceptedAt)
      }
    }
  }, [])

  useEffect(() => {
    passengerConfirmedRef.current = passengerConfirmed
  }, [passengerConfirmed])

  useEffect(() => {
    if (gpsInitializedRef.current || !safetyConsent) {
      return undefined
    }

    gpsInitializedRef.current = true

    if (!navigator.geolocation) {
      setGpsStatus('unavailable')
      return undefined
    }

    const timeoutId = setTimeout(() => {
      setGpsStatus('unavailable')
      setFeedback({
        type: 'warning',
        text: 'Initialisation GPS lente. Le suivi continuera en mode dégradé.',
      })
    }, 15000)

    navigator.geolocation.getCurrentPosition(
      () => {
        clearTimeout(timeoutId)
        setGpsStatus('ready')
      },
      () => {
        clearTimeout(timeoutId)
        setGpsStatus('unavailable')
      },
      GPS_WARMUP_OPTIONS
    )

    return () => clearTimeout(timeoutId)
  }, [safetyConsent])

  useEffect(() => {
    if (!isTraveling) {
      setSelectedIndexes(potholes.map((_, index) => index))
    }
  }, [isTraveling, potholes])

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
        setShowPassengerModal(true)
        if (!movementNotifiedRef.current) {
          setFeedback({
            type: 'warning',
            text: `Mouvement détecté (>= ${MOVEMENT_SPEED_THRESHOLD_KMH} km/h): confirmation passager requise.`,
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
        text: `Suivi GPS limité: ${error.message}`,
      })
    }

    const id = navigator.geolocation.watchPosition(handlePosition, handleWatchError, WATCH_OPTIONS)
    setWatchId(id)

    return () => {
      navigator.geolocation.clearWatch(id)
      setWatchId((current) => (current === id ? null : current))
    }
  }, [isTraveling])

  const clearCapturedPotholes = useCallback(() => {
    setPotholes([])
    setSelectedIndexes([])
  }, [])

  const handleSafetyConsent = () => {
    const acceptedAt = new Date().toISOString()
    setSafetyConsent(true)
    setConsentTimestamp(acceptedAt)
    consentMemoryRef.current = { acceptedAt }

    try {
      sessionStorage.setItem(
        SAFETY_CONSENT_STORAGE_KEY,
        JSON.stringify({
          acceptedAt,
        })
      )
    } catch {
      // In-memory fallback is already active through state and consentMemoryRef.
    }
  }

  const handleSettingsSave = (settings) => {
    setUserSettings(settings)
    localStorage.setItem('userSettings', JSON.stringify(settings))
    setShowSettings(false)
    setFeedback({ type: 'success', text: 'Profil enregistré.' })
  }

  const startTravel = useCallback(() => {
    setIsTraveling(true)
    clearCapturedPotholes()
    setMovementState('stationary')
    setPassengerConfirmed(false)
    setShowPassengerModal(false)
    movementSampleRef.current = null
    movementNotifiedRef.current = false
    setFeedback({ type: 'success', text: 'Parcours démarré.' })
  }, [clearCapturedPotholes])

  const stopTravel = useCallback(() => {
    setIsTraveling(false)
    setMovementState('stationary')
    setPassengerConfirmed(false)
    setShowPassengerModal(false)
    movementSampleRef.current = null
    movementNotifiedRef.current = false
    setFeedback({ type: 'success', text: 'Parcours arrêté. Vérifiez les points avant soumission.' })
  }, [])

  const toggleTravel = useCallback(() => {
    if (isTraveling) {
      stopTravel()
      return
    }

    if (userSettings?.name && userSettings?.email) {
      startTravel()
      return
    }

    setShowSettings(true)
    setFeedback({
      type: 'warning',
      text: 'Complétez votre profil avant de démarrer un parcours.',
    })
  }, [isTraveling, startTravel, stopTravel, userSettings])

  const appendPothole = useCallback((position) => {
    setPotholes((previous) => [...previous, position])
    setFeedback({ type: 'success', text: 'Point GPS enregistré.' })
  }, [])

  const capturePotholeFromGps = useCallback(() => {
    if (!canLog) {
      setShowPassengerModal(true)
      return
    }

    if (!navigator.geolocation) {
      setFeedback({ type: 'error', text: 'Géolocalisation non supportée sur cet appareil.' })
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

  const addTestPothole = () => {
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
  }

  const confirmPassenger = () => {
    setPassengerConfirmed(true)
    setMovementState((current) => (current === 'moving' ? 'passenger-confirmed' : current))
    setShowPassengerModal(false)
    setFeedback({
      type: 'success',
      text: 'Confirmation passager enregistrée pour ce parcours.',
    })
  }

  const reportSelectedPotholes = useCallback(async () => {
    if (!selectedPotholes.length || isSubmitting) {
      return
    }

    setIsSubmitting(true)

    try {
      if (isSafeMode) {
        console.log('Safe Mode - Simulated API Call:', {
          user: userSettings,
          potholes: selectedPotholes,
        })
        setFeedback({
          type: 'success',
          text: `Simulation réussie: ${selectedPotholes.length} nid(s)-de-poule traité(s).`,
        })
        clearCapturedPotholes()
        return
      }

      const shouldSubmit = window.confirm(
        `Confirmer la soumission réelle de ${selectedPotholes.length} nid(s)-de-poule vers ArcGIS?`
      )
      if (!shouldSubmit) {
        setFeedback({
          type: 'warning',
          text: 'Soumission annulée.',
        })
        return
      }

      const data = selectedPotholes.map((pothole) => ({
        geometry: {
          x: pothole.longitude,
          y: pothole.latitude,
          spatialReference: { wkid: 102100 },
        },
        attributes: {
          Nom: userSettings.name,
          courriel: userSettings.email,
          Statut: 'Signale',
        },
      }))

      const encodedData = encodeURIComponent(JSON.stringify(data))
      const body = `f=json&adds=${encodedData}`

      const response = await fetch(ARCGIS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })
      const result = await response.json()
      if (result.addResults?.every((entry) => entry.success)) {
        setFeedback({
          type: 'success',
          text: 'Nids-de-poule signalés avec succès.',
        })
        clearCapturedPotholes()
      } else {
        setFeedback({
          type: 'error',
          text: 'Erreur lors du signalement des nids-de-poule.',
        })
      }
    } catch (error) {
      setFeedback({
        type: 'error',
        text: `Erreur réseau: ${error.message}`,
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [clearCapturedPotholes, isSafeMode, isSubmitting, selectedPotholes, userSettings])

  const primaryAction = useMemo(() => {
    if (isTraveling) {
      if (isMovementLocked) {
        return {
          label: 'Confirmer passager',
          onClick: () => setShowPassengerModal(true),
          disabled: false,
          tone: 'warning',
        }
      }

      return {
        label: isLogging ? 'Enregistrement...' : 'Signaler',
        onClick: capturePotholeFromGps,
        disabled: isLogging,
        tone: 'accent',
      }
    }

    if (potholes.length > 0) {
      return {
        label: isSafeMode ? `Simuler (${selectedCount})` : `Soumettre (${selectedCount})`,
        onClick: reportSelectedPotholes,
        disabled: selectedCount === 0 || isSubmitting,
        tone: 'success',
      }
    }

    return {
      label: 'Démarrer',
      onClick: toggleTravel,
      disabled: false,
      tone: 'accent',
    }
  }, [
    capturePotholeFromGps,
    isLogging,
    isMovementLocked,
    isSafeMode,
    isSubmitting,
    isTraveling,
    potholes.length,
    selectedCount,
    reportSelectedPotholes,
    toggleTravel,
  ])

  const secondaryAction = useMemo(() => {
    if (isTraveling) {
      return {
        label: 'Arrêter',
        onClick: stopTravel,
        disabled: false,
      }
    }

    if (potholes.length > 0) {
      return {
        label: 'Démarrer',
        onClick: toggleTravel,
        disabled: isSubmitting,
      }
    }

    return null
  }, [isSubmitting, isTraveling, potholes.length, stopTravel, toggleTravel])

  const consentDetails = consentTimestamp
    ? new Date(consentTimestamp).toLocaleString('fr-CA')
    : 'Non confirmé'

  if (!safetyConsent) {
    return <SafetyConsentGate onContinue={handleSafetyConsent} />
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <p className="eyebrow">Ville de Lévis (Québec)</p>
        <h1>Signalement mobile de nids-de-poule</h1>
        <p className="subhead">Parcours rapide, saisie sécurisée, soumission guidée.</p>
      </header>

      <div className="status-ribbon">
        <span className={`badge movement ${movementState}`}>{movementStateLabel(movementState)}</span>
        <span className={`badge gps ${gpsStatus}`}>
          {gpsStatus === 'ready'
            ? 'GPS prêt'
            : gpsStatus === 'unavailable'
              ? 'GPS limité'
              : 'GPS initialisation'}
        </span>
        {watchId !== null && isTraveling && <span className="badge neutral">Suivi actif</span>}
      </div>

      {feedback && (
        <p className={`feedback-banner ${feedback.type}`} aria-live="polite">
          {feedback.text}
        </p>
      )}

      <section className="card">
        <h2>Sécurité</h2>
        <p className="section-copy">
          Consentement session: <strong>{consentDetails}</strong>
        </p>

        <label className="mode-toggle">
          <input
            type="checkbox"
            checked={isSafeMode}
            disabled={!REAL_SUBMISSION_ENABLED}
            onChange={(event) => setSimulationMode(event.target.checked)}
          />
          Mode simulation sécurisé
        </label>

        <p className={`mode-status ${isSafeMode ? 'safe' : 'live'}`}>
          {isSafeMode
            ? 'Simulation active: aucune soumission réelle.'
            : 'Soumission réelle ArcGIS activée.'}
        </p>

        {!REAL_SUBMISSION_ENABLED && (
          <p className="mode-note">
            Soumission réelle désactivée par configuration (`VITE_ALLOW_REAL_SUBMISSION=true`).
          </p>
        )}
      </section>

      <section className="card">
        <h2>Profil</h2>
        {userSettings && !showSettings ? (
          <div className="profile-summary">
            <p>
              <strong>{userSettings.name}</strong>
            </p>
            <p>{userSettings.email}</p>
            <button type="button" className="secondary-cta" onClick={() => setShowSettings(true)}>
              Modifier le profil
            </button>
          </div>
        ) : (
          <Settings
            onSave={handleSettingsSave}
            initialSettings={userSettings || { name: '', email: '' }}
          />
        )}
      </section>

      <section className="card">
        <h2>Parcours</h2>
        <p className="section-copy">
          {isTraveling
            ? 'Parcours en cours. Signalez les points en toute sécurité.'
            : 'Démarrez un parcours pour activer la capture GPS.'}
        </p>
        <TravelControl isTraveling={isTraveling} onToggle={toggleTravel} />
      </section>

      <section className="card">
        <h2>Signalements</h2>
        {isTraveling ? (
          <PotholeLogger
            onRequestLog={capturePotholeFromGps}
            onRequestTestLog={addTestPothole}
            gpsReady={gpsStatus === 'ready'}
            simulationMode={isSafeMode}
            canLog={canLog}
            isLogging={isLogging}
            movementState={movementState}
            onPassengerConfirmRequest={() => setShowPassengerModal(true)}
          />
        ) : potholes.length > 0 ? (
          <p className="section-copy">{potholes.length} point(s) capturé(s). Passez à la soumission.</p>
        ) : (
          <p className="empty-state">
            Aucun point enregistré. Démarrez un parcours puis utilisez le bouton Signaler.
          </p>
        )}
      </section>

      <section className="card">
        <h2>Soumission</h2>
        {!isTraveling && potholes.length > 0 ? (
          <ReportSummary
            potholes={potholes}
            selectedIndexes={selectedIndexes}
            onSelectionChange={setSelectedIndexes}
            onReport={reportSelectedPotholes}
            simulationMode={isSafeMode}
            isSubmitting={isSubmitting}
          />
        ) : isTraveling ? (
          <p className="empty-state">Arrêtez le parcours pour réviser et soumettre vos points.</p>
        ) : (
          <p className="empty-state">
            Votre prochain signalement apparaîtra ici avec les options de sélection.
          </p>
        )}
      </section>

      <div className="sticky-action-bar" role="group" aria-label="Actions principales">
        {secondaryAction && (
          <button
            type="button"
            className="secondary-cta action-secondary"
            onClick={secondaryAction.onClick}
            disabled={secondaryAction.disabled}
          >
            {secondaryAction.label}
          </button>
        )}
        <button
          type="button"
          className={`primary-cta action-primary ${primaryAction.tone}`}
          onClick={primaryAction.onClick}
          disabled={primaryAction.disabled}
        >
          {primaryAction.label}
        </button>
      </div>

      <PassengerConfirmationModal
        isOpen={showPassengerModal}
        onConfirmPassenger={confirmPassenger}
        onStopTravel={stopTravel}
      />
    </div>
  )
}

export default App
