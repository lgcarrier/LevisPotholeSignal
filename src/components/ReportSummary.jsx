import { useState } from 'react'

function ReportSummary({ potholes, onReport }) {
  const [selected, setSelected] = useState(potholes.map((_, i) => i))

  const handleSubmit = () => {
    const toReport = potholes.filter((_, i) => selected.includes(i))
    onReport(toReport)
  }

  return (
    <div className="summary">
      <h2>Nids-de-poule à signaler ({potholes.length})</h2>
      {potholes.map((pothole, index) => (
        <label key={index}>
          <input
            type="checkbox"
            checked={selected.includes(index)}
            onChange={(e) => {
              if (e.target.checked) {
                setSelected(prev => [...prev, index])
              } else {
                setSelected(prev => prev.filter(i => i !== index))
              }
            }}
          />
          Lat: {pothole.latitude.toFixed(4)}, Long: {pothole.longitude.toFixed(4)}
        </label>
      ))}
      <div className="summary-buttons">
        <button onClick={handleSubmit} disabled={selected.length === 0}>
          Signaler la sélection ({selected.length})
        </button>
      </div>
    </div>
  )
}

export default ReportSummary