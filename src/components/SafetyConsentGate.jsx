import { useMemo, useState } from 'react'

function SafetyConsentGate({ onContinue }) {
  const [driverConsent, setDriverConsent] = useState(false)
  const [passengerConsent, setPassengerConsent] = useState(false)

  const canContinue = useMemo(
    () => driverConsent && passengerConsent,
    [driverConsent, passengerConsent]
  )

  const handleSubmit = (event) => {
    event.preventDefault()
    if (canContinue) {
      onContinue()
    }
  }

  return (
    <div className="consent-gate">
      <div className="consent-card">
        <p className="consent-eyebrow">Avant de commencer</p>
        <h1>Engagement de sécurité</h1>
        <p className="consent-copy">
          Cette application doit être utilisée de façon sécuritaire. Confirmez que vous ne
          l&apos;utilisez pas en conduisant.
        </p>

        <form onSubmit={handleSubmit} className="consent-form">
          <label className="consent-check">
            <input
              type="checkbox"
              checked={driverConsent}
              onChange={(event) => setDriverConsent(event.target.checked)}
            />
            Je confirme ne pas utiliser cette application en conduisant.
          </label>

          <label className="consent-check">
            <input
              type="checkbox"
              checked={passengerConsent}
              onChange={(event) => setPassengerConsent(event.target.checked)}
            />
            Si le véhicule est en mouvement, je confirme qu&apos;un passager utilise l&apos;application.
          </label>

          <button type="submit" className="primary-cta" disabled={!canContinue}>
            Continuer
          </button>
        </form>
      </div>
    </div>
  )
}

export default SafetyConsentGate
