'use client'

import { useEffect, useState } from 'react'
import { db } from '../../../lib/db'
import CadenceDialog, { dlog } from '../CadenceDialog'
import { timeAgo } from './settingsHelpers'
import { apiFetch, startConnect } from '../../../lib/api'

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
  const [confirmOpen,   _setConfirmOpen]  = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [probing,       setProbing]       = useState(false)
  const [probe,         setProbe]         = useState(null)
  const [probeError,    setProbeError]    = useState(null)
  const [backfilling,   setBackfilling]   = useState(false)
  const [backfill,      setBackfill]      = useState(null)

  // Instrumented setter — logs every explicit confirmOpen change WITH the
  // caller's stack. A REMOUNT resets confirmOpen to false WITHOUT going through
  // here, so "dialog vanished + no setConfirmOpen(false) log + an UNMOUNT log"
  // means remount; "vanished + setConfirmOpen(false) log" means something closed
  // it. (TEMPORARY — flip DIALOG_DEBUG in CadenceDialog.jsx to silence.)
  const setConfirmOpen = (v) => { dlog(`WhoopConnectCard setConfirmOpen(${v})\n${new Error().stack}`); _setConfirmOpen(v) }

  dlog('WhoopConnectCard render; confirmOpen=', confirmOpen, 'connection=', connection === undefined ? 'loading' : (connection ? 'obj' : 'null'))
  useEffect(() => {
    dlog('WhoopConnectCard MOUNT')
    return () => dlog('WhoopConnectCard UNMOUNT')
  }, [])

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
      await apiFetch('/api/whoop/disconnect', { method: 'POST' })
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
      const res  = await apiFetch('/api/whoop/probe')
      const data = await res.json()
      if (!res.ok || data.error) setProbeError(data.error || `Probe failed (${res.status})`)
      else setProbe(data)
    } catch {
      setProbeError('Probe request failed')
    } finally {
      setProbing(false)
    }
  }

  const handleBackfill = async () => {
    setBackfilling(true)
    setBackfill(null)
    try {
      const res  = await apiFetch('/api/whoop/backfill', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || data.error) setBackfill({ error: data.error || `Backfill failed (${res.status})` })
      else setBackfill(data)
    } catch {
      setBackfill({ error: 'Backfill request failed' })
    } finally {
      setBackfilling(false)
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
            <p>Connected to the WHOOP API v2. Backfill pulls your full history into whoop_data. The probe returns raw JSON for inspection and writes nothing.</p>
            <div className="strava-actions">
              <button type="button" className="btn btn-primary" onClick={handleBackfill} disabled={backfilling}>
                {backfilling ? 'Backfilling…' : 'Backfill from WHOOP'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={handleProbe} disabled={probing}>
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

            {backfill ? (
              backfill.error ? (
                <div className="whoop-probe-counts">Backfill failed — {backfill.error}</div>
              ) : (
                <div className="whoop-probe-counts">
                  Backfilled {backfill.upserted} dates
                  {backfill.dateRange ? ` (${backfill.dateRange[0]} … ${backfill.dateRange[1]})` : ''}
                  {' · fetched '}{backfill.fetched?.recoveries} recovery / {backfill.fetched?.sleeps} sleep / {backfill.fetched?.cycles} cycle
                  {backfill.skippedNoSleep ? ` · ${backfill.skippedNoSleep} recovery skipped (no sleep)` : ''}
                  {backfill.skippedNap ? ` · ${backfill.skippedNap} nap skipped` : ''}
                </div>
              )
            ) : null}

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
            <button type="button" onClick={() => startConnect('/api/whoop/connect')} className="btn btn-primary connect-link">
              Connect WHOOP
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
