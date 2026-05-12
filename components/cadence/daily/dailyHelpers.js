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

const localIso = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Today as YYYY-MM-DD (local time).
export function todayIso() {
  return localIso()
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
    const iso = localIso(d)
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
  const next = localIso(d)
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

// Returns { hours, minutes } for the duration between two "HH:MM" strings,
// handling overnight crossings (bedtime > wakeTime wraps past midnight).
export function computeSleepDuration(bedtime, wakeTime) {
  if (!bedtime || !wakeTime) return null
  const [bh, bm] = bedtime.split(':').map(Number)
  const [wh, wm] = wakeTime.split(':').map(Number)
  if ([bh, bm, wh, wm].some(isNaN)) return null
  const bedMins  = bh * 60 + bm
  const wakeMins = wh * 60 + wm
  const durMins  = wakeMins >= bedMins ? wakeMins - bedMins : 1440 - bedMins + wakeMins
  if (durMins === 0) return null
  return { hours: Math.floor(durMins / 60), minutes: durMins % 60 }
}

// ── Form scaffolding (shape mirrors the legacy mkEmpty in WGHub.jsx)
//   body.steps is manual-only. body.caloriesOut falls back to
//   whoop.energy_burned when the log field is empty.
export function mkEmptyForm() {
  return {
    body: {
      rhr: '', hrv: '', weight: '', weightTime: '',
      steps: '', caloriesOut: '',
    },
    sleep:     { sleepScore: '', recoveryScore: '', hoursSlept: '' },
    nutrition: { calories: '', protein: '', carbs: '' },
    lifts:     [],
    feelings:  { mood: null, journal: '' },
    schedule:  { bedtime: null, wakeTime: null },
  }
}

// Hydrate a fresh form from a persisted log entry (or empty when absent),
// with optional Whoop pre-fill for the five fields Whoop tracks. When a
// log field is empty, fall back to whoop[date]'s matching value so the
// user has a starting point to edit; once they touch any field, the
// full form snapshot saves to logs, "promoting" the Whoop values to
// log-owned values for that date.
export function loadFormFromLog(log, whoop) {
  const empty = mkEmptyForm()
  const base = !log ? empty : {
    body:      { ...empty.body,      ...(log.body      || {}) },
    sleep:     { ...empty.sleep,     ...(log.sleep     || {}) },
    nutrition: { ...empty.nutrition, ...(log.nutrition || {}) },
    lifts:     Array.isArray(log.lifts) ? log.lifts : [],
    feelings:  { ...empty.feelings,  ...(log.feelings  || {}) },
    schedule:  { ...empty.schedule,  ...(log.schedule  || {}) },
  }
  if (whoop) {
    const fill = (current, whoopVal, round = true) => {
      if (current != null && current !== '') return current
      if (whoopVal == null) return current
      return round ? String(Math.round(whoopVal)) : String(whoopVal)
    }
    base.body.hrv         = fill(base.body.hrv,         whoop.hrv)
    base.body.rhr         = fill(base.body.rhr,         whoop.rhr)
    base.body.caloriesOut = fill(base.body.caloriesOut, whoop.energy_burned)
    base.sleep.sleepScore    = fill(base.sleep.sleepScore,    whoop.sleep_score)
    base.sleep.recoveryScore = fill(base.sleep.recoveryScore, whoop.recovery_score)
    base.sleep.hoursSlept    = fill(base.sleep.hoursSlept,    whoop.hours_slept, false)
  }
  return base
}

// ── Target band + percentage (mirrors settings/targetState behaviour
// but kept Daily-local so the two pages can drift independently).
//   isWeight       — ±0.5 tolerance band, amber within 2 kg either way
//   lowerIsBetter  — RHR-style
//   default        — higher-is-better
// Returns { band: 'on'|'amber'|'off', pct: number } or null.
export function targetBand(actual, def) {
  const a = parseFloat(actual)
  const t = parseFloat(def?.value)
  if (!isFinite(a) || !isFinite(t) || t === 0) return null
  if (def.isWeight) {
    const diff = Math.abs(a - t)
    const band = diff <= 0.5 ? 'on' : diff <= 2 ? 'amber' : 'off'
    const pct = Math.max(0, 100 - (diff / t) * 500)
    return { band, pct }
  }
  const lower = !!def.lowerIsBetter
  const pct = lower
    ? Math.min(100, (t / a) * 100)
    : Math.min(100, (a / t) * 100)
  const met = lower ? a <= t : a >= t
  const band = met ? 'on' : pct >= 85 ? 'amber' : 'off'
  return { band, pct }
}

// Bar fill variant — moss (no class) for on-target, sand for amber,
// clay for off-target. Returns null for the default moss when band='on'
// so the CSS class string stays clean.
export function fillVariantForBand(band) {
  if (band === 'amber') return 'sand'
  if (band === 'off')   return 'clay'
  return null
}

// Week-over-week weight delta — actual minus 7-day-ago.
// Returns null if either point is missing.
export function weeklyWeightDelta(date, logs) {
  const today = parseFloat(logs?.[date]?.body?.weight)
  if (!isFinite(today)) return null
  const prev = shiftIso(date, -7)
  if (!prev) return null
  const before = parseFloat(logs?.[prev]?.body?.weight)
  if (!isFinite(before)) return null
  return today - before
}

// Weight helper text — chevron + week delta + above/below target.
// Returns { chevron, tone, text } or null when there's no weight yet.
//   chevron — "▲ 1.4 kg" / "▼ 0.8 kg" / null
//   tone    — 'up' | 'down' | 'flat' (drives the .pct colour)
//   text    — "this week · 5.2 kg above target" / similar
export function buildWeightHelper(actualStr, target, weekDelta) {
  const a = parseFloat(actualStr)
  if (!isFinite(a) || !target?.value) return null
  const diff = a - parseFloat(target.value)
  const above = diff > 0.5
    ? `${diff.toFixed(1)} kg above target`
    : diff < -0.5
      ? `${Math.abs(diff).toFixed(1)} kg below target`
      : 'on target'

  let chevron = null
  let tone = 'flat'
  if (weekDelta != null && Math.abs(weekDelta) > 0.1) {
    // For a goal-weight metric, dropping (▼) toward target is positive,
    // gaining away from target is negative. We don't know the user's
    // direction, so colour the chevron by raw direction: gain → clay,
    // loss → moss. The mockup uses ▼ down=clay for above-target gain.
    chevron = weekDelta > 0
      ? `▲ ${weekDelta.toFixed(1)} kg`
      : `▼ ${Math.abs(weekDelta).toFixed(1)} kg`
    tone = weekDelta > 0 ? 'down' : 'up'
  }
  return { chevron, tone, text: `this week · ${above}` }
}

// Vitals helper — semantic-aware ▲/▼ delta against a target with a
// tolerance band. Arrow reflects literal direction; tone reflects
// movement toward the goal (moss = better, clay = worse).
//
//   higher-is-better (HRV, sleep score, recovery, hours slept):
//     actual > target  → ▲ moss   "▲ 5 vs target"
//     actual < target  → ▼ clay   "▼ 15 vs target"
//   lower-is-better (RHR):
//     actual < target  → ▼ moss
//     actual > target  → ▲ clay
//
//   `decimals` formats the magnitude (1 for hoursSlept, 0 for others)
//   so "0.5" reads naturally for sub-unit metrics without padding ints.
export function buildVitalsHelper(actualStr, target, decimals = 0) {
  const a = parseFloat(actualStr)
  const t = parseFloat(target?.value)
  if (!isFinite(a) || !isFinite(t) || t === 0) return null
  const lower = !!target.lowerIsBetter
  const diff = a - t
  const tolerance = decimals > 0 ? 0.25 : 0.5
  if (Math.abs(diff) <= tolerance) {
    return { chevron: '●', tone: 'flat', text: 'on target' }
  }
  const arrow = diff > 0 ? '▲' : '▼'
  const better = lower ? diff < 0 : diff > 0
  const tone = better ? 'up' : 'down'
  const mag = decimals > 0
    ? Math.abs(diff).toFixed(decimals)
    : Math.round(Math.abs(diff)).toString()
  return {
    chevron: `${arrow} ${mag}`,
    tone,
    text: 'vs target',
  }
}

// Macro helper text — "97% · 5 g short" / "102% · 12 g over" / "on target".
export function buildMacroHelper(actualStr, target, unit) {
  const a = parseFloat(actualStr)
  const t = parseFloat(target?.value)
  if (!isFinite(a) || !isFinite(t) || t === 0) return null
  const pct = Math.round((a / t) * 100)
  const diff = t - a
  let suffix
  if (Math.abs(diff) < 1) {
    suffix = 'on target'
  } else if (diff > 0) {
    suffix = `${Math.round(diff)} ${unit} short`
  } else {
    suffix = `${Math.abs(Math.round(diff))} ${unit} over`
  }
  const tone = pct >= 95 ? 'up' : pct >= 85 ? 'up' : 'down'
  return { chevron: `${pct}%`, tone, text: `of target · ${suffix}` }
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

// ── Lift PB helpers
// Epley 1RM estimate. For bodyweight lifts (weight === 0), returns null
// so callers can fall back to reps-based comparison instead.
export function epley1RM(weight, reps) {
  if (weight == null || reps == null) return null
  const w = parseFloat(weight)
  const r = parseInt(reps, 10)
  if (!isFinite(w) || !isFinite(r) || r < 1) return null
  if (w === 0) return null
  return w * (1 + r / 30)
}

// Build a lookup of { exercise → { max1RM, maxReps } } from all log dates
// except `excludeDate`. Used to detect PBs against historical data.
export function buildLiftHistory(allLogs, excludeDate) {
  const history = {}
  Object.entries(allLogs || {}).forEach(([date, log]) => {
    if (date === excludeDate) return
    const lifts = Array.isArray(log?.lifts) ? log.lifts : []
    lifts.forEach(({ exercise, weight, reps }) => {
      if (!exercise) return
      const orm = epley1RM(weight, reps)
      const r   = parseInt(reps, 10) || 0
      if (!history[exercise]) history[exercise] = { max1RM: null, maxReps: 0 }
      if (orm != null && (history[exercise].max1RM == null || orm > history[exercise].max1RM)) {
        history[exercise].max1RM = orm
      }
      if (r > history[exercise].maxReps) history[exercise].maxReps = r
    })
  })
  return history
}

// Returns true if this lift entry is a personal best vs historical data.
// For bodyweight (weight === 0): reps-based comparison.
// For weighted: Epley 1RM comparison.
export function isLiftPB(lift, history) {
  const { exercise, weight, reps } = lift
  if (!exercise) return false
  const prev = history[exercise]
  const w = parseFloat(weight)
  const r = parseInt(reps, 10) || 0
  if (w === 0 || !isFinite(w)) {
    // Bodyweight: PB if reps > historical max reps
    return r > (prev?.maxReps ?? 0)
  }
  const orm = epley1RM(w, r)
  if (orm == null) return false
  return prev?.max1RM == null || orm > prev.max1RM
}
