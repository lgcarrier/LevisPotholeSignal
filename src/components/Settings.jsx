import { useState } from 'react'

function Settings({ onSave, initialSettings }) {
  const [name, setName] = useState(initialSettings.name)
  const [email, setEmail] = useState(initialSettings.email)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (name && email.includes('@')) {
      onSave({ name, email })
    } else {
      alert('Veuillez entrer un nom et un courriel valide')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="settings">
      <input
        type="text"
        placeholder="Nom complet"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        type="email"
        placeholder="Courriel"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button type="submit">Enregistrer</button>
    </form>
  )
}

export default Settings