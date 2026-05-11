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
