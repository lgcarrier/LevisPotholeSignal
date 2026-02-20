import { useEffect, useRef } from 'react'

function PassengerConfirmationModal({ isOpen, onConfirmPassenger, onStopTravel }) {
  const dialogRef = useRef(null)
  const confirmButtonRef = useRef(null)

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    confirmButtonRef.current?.focus()

    const dialogNode = dialogRef.current
    if (!dialogNode) {
      return undefined
    }

    const handleKeyDown = (event) => {
      if (event.key !== 'Tab') {
        return
      }

      const focusable = dialogNode.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (!focusable.length) {
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    dialogNode.addEventListener('keydown', handleKeyDown)
    return () => {
      dialogNode.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  return (
    <div className="modal-backdrop">
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="passenger-modal-title"
        ref={dialogRef}
      >
        <h2 id="passenger-modal-title">Mouvement détecté</h2>
        <p>
          Le véhicule semble en mouvement. Seul un passager peut utiliser l&apos;application dans
          cette situation.
        </p>
        <p className="modal-warning">
          Confirmez que vous êtes passager, sinon arrêtez le parcours.
        </p>

        <div className="modal-actions">
          <button
            ref={confirmButtonRef}
            type="button"
            className="primary-cta"
            onClick={onConfirmPassenger}
          >
            Je confirme être passager
          </button>
          <button type="button" className="secondary-cta" onClick={onStopTravel}>
            Arrêter le parcours
          </button>
        </div>
      </div>
    </div>
  )
}

export default PassengerConfirmationModal
