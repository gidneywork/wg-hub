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
