/**
 * History helpers — pure functions for the History page.
 *
 * The data shape is the rows returned by db.loadActivities():
 *   { id, data, start_date, strava_type, custom_name, custom_type, notes, synced_at }
 * with `data` carrying the original Strava blob:
 *   { name, type, sport_type, distance (m), moving_time (s),
 *     total_elevation_gain, average_heartrate, max_heartrate, manual: true }
 *
 * Subsequent commits flesh out grouping, range filtering, summary stats,
 * density-strip data and the PB heuristic. This file is created here so
 * the scaffold compiles and downstream commits have a single import path.
 */

// ── Type bucketing (run / strength / recovery)
//    Mirrors components/cadence/Recent.jsx PIP_MAP, kept independent so
//    future divergence (e.g. "long" run highlighting) lives here.
const BUCKET = {
  run: 'run',
  swim: 'run',
  cycle: 'run',
  hike: 'run',
  gym: 'strength',
  functional: 'strength',
  strength: 'strength',
  yoga: 'recovery',
  stretch: 'recovery',
  recovery: 'recovery',
  walk: 'recovery',
  walking: 'recovery',
  custom: 'recovery',
}

export function effectiveType(a) {
  return a?.custom_type || a?.strava_type || 'custom'
}

export function typeBucket(a) {
  return BUCKET[effectiveType(a)] || 'recovery'
}

export function effectiveName(a) {
  return a?.custom_name || a?.data?.name || 'Activity'
}

// Source: manual entries carry data.manual=true. Whoop-sourced activities
// do not currently exist; the function will still return 'whoop' when a
// future importer sets data.source='whoop' on an activity row, so the
// markup wired into the row needs no future change.
export function activitySource(a) {
  if (a?.data?.source === 'whoop') return 'whoop'
  if (a?.data?.manual) return 'manual'
  return 'strava'
}

// ── Formatters
export function fmtKm(meters) {
  if (!meters) return null
  return (meters / 1000)
}

export function fmtDuration(seconds) {
  if (!isFinite(seconds) || seconds <= 0) return null
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.round(seconds % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function fmtPace(meters, seconds) {
  if (!meters || !seconds) return null
  const km = meters / 1000
  const mins = seconds / 60
  const dec = mins / km
  const m = Math.floor(dec)
  const s = Math.round((dec - m) * 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export function fmtHoursColon(secondsTotal) {
  if (!isFinite(secondsTotal) || secondsTotal <= 0) return '0:00'
  const h = Math.floor(secondsTotal / 3600)
  const m = Math.floor((secondsTotal % 3600) / 60)
  return `${h}:${m.toString().padStart(2, '0')}`
}

// Returns { num: "10", dow: "SUN", mon: "MAY" } for an activity date.
export function fmtRowDate(iso) {
  if (!iso) return { num: '—', dow: '', mon: '' }
  const d = new Date(iso)
  const num = d.getDate().toString().padStart(2, '0')
  const dow = d.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase()
  const mon = d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()
  return { num, dow, mon }
}

// Format "Last sync HH:MM" if today, else "Nd ago".
export function fmtLastSync(iso) {
  if (!iso) return 'Never synced'
  const d = new Date(iso)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) {
    const hh = d.getHours().toString().padStart(2, '0')
    const mm = d.getMinutes().toString().padStart(2, '0')
    return `Last sync ${hh}:${mm}`
  }
  const days = Math.max(1, Math.floor((now - d) / 86400000))
  return `Last sync ${days}d ago`
}

// Monday-anchored ISO week start.
export function startOfWeek(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const dow = d.getDay() === 0 ? 6 : d.getDay() - 1
  d.setDate(d.getDate() - dow)
  return d
}
