import { useEffect, useState } from 'react'

function Settings({ onSave, initialSettings }) {
  const [firstName, setFirstName] = useState(initialSettings.firstName)
  const [lastName, setLastName] = useState(initialSettings.lastName)
  const [email, setEmail] = useState(initialSettings.email)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    setFirstName(initialSettings.firstName)
    setLastName(initialSettings.lastName)
    setEmail(initialSettings.email)
    setErrors({})
  }, [initialSettings.email, initialSettings.firstName, initialSettings.lastName])

  const handleSubmit = (e) => {
    e.preventDefault()
    const nextErrors = {}

    if (!firstName.trim()) {
      nextErrors.firstName = 'Le prenom est requis.'
    }
    if (!lastName.trim()) {
      nextErrors.lastName = 'Le nom de famille est requis.'
    }
    if (!email.trim()) {
      nextErrors.email = 'Le courriel est requis.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = 'Veuillez entrer un courriel valide.'
    }

    setErrors(nextErrors)

    if (!Object.keys(nextErrors).length) {
      onSave({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="settings">
      <label className="field">
        <span>Prenom</span>
        <input
          type="text"
          placeholder="Prenom"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          aria-invalid={Boolean(errors.firstName)}
        />
        {errors.firstName && <span className="field-error">{errors.firstName}</span>}
      </label>

      <label className="field">
        <span>Nom de famille</span>
        <input
          type="text"
          placeholder="Nom de famille"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          aria-invalid={Boolean(errors.lastName)}
        />
        {errors.lastName && <span className="field-error">{errors.lastName}</span>}
      </label>

      <label className="field">
        <span>Courriel</span>
        <input
          type="email"
          placeholder="Courriel"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={Boolean(errors.email)}
        />
        {errors.email && <span className="field-error">{errors.email}</span>}
      </label>

      <button type="submit" className="primary-cta">Enregistrer le profil</button>
    </form>
  )
}

export default Settings
