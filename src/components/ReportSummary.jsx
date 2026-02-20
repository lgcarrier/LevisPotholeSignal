function ReportSummary({
  potholes,
  selectedIndexes,
  onSelectionChange,
  onReport,
  simulationMode,
  isSubmitting,
}) {
  const selectedCount = selectedIndexes.length

  const toggleSelection = (index, checked) => {
    if (checked) {
      const deduped = [...new Set([...selectedIndexes, index])].sort((a, b) => a - b)
      onSelectionChange(deduped)
      return
    }

    onSelectionChange(selectedIndexes.filter((item) => item !== index))
  }

  const selectAll = () => {
    onSelectionChange(potholes.map((_, index) => index))
  }

  const clearAll = () => {
    onSelectionChange([])
  }

  return (
    <div className="summary">
      <h3>Points prêts à transmettre ({potholes.length})</h3>

      <div className="summary-toolbar">
        <button type="button" className="secondary-cta" onClick={selectAll}>
          Tout sélectionner
        </button>
        <button type="button" className="secondary-cta" onClick={clearAll}>
          Tout désélectionner
        </button>
      </div>

      <div className="summary-list">
        {potholes.map((pothole, index) => (
          <label key={index} className="summary-item">
            <input
              type="checkbox"
              checked={selectedIndexes.includes(index)}
              onChange={(event) => toggleSelection(index, event.target.checked)}
            />
            <span className="summary-item-text">
              <strong>Point {index + 1}</strong>
              <span>
                Lat: {pothole.latitude.toFixed(4)}, Long: {pothole.longitude.toFixed(4)}
              </span>
              {pothole.simulated && <span className="simulated-tag">Point de test</span>}
            </span>
          </label>
        ))}
      </div>

      <div className="summary-buttons">
        <button
          type="button"
          className="primary-cta"
          onClick={onReport}
          disabled={selectedCount === 0 || isSubmitting}
        >
          {isSubmitting
            ? 'Transmission...'
            : simulationMode
              ? `Simuler la sélection (${selectedCount})`
              : `Signaler la sélection (${selectedCount})`}
        </button>
      </div>
    </div>
  )
}

export default ReportSummary
