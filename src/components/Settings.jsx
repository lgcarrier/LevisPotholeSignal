import { useEffect, useState } from 'react'

function Settings({ onSave, initialSettings }) {
  const [name, setName] = useState(initialSettings.name)
  const [email, setEmail] = useState(initialSettings.email)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    setName(initialSettings.name)
    setEmail(initialSettings.email)
    setErrors({})
  }, [initialSettings.email, initialSettings.name])

  const handleSubmit = (e) => {
    e.preventDefault()
    const nextErrors = {}

    if (!name.trim()) {
      nextErrors.name = 'Le nom est requis.'
    }
    if (!email.trim()) {
      nextErrors.email = 'Le courriel est requis.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = 'Veuillez entrer un courriel valide.'
    }

    setErrors(nextErrors)

    if (!Object.keys(nextErrors).length) {
      onSave({ name: name.trim(), email: email.trim() })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="settings">
      <label className="field">
        <span>Nom complet</span>
        <input
          type="text"
          placeholder="Nom complet"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={Boolean(errors.name)}
        />
        {errors.name && <span className="field-error">{errors.name}</span>}
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
