/**
 * Daily Data helpers — pure functions for the Daily page.
 *
 * Subsequent commits flesh out:
 *  - weekStripData (Monday-anchored week + per-day "has-entry" pip)
 *  - syncedTileData (Whoop + Strava read-only tiles per date)
 *  - progressFromTarget (field-card bar + helper)
 *  - weeklyWeightDelta (7-day weight delta)
 *  - debounced auto-save plumbing
 *
 * This file is created in commit 1 so the scaffold compiles and the
 * downstream commits have a stable import path.
 */

// "Monday · 11 May 2026" for the date display.
export function fmtDateLong(date) {
  if (!date) return ''
  const d = new Date(date + 'T00:00:00')
  const dow = d.toLocaleDateString('en-GB', { weekday: 'long' })
  const day = d.getDate()
  const mon = d.toLocaleDateString('en-GB', { month: 'long' })
  const year = d.getFullYear()
  return `${dow} · ${day} ${mon} ${year}`
}

// "HH:MM" for the save-status timestamp.
export function fmtSaveTime(d = new Date()) {
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

// Today as YYYY-MM-DD (local time).
export function todayIso() {
  return new Date().toISOString().split('T')[0]
}

// ── Week strip data
// Returns seven entries — the last 7 days ending today, oldest first.
// Each entry: { iso, dow, num, hasEntry, isToday, isActive }.
// The strip is anchored on TODAY (not on the selected date) so the
// active tile is whichever day the user is viewing, or none if the
// selected date sits outside the 7-day window.
export function weekStripData(activeDate, logs = {}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const iso = d.toISOString().split('T')[0]
    days.push({
      iso,
      dow:      d.toLocaleDateString('en-GB', { weekday: 'short' }),
      num:      String(d.getDate()).padStart(2, '0'),
      hasEntry: !!logs[iso],
      isToday:  i === 0,
      isActive: iso === activeDate,
    })
  }
  return days
}

// Shift an ISO date by `delta` days. Returns null if the new date
// would be in the future (we don't log forward).
export function shiftIso(iso, delta) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + delta)
  const next = d.toISOString().split('T')[0]
  if (delta > 0 && next > todayIso()) return null
  return next
}

// "Nm ago" / "Nh ago" / "Nd ago" — for the Synced section meta line.
// Includes minute granularity, unlike the Settings timeAgo helper.
// Pass `null` and you get "—" (no source has reported a sync).
export function fmtRelativeAgo(iso) {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 0) return 'Just now'
  const mins = Math.floor(ms / 60000)
  if (mins < 1)  return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

// "H:MM" — used in the Sleep synced tile to format the hours-slept
// decimal (e.g. 7.3 → "7:18").
export function fmtHoursColon(hoursDecimal) {
  if (hoursDecimal == null || isNaN(parseFloat(hoursDecimal))) return null
  const h = Math.floor(hoursDecimal)
  const m = Math.round((hoursDecimal - h) * 60)
  return `${h}:${m.toString().padStart(2, '0')}`
}

// Activity-tile summary for one date. Counts runs and sums their
// distance in km; falls back to a generic "N activities" line when
// the day has no runs but does have other activity types. Returns
// `null` when the day has nothing.
export function activitySummary(activities, isoDate) {
  if (!activities || !isoDate) return null
  const dayActs = activities.filter(a => (a.start_date || '').startsWith(isoDate))
  if (!dayActs.length) return null
  const runs = dayActs.filter(a => (a.custom_type || a.strava_type) === 'run')
  if (runs.length > 0) {
    const km = runs.reduce((s, a) => s + (a?.data?.distance || 0), 0) / 1000
    return {
      count: runs.length,
      noun:  runs.length === 1 ? 'run' : 'runs',
      km:    km > 0 ? km : null,
    }
  }
  return {
    count: dayActs.length,
    noun:  dayActs.length === 1 ? 'activity' : 'activities',
    km:    null,
  }
}
