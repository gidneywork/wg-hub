'use client'

import { useEffect, useState } from 'react'
import { db } from '../../../lib/db'
import CadenceDialog from '../CadenceDialog'
import { timeAgo } from './settingsHelpers'

/**
 * WHOOP API connection card (WH-001a).
 *
 * Mirrors StravaCard's section chrome. Distinct from WhoopUpload, which is the
 * unrelated CSV importer. This card handles the OAuth connection and the raw
 * probe — the deliverable of WH-001a. Nothing here writes to the database or
 * maps to Daily data; the probe returns raw JSON only.
 */
export default function WhoopConnectCard() {
  // undefined = loading, null = not connected, object = connected
  const [connection,    setConnection]    = useState(undefined)
  const [confirmOpen,   setConfirmOpen]   = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [probing,       setProbing]       = useState(false)
  const [probe,         setProbe]         = useState(null)
  const [probeError,    setProbeError]    = useState(null)

  const loadConnection = async () => setConnection(await db.loadWhoopConnection())
  useEffect(() => { loadConnection() }, [])

  const connected = !!connection
  const name = connection && (connection.first_name || connection.last_name)
    ? [connection.first_name, connection.last_name].filter(Boolean).join(' ')
    : null

  const handleConfirmDisconnect = async () => {
    setConfirmOpen(false)
    setDisconnecting(true)
    try {
      await fetch('/api/whoop/disconnect', { method: 'POST' })
      setProbe(null)
      setProbeError(null)
      await loadConnection()
    } finally {
      setDisconnecting(false)
    }
  }

  const handleProbe = async () => {
    setProbing(true)
    setProbe(null)
    setProbeError(null)
    try {
      const res  = await fetch('/api/whoop/probe')
      const data = await res.json()
      if (!res.ok || data.error) setProbeError(data.error || `Probe failed (${res.status})`)
      else setProbe(data)
    } catch {
      setProbeError('Probe request failed')
    } finally {
      setProbing(false)
    }
  }

  const downloadProbe = () => {
    const blob = new Blob([JSON.stringify(probe, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = 'whoop-probe.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const count = (resource) => {
    const r = probe?.[resource]
    if (r?.error) return 'error'
    if (Array.isArray(r?.records)) return r.records.length
    return '—'
  }

  return (
    <section className="settings-section r r-3">
      <div className="section-head">
        <span className="section-label">WHOOP</span>
        <span className={`status-badge${connected ? '' : ' warning'}`}>
          {connected ? 'Connected' : 'Not connected'}
        </span>
      </div>

      <CadenceDialog
        open={confirmOpen}
        title="Disconnect WHOOP?"
        body="Your imported Whoop CSV data stays in the database. This only removes the API connection."
        confirmLabel="Disconnect"
        cancelLabel="Cancel"
        confirmClass="btn-danger"
        onConfirm={handleConfirmDisconnect}
        onCancel={() => setConfirmOpen(false)}
      />

      {connection === undefined ? (
        <p className="section-blurb">Loading…</p>
      ) : connected ? (
        <div className="integration-body">
          <div>
            <h3 className="integration-name">{name || 'WHOOP account'}</h3>
            <div className="integration-stats">
              <div className="integration-stat">
                <div className="label">Connected</div>
                <div className="value">{timeAgo(connection.connected_at)}</div>
              </div>
            </div>
          </div>
          <div className="integration-info">
            <p>Connected to the WHOOP API v2. Run the probe to pull raw JSON — nothing is written and nothing maps to Daily data yet.</p>
            <div className="strava-actions">
              <button type="button" className="btn btn-primary" onClick={handleProbe} disabled={probing}>
                {probing ? 'Running probe…' : 'Run probe'}
              </button>
              {probe ? (
                <button type="button" className="btn btn-ghost" onClick={downloadProbe}>
                  Download JSON
                </button>
              ) : null}
              <button type="button" className="btn btn-danger" onClick={() => setConfirmOpen(true)} disabled={disconnecting}>
                {disconnecting ? 'Disconnecting…' : 'Disconnect WHOOP'}
              </button>
              {probeError ? (
                <span className="upload-result error">Probe failed — {probeError}</span>
              ) : null}
            </div>

            {probe ? (
              <div className="whoop-probe">
                <div className="whoop-probe-counts">
                  cycle {count('cycle')} · recovery {count('recovery')} · sleep {count('sleep')} · workout {count('workout')} · body {probe.body_measurement?.error ? 'error' : '1'}
                </div>
                <pre className="whoop-probe-json">{JSON.stringify(probe, null, 2)}</pre>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="integration-body">
          <div>
            <h3 className="integration-name">Connect your WHOOP account</h3>
            <p className="integration-info-p">
              Authenticate with the WHOOP API v2 to probe recovery, sleep, cycle and workout data. This session only reads and displays raw JSON — nothing is written or mapped to Daily data.
            </p>
            <a href="/api/whoop/connect" className="btn btn-primary connect-link">
              Connect WHOOP
            </a>
          </div>
        </div>
      )}
    </section>
  )
}
