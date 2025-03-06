import { useState } from 'react'

function Settings({ onSave, initialSettings }) {
  const [name, setName] = useState(initialSettings.name)
  const [email, setEmail] = useState(initialSettings.email)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (name && email.includes('@')) {
      onSave({ name, email })
    } else {
      alert('Please enter a valid name and email')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="settings">
      <input
        type="text"
        placeholder="Full Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button type="submit">Save Settings</button>
    </form>
  )
}

export default Settings