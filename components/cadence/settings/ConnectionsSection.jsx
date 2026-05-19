'use client'

import { useState } from 'react'

const CONNECTIONS = [
  { id: 'google',  label: 'Google Calendar' },
  { id: 'outlook', label: 'Outlook Calendar' },
]

function ConnectionRow({ label }) {
  const [flash, setFlash] = useState(false)

  function handleConnect() {
    setFlash(true)
    setTimeout(() => setFlash(false), 2000)
  }

  return (
    <div className="conn-row">
      <span className="conn-pip" aria-hidden="true" />
      <span className="conn-label">{label}</span>
      <div className="conn-right">
        {flash && <span className="conn-soon">Coming soon</span>}
        <button type="button" className="conn-btn" onClick={handleConnect}>
          Connect
        </button>
      </div>
    </div>
  )
}

export default function ConnectionsSection() {
  return (
    <section className="settings-section r r-4">
      <div className="section-head">
        <span className="section-label">Connections</span>
      </div>
      <div className="section-body">
        {CONNECTIONS.map(c => (
          <ConnectionRow key={c.id} label={c.label} />
        ))}
      </div>
    </section>
  )
}
