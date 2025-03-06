import { useState, useEffect } from 'react'
import Settings from './components/Settings'
import TravelControl from './components/TravelControl'
import PotholeLogger from './components/PotholeLogger'
import ReportSummary from './components/ReportSummary'

function App() {
  const [userSettings, setUserSettings] = useState(null)
  const [isTraveling, setIsTraveling] = useState(false)
  const [potholes, setPotholes] = useState([])
  const [debugMode, setDebugMode] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [gpsStatus, setGpsStatus] = useState('initializing') // 'initializing', 'ready', 'unavailable'

  useEffect(() => {
    const savedSettings = localStorage.getItem('userSettings')
    if (savedSettings) {
      setUserSettings(JSON.parse(savedSettings))
    }

    // Warm up GPS with a single call
    const timeoutId = setTimeout(() => {
      setGpsStatus('unavailable')
      console.log('GPS initialization timed out')
    }, 15000)

    navigator.geolocation.getCurrentPosition(
      () => {
        clearTimeout(timeoutId)
        setGpsStatus('ready')
        console.log('GPS initialized')
      },
      (error) => {
        clearTimeout(timeoutId)
        setGpsStatus('unavailable')
        console.error('GPS initialization error:', error.message)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )

    return () => clearTimeout(timeoutId)
  }, [])

  const handleSettingsSave = (settings) => {
    setUserSettings(settings)
    localStorage.setItem('userSettings', JSON.stringify(settings))
    setShowSettings(false)
  }

  const toggleTravel = () => {
    if (isTraveling) {
      setIsTraveling(false)
    } else if (userSettings?.name && userSettings?.email) {
      setIsTraveling(true)
      setPotholes([])
    } else {
      setShowSettings(true)
    }
  }

  const logPothole = (position) => {
    if (isTraveling) {
      setPotholes(prev => [...prev, position])
    }
  }

  const reportPotholes = async (selectedPotholes) => {
    if (debugMode) {
      console.log('Debug Mode - Simulated API Call:', {
        user: userSettings,
        potholes: selectedPotholes
      })
      alert('Débogage : Nids-de-poule signalés avec succès')
      setPotholes([])
      return
    }

    const data = selectedPotholes.map(pothole => ({
      geometry: {
        x: pothole.longitude,
        y: pothole.latitude,
        spatialReference: { wkid: 102100 }
      },
      attributes: {
        Nom: userSettings.name,
        courriel: userSettings.email,
        Statut: 'Signale'
      }
    }))

    const encodedData = encodeURIComponent(JSON.stringify(data))
    const body = `f=json&adds=${encodedData}`

    try {
      const response = await fetch(
        'https://services1.arcgis.com/niuNnVx0H92jOc5F/arcgis/rest/services/NidDePouleSignale/FeatureServer/0/applyEdits',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body
        }
      )
      const result = await response.json()
      if (result.addResults?.every(r => r.success)) {
        alert('Nids-de-poule signalés avec succès')
        setPotholes([])
      } else {
        alert('Erreur lors du signalement des nids-de-poule')
      }
    } catch (error) {
      alert('Erreur réseau : ' + error.message)
    }
  }

  return (
    <div className="app">
      <h1>Signalement de nids-de-poule sur le territoire de la ville de Lévis (Québec).</h1>
      
      <button 
        className="menu-button"
        onClick={() => setShowSettings(!showSettings)}
      >
        {showSettings ? 'Fermer' : 'Paramètres'}
      </button>

      {(showSettings || !userSettings) && (
        <Settings 
          onSave={handleSettingsSave} 
          initialSettings={userSettings || { name: '', email: '' }} 
        />
      )}

      <label>
        <input
          type="checkbox"
          checked={debugMode}
          onChange={(e) => setDebugMode(e.target.checked)}
        />
        Mode débogage
      </label>

      {gpsStatus === 'initializing' && <p>Initialisation du GPS...</p>}
      {gpsStatus === 'ready' && <p className="success">GPS prêt</p>}
      {gpsStatus === 'unavailable' && (
        <p className="error">GPS non disponible - L'enregistrement peut être plus lent</p>
      )}
      <TravelControl isTraveling={isTraveling} onToggle={toggleTravel} />
      {isTraveling && <PotholeLogger onLog={logPothole} gpsReady={gpsStatus === 'ready'} />}
      {!isTraveling && potholes.length > 0 && (
        <ReportSummary potholes={potholes} onReport={reportPotholes} />
      )}
    </div>
  )
}

export default App