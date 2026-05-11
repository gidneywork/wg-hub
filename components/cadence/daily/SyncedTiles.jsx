'use client'

import { useEffect, useState } from 'react'
import { db } from '../../../lib/db'
import {
  fmtRelativeAgo,
  fmtHoursColon,
  activitySummary,
} from './dailyHelpers'

/**
 * Synced section — 5 read-only tiles fed from Whoop + Strava.
 *
 *   date              currently-selected ISO date
 *   whoopData         per-date Whoop snapshot keyed by ISO date
 *   activities        full Strava activities list (filtered per date)
 *   stravaConnection  for last_synced_at timestamp
 *   onSynced          callback fired after a successful manual sync;
 *                     parent should refresh stravaConnection (and rely
 *                     on Supabase realtime for activities).
 */
export default function SyncedTiles({
  date,
  whoopData,
  activities,
  stravaConnection,
  onSynced,
}) {
  const w = whoopData?.[date]
  const act = activitySummary(activities, date)

  // "Nm ago" — most recent of Strava sync and Whoop upload.
  const [whoopLastSync, setWhoopLastSync] = useState(null)
  useEffect(() => {
    let cancelled = false
    db.loadAuditLog({ type: 'whoop_upload', limit: 1 }).then(rows => {
      if (!cancelled) setWhoopLastSync(rows?.[0]?.created_at || null)
    })
    return () => { cancelled = true }
  }, [])

  const stravaLastSync = stravaConnection?.last_synced_at || null
  const mostRecent = [stravaLastSync, whoopLastSync]
    .filter(Boolean)
    .sort()
    .pop()

  // Sync now → POST /api/strava/sync. Inline status replaces the
  // "↻ Sync now" link briefly; the upstream realtime subscription
  // refreshes activities automatically, the parent callback refreshes
  // stravaConnection so the timestamp advances.
  const [syncState, setSyncState] = useState('idle') // 'idle' | 'syncing' | 'done' | 'error'
  const handleSync = async () => {
    setSyncState('syncing')
    try {
      const res = await fetch('/api/strava/sync', { method: 'POST' })
      const data = await res.json()
      if (data.error) {
        setSyncState('error')
      } else {
        setSyncState('done')
        await onSynced?.()
        // Refetch the latest whoop_upload row too in case anything wrote.
        const rows = await db.loadAuditLog({ type: 'whoop_upload', limit: 1 })
        setWhoopLastSync(rows?.[0]?.created_at || null)
        setTimeout(() => setSyncState('idle'), 1800)
      }
    } catch (e) {
      setSyncState('error')
    }
  }

  const syncLabel = syncState === 'syncing'
    ? 'Syncing…'
    : syncState === 'done'
      ? '✓ Synced'
      : syncState === 'error'
        ? 'Sync failed'
        : '↻ Sync now'

  // Tile values — null inputs render an italic em-dash via TileValue.
  const hrv      = w?.hrv != null ? Math.round(w.hrv) : null
  const rhr      = w?.rhr != null ? Math.round(w.rhr) : null
  const recovery = w?.recovery_score != null ? Math.round(w.recovery_score) : null
  const sleepHrs = fmtHoursColon(w?.hours_slept)
  const sleepSc  = w?.sleep_score != null ? Math.round(w.sleep_score) : null

  return (
    <section className="section r r-3">
      <div className="section-head">
        <span className="title">Synced</span>
        <span className="meta">
          <span>From Whoop · Strava · {fmtRelativeAgo(mostRecent)}</span>
          <button
            type="button"
            className="resync-btn"
            onClick={handleSync}
            disabled={syncState === 'syncing'}
          >
            {syncLabel}
          </button>
        </span>
      </div>

      <div className="synced-grid">
        <Tile label="HRV"        value={hrv}      unit="ms"     source="Whoop" />
        <Tile label="Resting HR" value={rhr}      unit="bpm"    source="Whoop" />
        <Tile label="Recovery"   value={recovery} unit="/100"   source="Whoop" />
        <Tile
          label="Sleep"
          value={sleepHrs}
          unit={sleepHrs && sleepSc != null ? `h · ${sleepSc}/100` : sleepHrs ? 'h' : null}
          source="Whoop"
        />
        <Tile
          label="Activity"
          value={act ? `${act.count}` : null}
          unit={act ? (act.km != null ? `${act.noun} · ${act.km.toFixed(1)} km` : act.noun) : null}
          source="Strava"
        />
      </div>
    </section>
  )
}

function Tile({ label, value, unit, source }) {
  const empty = value == null || value === ''
  return (
    <div className="synced-tile">
      <div className="label">{label}</div>
      <div className="value">
        {empty
          ? <span className="em-dash">—</span>
          : <>{value}{unit ? <span className="unit">{unit}</span> : null}</>
        }
      </div>
      <div className="source">{source}</div>
    </div>
  )
}
