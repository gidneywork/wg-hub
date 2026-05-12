'use client'

import { useState } from 'react'
import { timeAgo } from './settingsHelpers'
import CadenceDialog from '../CadenceDialog'

/**
 * Strava integration card.
 *
 * Two states share the same Cadence section chrome (moss left-border,
 * mono eyebrow, status-badge). The connected state matches the mockup
 * verbatim. The disconnected state preserves the legacy connect-CTA
 * content inside the new chrome — no new disconnected design exists
 * in the mockups yet.
 */
export default function StravaCard({ stravaConnection, onDisconnect, onSynced }) {
  const [disconnecting,  setDisconnecting ] = useState(false)
  const [syncing,        setSyncing       ] = useState(false)
  const [syncResult,     setSyncResult    ] = useState(null)
  const [confirmOpen,    setConfirmOpen   ] = useState(false)
  const connected = !!stravaConnection

  const handleDisconnect = () => setConfirmOpen(true)

  const handleConfirmDisconnect = async () => {
    setConfirmOpen(false)
    setDisconnecting(true)
    try { await onDisconnect?.() } finally { setDisconnecting(false) }
  }

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/strava/sync', { method: 'POST' })
      const data = await res.json()
      if (data.error) {
        setSyncResult({ error: data.error })
      } else {
        const n = data.new ?? 0
        setSyncResult({
          ok: true,
          message: n > 0
            ? `Synced ${n} activit${n === 1 ? 'y' : 'ies'}`
            : 'No new activities',
        })
        await onSynced?.()
      }
    } catch (e) {
      setSyncResult({ error: e.message })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <section className="settings-section r r-3">
      <div className="section-head">
        <span className="section-label">Strava</span>
        <span className={`status-badge${connected ? '' : ' warning'}`}>
          {connected ? 'Connected' : 'Not connected'}
        </span>
      </div>

      <CadenceDialog
        open={confirmOpen}
        title="Disconnect Strava?"
        body="Your synced activities will remain in the database."
        confirmLabel="Disconnect"
        cancelLabel="Cancel"
        confirmClass="btn-danger"
        onConfirm={handleConfirmDisconnect}
        onCancel={() => setConfirmOpen(false)}
      />

      {connected ? (
        <div className="integration-body">
          <div>
            <h3 className="integration-name">{stravaConnection.athlete_name || '—'}</h3>
            {(stravaConnection.athlete_city || stravaConnection.athlete_country) ? (
              <div className="integration-loc">
                {[stravaConnection.athlete_city, stravaConnection.athlete_country].filter(Boolean).join(', ')}
              </div>
            ) : null}
            <div className="integration-stats">
              <div className="integration-stat">
                <div className="label">Activities</div>
                <div className="value">{stravaConnection.activity_count ?? '—'}</div>
              </div>
              <div className="integration-stat">
                <div className="label">Last sync</div>
                <div className="value">{timeAgo(stravaConnection.last_synced_at)}</div>
              </div>
              <div className="integration-stat">
                <div className="label">Connected</div>
                <div className="value">{timeAgo(stravaConnection.connected_at)}</div>
              </div>
            </div>
          </div>
          <div className="integration-info">
            <p>Strava is connected. Activities sync to History automatically. Custom names and session types you've set are always preserved.</p>
            <div className="strava-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSync}
                disabled={syncing}
              >
                {syncing ? 'Syncing…' : 'Sync now'}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? 'Disconnecting…' : 'Disconnect Strava'}
              </button>
              {syncResult ? (
                <span className={`upload-result${syncResult.error ? ' error' : ''}`}>
                  {syncResult.error ? `Sync failed — ${syncResult.error}` : syncResult.message}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="integration-body">
          <div>
            <h3 className="integration-name">Connect your Strava account</h3>
            <p className="integration-info-p">
              Sync all your activities automatically. Activities appear in the History page where you can rename them, change their type, and add notes. Your Strava data is never modified.
            </p>
            <a
              href="/api/strava/connect"
              className="btn btn-primary connect-link"
            >
              Connect Strava
            </a>
          </div>
          <div className="integration-info">
            <div className="sync-list-eyebrow">What gets synced</div>
            <ul className="sync-list">
              {[
                'All runs, rides, swims and gym sessions',
                'Activity name, type, distance, duration, pace',
                'Heart rate data where available',
                'Elevation gain',
                'New activities sync incrementally',
              ].map(item => (
                <li key={item}><span className="check">✓</span><span>{item}</span></li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}
