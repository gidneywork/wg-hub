'use client'

import { useState } from 'react'
import {
  fmtRelativeAgo,
  activitySummary,
} from './dailyHelpers'

/**
 * Synced section — Strava activity tile.
 *
 * Previously held five tiles (HRV, RHR, Recovery, Sleep, Activity) fed
 * from Whoop + Strava. The four Whoop tiles moved to Body and Sleep &
 * recovery as manual-entry fields with Whoop-fills-when-empty pre-fill,
 * since Whoop has no auto-sync and the tiles read "—" most days. This
 * section now surfaces the only auto-syncing source on the page: the
 * Strava activity rollup for the selected date.
 *
 *   date              currently-selected ISO date
 *   activities        full Strava activities list (filtered per date)
 *   stravaConnection  for last_synced_at timestamp
 *   onSynced          callback fired after a successful manual sync;
 *                     parent should refresh stravaConnection (and rely
 *                     on Supabase realtime for activities).
 */
export default function SyncedTiles({
  date,
  activities,
  stravaConnection,
  onSynced,
}) {
  const act = activitySummary(activities, date)
  const stravaLastSync = stravaConnection?.last_synced_at || null

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

  return (
    <section className="section r r-3">
      <div className="section-head">
        <span className="title">Synced</span>
        <span className="meta">
          <span>From Strava · {fmtRelativeAgo(stravaLastSync)}</span>
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
