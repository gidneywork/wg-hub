'use client'

import { timeAgo } from './settingsHelpers'
import { useCronometerSync } from '../CronometerRefresh'
import { MANUAL_LIMIT_DAILY } from '../../../lib/cronometer-shared'

/**
 * Cronometer card (FC-084). Mirrors the WHOOP card's chrome. Credentials live
 * only in server env vars, so there is nothing to connect or type here: the
 * card shows sync health, the day's refresh budget, where targets come from,
 * and a Sync now button (the same manual path as Refresh from Cronometer).
 */
export default function CronometerCard() {
  const { conn, status, busy, notice, refresh, loading } = useCronometerSync()
  const synced = !!conn?.last_synced_at
  const badge = !synced ? 'Not synced yet' : status.failing ? 'Sync failing' : 'Syncing'
  const targets = conn?.targets_note ? 'Cadence targets' : synced ? 'From Cronometer' : '—'

  return (
    <section className="settings-section r r-3">
      <div className="section-head">
        <span className="section-label">Cronometer</span>
        <span className={`status-badge${synced && !status.failing ? '' : ' warning'}`}>{badge}</span>
      </div>

      {loading ? (
        <p className="section-blurb">Loading…</p>
      ) : (
        <div className="integration-body">
          <div>
            <h3 className="integration-name">Nutrition sync</h3>
            <div className="integration-stats">
              <div className="integration-stat">
                <div className="label">Last sync</div>
                <div className="value">{timeAgo(conn?.last_synced_at)}</div>
              </div>
              <div className="integration-stat">
                <div className="label">Refreshes left today</div>
                <div className="value">{status.left} / {MANUAL_LIMIT_DAILY}</div>
              </div>
              <div className="integration-stat">
                <div className="label">Targets</div>
                <div className="value">{targets}</div>
              </div>
            </div>
          </div>
          <div className="integration-info">
            <p>Syncs at 07:00, 10:00, 13:00, 16:00, 19:00 and 22:00. Credentials are set on the server.</p>
            <div className="strava-actions">
              <button type="button" className="btn btn-primary" onClick={refresh} disabled={busy || status.spent}>
                {busy ? 'Refreshing…' : 'Sync now'}
              </button>
              {status.error && !busy ? (
                <span className="upload-result error">{status.error}</span>
              ) : notice || status.spent ? (
                <span className="upload-result">{notice || status.line}</span>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
