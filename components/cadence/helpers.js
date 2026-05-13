/**
 * Shared data helpers for the Cadence dashboard.
 * Pure functions; mirror the existing logic in components/WGHub.jsx
 * so the dashboard reads from the same merged Whoop + Strava + log
 * shape without duplicating database access.
 */

export const localIso = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const todayStr = () => localIso()

export function daysWindow(n, endDate = new Date()) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(endDate)
    d.setDate(d.getDate() - (n - 1 - i))
    return localIso(d)
  })
}

// Merge per-date Whoop snapshot into the log, with LOGS PRIMARY and
// Whoop as fallback. Previously Whoop won (auto-sync model); since
// HRV/RHR/Recovery/Sleep moved to manual-entry fields on Daily Data,
// the user's typed value owns the field and Whoop only fills in when
// the log field is empty. Same Whoop-fills-when-empty contract as
// loadFormFromLog on the Daily Data form.
//
// pick() treats empty strings as missing so log: '' still falls back
// to whoop's value rather than holding an empty value.
const pick = (logVal, whoopVal) => {
  if (logVal != null && logVal !== '') return logVal
  if (whoopVal != null) return whoopVal
  return ''
}

export function mergeWhoopForDate(date, log, whoopData) {
  const w = whoopData?.[date]
  if (!w) return log || {}
  return {
    ...log,
    body: {
      ...(log?.body || {}),
      hrv:         pick(log?.body?.hrv,         w.hrv),
      rhr:         pick(log?.body?.rhr,         w.rhr),
      caloriesOut: pick(log?.body?.caloriesOut, w.energy_burned),
      weight:      log?.body?.weight || '',
    },
    sleep: {
      ...(log?.sleep || {}),
      sleepScore:    pick(log?.sleep?.sleepScore,    w.sleep_score),
      recoveryScore: pick(log?.sleep?.recoveryScore, w.recovery_score),
      hoursSlept:    pick(log?.sleep?.hoursSlept,    w.hours_slept),
      bedTime:       log?.sleep?.bedTime || w.bed_time || '',
    },
  }
}

export function kmByDateMap(activities) {
  const map = {}
  ;(activities || []).forEach(a => {
    const type = a.custom_type || a.strava_type || 'custom'
    if (type !== 'run') return
    const km = (a.data?.distance || 0) / 1000
    if (!km) return
    const date = (a.start_date || '').split('T')[0]
    if (!date) return
    map[date] = (map[date] || 0) + km
  })
  return map
}

export function getKmForDate(date, logs, stravaKmMap) {
  if (stravaKmMap[date]) return stravaKmMap[date]
  const log = logs?.[date]
  if (log?.exercise?.runs) {
    return log.exercise.runs.reduce((s, r) => s + (parseFloat(r.distance) || 0), 0)
  }
  return parseFloat(log?.exercise?.running?.distance) || 0
}

export function computeLoadForDay(date, logs, activities, stravaKmMap) {
  const km = getKmForDate(date, logs, stravaKmMap)
  const acts = (activities || []).filter(a => {
    const dt = (a.start_date || '').split('T')[0]
    return dt === date
  })
  const gymMins = acts
    .filter(a => (a.custom_type || a.strava_type) === 'gym')
    .reduce((t, a) => t + (a.data?.moving_time || 0) / 60, 0)
  const yogaMins = acts
    .filter(a => (a.custom_type || a.strava_type) === 'yoga')
    .reduce((t, a) => t + (a.data?.moving_time || 0) / 60, 0)
  return km + (gymMins / 60) * 8 + (yogaMins / 60) * 3
}

// Monday-anchored week start (ISO week)
export function startOfWeek(date = new Date()) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const dow = d.getDay() === 0 ? 6 : d.getDay() - 1
  d.setDate(d.getDate() - dow)
  return d
}

// "7.4" hours → "7h 24m"
export function formatHoursMinutes(hoursDecimal) {
  if (hoursDecimal === null || hoursDecimal === undefined || hoursDecimal === '' || isNaN(parseFloat(hoursDecimal))) return null
  const total = parseFloat(hoursDecimal)
  const h = Math.floor(total)
  const m = Math.round((total - h) * 60)
  return `${h}h ${m}m`
}

// "7.4" hours → "7:24"
export function formatHoursColon(hoursDecimal) {
  if (hoursDecimal === null || hoursDecimal === undefined || hoursDecimal === '' || isNaN(parseFloat(hoursDecimal))) return null
  const total = parseFloat(hoursDecimal)
  const h = Math.floor(total)
  const m = Math.round((total - h) * 60)
  return `${h}:${m.toString().padStart(2, '0')}`
}

export function mean(values) {
  const clean = values.map(v => parseFloat(v)).filter(v => !isNaN(v))
  if (!clean.length) return null
  return clean.reduce((a, b) => a + b, 0) / clean.length
}

// Build an SVG path string for a sparkline from a values array.
// Skips null/undefined/NaN values. Returns null if fewer than 2 valid points.
export function sparklinePath(values, width, height, pad = 2) {
  if (!values || values.length < 2) return null
  const clean = values.map(v => {
    const n = typeof v === 'number' ? v : parseFloat(v)
    return isFinite(n) ? n : null
  })
  const non = clean.filter(v => v !== null)
  if (non.length < 2) return null
  const min = Math.min(...non)
  const max = Math.max(...non)
  const range = max - min || 1
  const span = clean.length - 1
  const points = []
  clean.forEach((v, i) => {
    if (v === null) return
    const x = (i / span) * width
    const y = pad + (1 - (v - min) / range) * (height - 2 * pad)
    points.push([x, y])
  })
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
}

// Hero context sentence — deterministic rules from recovery + sleep + HRV.
// Single Fraunces line, sentence case, no exclamation, no fake specifics.
export function heroContext({ recovery, hrvDelta7d, hoursSlept }) {
  if (recovery == null) return 'Connect Whoop to see today’s recovery.'
  const sleepGood = hoursSlept != null && parseFloat(hoursSlept) >= 7
  const hrvUp = hrvDelta7d != null && hrvDelta7d > 0
  if (recovery >= 80) {
    return sleepGood
      ? 'A strong day to push — your legs are ready and sleep was solid.'
      : 'A strong day to push — the body’s reading green.'
  }
  if (recovery >= 70) {
    return hrvUp && sleepGood
      ? 'A good day to push — your legs are ready, sleep was solid, HRV’s lifted overnight.'
      : 'A good day to push — the signals are clean.'
  }
  if (recovery >= 60) {
    return 'Run easy today — the body’s not fully back.'
  }
  if (recovery >= 50) {
    return 'Keep it light — recovery’s down and the legs aren’t ready.'
  }
  return 'Recovery day. Walk, stretch, don’t run hard.'
}
