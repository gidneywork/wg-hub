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

const localIso = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

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

// ── Date windows
function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

// Returns ISO YYYY-MM-DD strings for the last `n` days, ending today (inclusive).
export function rollingDays(n, endDate = new Date()) {
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(endDate)
    d.setDate(d.getDate() - i)
    out.push(localIso(d))
  }
  return out
}

// "12 Apr → 11 May" for the 30-day window ending today.
export function rollingScopeLabel(days = 30, endDate = new Date()) {
  const end = new Date(endDate)
  const start = new Date(endDate)
  start.setDate(start.getDate() - (days - 1))
  const fmt = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `${fmt(start)} → ${fmt(end)}`
}

// Filter activities to those whose start_date falls within [startInclusive, endInclusive].
export function activitiesInRange(activities, startInclusive, endInclusive) {
  const lo = startOfDay(startInclusive).getTime()
  const hi = startOfDay(endInclusive).getTime() + 86400000 - 1
  return (activities || []).filter(a => {
    if (!a?.start_date) return false
    const t = new Date(a.start_date).getTime()
    return t >= lo && t <= hi
  })
}

// km per day for running activities, keyed by YYYY-MM-DD.
export function dayKmMap(activities) {
  const map = {}
  ;(activities || []).forEach(a => {
    if (typeBucket(a) !== 'run') return
    const km = (a?.data?.distance || 0) / 1000
    if (!km) return
    const date = (a.start_date || '').split('T')[0]
    if (!date) return
    map[date] = (map[date] || 0) + km
  })
  return map
}

// Density bars for the 30-day SVG strip. Each entry:
//   { date, km, rest, today, x, y, height, delay }
// Bars are 14px wide on a 20px column pitch; the strip is 56px tall with a
// dashed axis at y=50, leaving a 48px headroom. The tallest bar in the
// window normalises to full height; rest days get a 4px stub. `delay` is
// the staggered animation-delay matching the mockup (starts 700ms, +30ms
// per bar) so the strip composes left-to-right after the page rise.
export function densityBars(kmMap, endDate = new Date()) {
  const dates = rollingDays(30, endDate)
  const values = dates.map(d => kmMap[d] || 0)
  const maxKm = Math.max(0, ...values)
  const todayIso = localIso(endDate)
  const colPitch = 20
  const barWidth = 14
  const axisY = 50
  const headroom = 48
  return dates.map((date, i) => {
    const km = values[i]
    const rest = km === 0
    const today = date === todayIso
    const height = rest ? 4 : Math.max(6, Math.round((km / (maxKm || 1)) * headroom))
    const y = axisY - height
    return {
      date,
      km,
      rest,
      today,
      x: i * colPitch,
      y,
      width: barWidth,
      height,
      delay: 700 + i * 30,
    }
  })
}

// Three-band deterministic description for the density card.
// Compares the rolling-30d total km against the prior 30d.
//   > +5%   → "A heavier block this month — X km vs the prior 30 days' Y km."
//   ±5%     → "Steady base — X km, in line with the prior 30 days."
//   < -5%   → "A lighter block — X km, Y km below the prior 30 days."
export function densityDesc(kmMap, endDate = new Date()) {
  const recentDates = rollingDays(30, endDate)
  const prior = new Date(endDate)
  prior.setDate(prior.getDate() - 30)
  const priorDates = rollingDays(30, prior)
  const recent = recentDates.reduce((s, d) => s + (kmMap[d] || 0), 0)
  const before = priorDates.reduce((s, d) => s + (kmMap[d] || 0), 0)
  const r = recent.toFixed(1)
  const b = before.toFixed(1)
  if (before === 0 && recent === 0) {
    return 'No running logged in the last 30 days.'
  }
  if (before === 0) {
    return `Base building — ${r} km in the last 30 days.`
  }
  const ratio = recent / before
  if (ratio >= 1.05) {
    return `A heavier block this month — ${r} km vs the prior 30 days' ${b} km.`
  }
  if (ratio <= 0.95) {
    const diff = (before - recent).toFixed(1)
    return `A lighter block — ${r} km, ${diff} km below the prior 30 days.`
  }
  return `Steady base — ${r} km, in line with the prior 30 days.`
}

// ── Summary stats (rolling 30d vs prior 30d)
// Returns numbers for the three stat tiles. "this month" in the tile labels
// is interpreted as the rolling-30-day window ending today, matching the
// density card and the brand voice (live, not calendar-month boundaries).
export function summaryStats(activities, endDate = new Date()) {
  const end = new Date(endDate)
  const recentStart = new Date(endDate); recentStart.setDate(recentStart.getDate() - 29)
  const priorEnd = new Date(recentStart); priorEnd.setDate(priorEnd.getDate() - 1)
  const priorStart = new Date(priorEnd); priorStart.setDate(priorStart.getDate() - 29)

  const recent = activitiesInRange(activities, recentStart, end)
  const prior  = activitiesInRange(activities, priorStart, priorEnd)

  const sessions = recent.length
  const sessionsPrior = prior.length

  const totalSeconds = recent.reduce((s, a) => s + (a?.data?.moving_time || 0), 0)
  const priorSeconds = prior.reduce((s, a) => s + (a?.data?.moving_time || 0), 0)
  const longestSeconds = recent.reduce((m, a) => Math.max(m, a?.data?.moving_time || 0), 0)

  // Avg HR — weighted by moving_time, runs only.
  const runs = recent.filter(a => typeBucket(a) === 'run' && a?.data?.average_heartrate)
  let avgHr = null
  if (runs.length) {
    const num = runs.reduce((s, a) => s + a.data.average_heartrate * (a.data.moving_time || 0), 0)
    const den = runs.reduce((s, a) => s + (a.data.moving_time || 0), 0)
    avgHr = den > 0 ? Math.round(num / den) : null
  }
  const hrValues = runs.map(a => a.data.average_heartrate).filter(Boolean)
  const hrPeak = hrValues.length ? Math.round(Math.max(...hrValues)) : null
  const hrLow  = hrValues.length ? Math.round(Math.min(...hrValues)) : null

  return {
    sessions,
    sessionsDelta: sessions - sessionsPrior,
    totalSeconds,
    timeDeltaSeconds: totalSeconds - priorSeconds,
    longestSeconds,
    avgHr,
    hrPeak,
    hrLow,
  }
}

// "H:MM" from seconds.
export function fmtHM(seconds) {
  if (!isFinite(seconds) || seconds <= 0) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}:${m.toString().padStart(2, '0')}`
}

// Signed delta string for the time tile: "+2:08" / "-0:34" / "—".
export function fmtDeltaHM(seconds) {
  if (!isFinite(seconds) || seconds === 0) return null
  const sign = seconds > 0 ? '+' : '−'
  return `${sign}${fmtHM(Math.abs(seconds))}`
}

// ── Range filtering
// this-week  → Monday of this week through today (inclusive)
// this-month → 1st of this calendar month through today
// 3-months   → rolling 90 days ending today
// this-year  → Jan 1 of this year through today
// all-time   → everything
export function rangeBounds(range, endDate = new Date()) {
  const end = startOfDay(endDate)
  if (range === 'this-week')  return { start: startOfWeek(end), end }
  if (range === 'this-month') return { start: new Date(end.getFullYear(), end.getMonth(), 1), end }
  if (range === '3-months') {
    const s = new Date(end); s.setDate(s.getDate() - 89)
    return { start: s, end }
  }
  if (range === 'this-year') return { start: new Date(end.getFullYear(), 0, 1), end }
  return { start: null, end: null } // all-time
}

export function filterByRange(activities, range, endDate = new Date()) {
  const { start, end } = rangeBounds(range, endDate)
  if (!start || !end) return activities.slice()
  return activitiesInRange(activities, start, end)
}

// ── PB heuristic (Will's spec)
// Distance brackets (in metres) — moving_time within each bracket decides
// the PB. An activity belongs to at most one bracket (the first that
// matches in declaration order). Strength sessions are not eligible.
const PB_BRACKETS = [
  { key: '5km',      min: 4700,  max: 5300  },
  { key: '10km',     min: 9500,  max: 10500 },
  { key: 'half',     min: 20600, max: 21600 },
  { key: 'marathon', min: 41500, max: 42600 },
]
// Longest-run bracket: anything ≥ 22km that isn't in the half/marathon
// bracket. Half = 20.6–21.6km, marathon = 41.5–42.6km, so the gap to
// avoid is 21.6–22.0km (already filtered out by the 22km floor) and
// 41.5–42.6km (explicit). 22000–41499 and 42601+ all qualify.
function pbBracket(a) {
  if (typeBucket(a) !== 'run') return null
  const m = a?.data?.distance
  if (!m) return null
  for (const b of PB_BRACKETS) {
    if (m >= b.min && m <= b.max) return b.key
  }
  if (m >= 22000 && !(m >= 41500 && m <= 42600)) return 'longest'
  return null
}

// Returns a Set of activity ids that are the fastest-ever within their
// distance bracket. Computed over the full activity history (not the
// filtered view) so a PB tag remains stable as filters change.
export function computePBIds(activities) {
  const byBracket = {}
  ;(activities || []).forEach(a => {
    const bracket = pbBracket(a)
    if (!bracket) return
    const t = a?.data?.moving_time
    if (!isFinite(t) || t <= 0) return
    if (!byBracket[bracket] || t < byBracket[bracket].time) {
      byBracket[bracket] = { id: a.id, time: t }
    }
  })
  return new Set(Object.values(byBracket).map(x => x.id))
}

// ── Filtering predicates (type / source / search)
export function matchesType(a, typeFilter) {
  if (typeFilter === 'all') return true
  return typeBucket(a) === typeFilter
}

export function matchesSource(a, sourceFilter) {
  if (sourceFilter === 'all') return true
  return activitySource(a) === sourceFilter
}

export function matchesSearch(a, search) {
  if (!search || !search.trim()) return true
  const q = search.trim().toLowerCase()
  const name = effectiveName(a).toLowerCase()
  const sub = (a?.data?.sport_type || a?.strava_type || a?.custom_type || '').toLowerCase()
  const notes = (a?.notes || '').toLowerCase()
  return name.includes(q) || sub.includes(q) || notes.includes(q)
}

export function applyFilters(activities, { typeFilter, sourceFilter, search }) {
  return (activities || []).filter(a =>
    matchesType(a, typeFilter) &&
    matchesSource(a, sourceFilter) &&
    matchesSearch(a, search)
  )
}

// ── Grouping
// Group activities by Monday-anchored week. Returns an array sorted
// descending by week start, each entry { key, weekStart, activities }
// where activities is also sorted descending by start_date.
export function groupByWeek(activities) {
  const buckets = new Map()
  ;(activities || []).forEach(a => {
    if (!a?.start_date) return
    const ws = startOfWeek(new Date(a.start_date))
    const key = ws.toISOString().split('T')[0]
    if (!buckets.has(key)) buckets.set(key, { key, weekStart: ws, activities: [] })
    buckets.get(key).activities.push(a)
  })
  const groups = Array.from(buckets.values())
  groups.forEach(g => g.activities.sort((a, b) => new Date(b.start_date) - new Date(a.start_date)))
  groups.sort((a, b) => b.weekStart - a.weekStart)
  return groups
}

// Week head title — "Week of 4 May".
export function fmtWeekTitle(weekStart) {
  const d = weekStart.getDate()
  const mon = weekStart.toLocaleDateString('en-GB', { month: 'long' })
  return `Week of ${d} ${mon}`
}

// Week head totals — { sessions, km, hours }. km only counts run activities;
// hours is the sum of moving_time across all activities in the week.
export function weekTotals(activities) {
  const sessions = activities.length
  const km = activities.reduce((s, a) => {
    if (typeBucket(a) !== 'run') return s
    return s + ((a?.data?.distance || 0) / 1000)
  }, 0)
  const totalSeconds = activities.reduce((s, a) => s + (a?.data?.moving_time || 0), 0)
  return { sessions, km, hours: fmtHM(totalSeconds) }
}

// Month totals add a PB count to the week totals shape.
export function monthTotals(activities, pbIds) {
  const t = weekTotals(activities)
  const pbCount = activities.filter(a => pbIds.has(a.id)).length
  return { ...t, pbCount }
}

// Group an array of week-groups by calendar month. Each month entry:
//   { key, year, monthIndex, name, weeks }
// where `weeks` is the contiguous subset of weeks whose start lands in
// that calendar month, in original (descending) order.
export function groupWeeksByMonth(weekGroups) {
  const out = []
  let current = null
  for (const wg of weekGroups) {
    const y = wg.weekStart.getFullYear()
    const m = wg.weekStart.getMonth()
    const key = `${y}-${m}`
    if (!current || current.key !== key) {
      const name = wg.weekStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
      current = { key, year: y, monthIndex: m, name, weeks: [] }
      out.push(current)
    }
    current.weeks.push(wg)
  }
  return out
}

// Group month-groups by calendar year. Each year entry:
//   { key, year, scope, months }
// `scope` reads "Jan 1 → today" for the current year and "Jan 1 → Dec 31"
// for closed years.
export function groupMonthsByYear(monthGroups, today = new Date()) {
  const thisYear = today.getFullYear()
  const out = []
  let current = null
  for (const mg of monthGroups) {
    if (!current || current.year !== mg.year) {
      const scope = mg.year === thisYear ? 'Jan 1 → today' : 'Jan 1 → Dec 31'
      current = { key: String(mg.year), year: mg.year, scope, months: [] }
      out.push(current)
    }
    current.months.push(mg)
  }
  return out
}

// ── Row metric helpers (kg top set / exercises for strength rows)
// Strength rows show "kg top set" or "exercises" in the pace column.
// We don't have structured top-set data in the schema; fall back to a
// notes-mined "Xkg" pattern, or return null so the column muted-dashes.
export function strengthMetric(a) {
  if (typeBucket(a) !== 'strength') return null
  const notes = a?.notes || ''
  const kg = notes.match(/(\d{2,3}(?:\.\d)?)\s*kg/i)
  if (kg) return { value: kg[1], unit: 'kg top set' }
  return null
}
