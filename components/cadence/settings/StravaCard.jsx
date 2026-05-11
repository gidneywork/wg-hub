'use client'

import { useState } from 'react'
import { timeAgo } from './settingsHelpers'

/**
 * Strava integration card.
 *
 * Two states share the same Cadence section chrome (moss left-border,
 * mono eyebrow, status-badge). The connected state matches the mockup
 * verbatim. The disconnected state preserves the legacy connect-CTA
 * content inside the new chrome — no new disconnected design exists
 * in the mockups yet.
 */
export default function StravaCard({ stravaConnection, onDisconnect }) {
  const [disconnecting, setDisconnecting] = useState(false)
  const connected = !!stravaConnection

  const handleDisconnect = async () => {
    if (typeof window !== 'undefined' &&
        !window.confirm('Disconnect Strava? Your synced activities will remain in the database.')) return
    setDisconnecting(true)
    try { await onDisconnect?.() } finally { setDisconnecting(false) }
  }

  return (
    <section className="settings-section r r-3">
      <div className="section-head">
        <span className="section-label">Strava</span>
        <span className={`status-badge${connected ? '' : ' warning'}`}>
          {connected ? 'Connected' : 'Not connected'}
        </span>
      </div>

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
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              {disconnecting ? 'Disconnecting…' : 'Disconnect Strava'}
            </button>
          </div>
        </div>
      ) : (
        <div className="integration-body">
          <div>
            <h3 className="integration-name">Connect your Strava account</h3>
            <p className="integration-loc" style={{ marginBottom: 16 }}>
              {/* The .integration-loc class supplies mono caption styling. */}
              Sync activities into History automatically — your Strava data is never modified.
            </p>
            <a
              href="/api/strava/connect"
              className="btn btn-primary"
              style={{ display: 'inline-block', textDecoration: 'none' }}
            >
              Connect Strava
            </a>
          </div>
          <div className="integration-info">
            <p>
              Activities appear on the History page where you can rename them,
              change their session type, and add notes. Heart rate, pace, elevation
              and source are all preserved on import.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
