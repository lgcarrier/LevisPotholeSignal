import { useState } from 'react'

function PotholeLogger({ onLog, gpsReady }) {
  const [isLogging, setIsLogging] = useState(false)

  const handleLog = () => {
    setIsLogging(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onLog({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: new Date().toISOString()
        })
        setIsLogging(false)
      },
      (error) => {
        alert('GPS Error: ' + error.message)
        setIsLogging(false)
      },
      { enableHighAccuracy: true, maximumAge: 5000 }
    )
  }

  return (
    <button 
      onClick={handleLog} 
      className={`log-button ${isLogging ? 'logging' : ''}`}
      disabled={isLogging}
    >
      {isLogging ? 'Logging...' : 'Report Pothole'}
    </button>
  )
}

export default PotholeLogger