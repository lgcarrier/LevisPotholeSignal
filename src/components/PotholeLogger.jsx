function PotholeLogger({
  onRequestLog,
  onRequestTestLog,
  gpsReady,
  simulationMode,
  canLog,
  isLogging,
  movementState,
  onPassengerConfirmRequest,
}) {
  return (
    <div className="logger-actions">
      <button
        onClick={onRequestLog}
        className={`log-button ${isLogging ? 'logging' : ''}`}
        disabled={isLogging || !canLog}
        type="button"
      >
        {isLogging ? 'Enregistrement...' : 'Signaler un nid-de-poule'}
      </button>

      {simulationMode && (
        <button
          className="test-log-button"
          onClick={onRequestTestLog}
          disabled={!canLog}
          type="button"
        >
          Ajouter un point de test (GPS simulé)
        </button>
      )}

      {!gpsReady && (
        <p className="gps-hint">
          GPS en mode dégradé: l&apos;enregistrement peut être plus lent.
        </p>
      )}

      {movementState === 'moving' && (
        <div className="safety-lock">
          <p>Le signalement est verrouillé jusqu&apos;à confirmation du passager.</p>
          <button type="button" className="secondary-cta" onClick={onPassengerConfirmRequest}>
            Confirmer le passager
          </button>
        </div>
      )}
    </div>
  )
}

export default PotholeLogger
