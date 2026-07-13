// ─── Date helpers (inline — no cross-boundary imports) ───────────────────────

function toMonday(d) {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  const dow = date.getDay() === 0 ? 6 : date.getDay() - 1
  date.setDate(date.getDate() - dow)
  return date
}

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function earliestLogMonday(logs) {
  const dates = Object.keys(logs || {}).sort()
  if (!dates.length) return isoDate(toMonday(new Date()))
  return isoDate(toMonday(new Date(dates[0] + 'T00:00:00')))
}

function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }

// ─── Run-distance parsing ─────────────────────────────────────────────────────
// Parses the km value out of a run session's free-text details. `km` sits
// OUTSIDE the capture group, so parseFloat takes the leading number (a range
// like "15–20 km" yields 15). Returns null — never 0 — when no km is present.
// Shared by the Training Distance stat, WeekGrid and TodayCards.
const RUN_KM_RE = /\b(\d+(?:[–-]\d+)?(?:\.\d+)?)\s*km\b/i
export function parseRunKm(details) {
  const m = String(details || '').match(RUN_KM_RE)
  return m ? parseFloat(m[1]) : null
}

// Sum of the km across a resolved week's run sessions. Only type === 'run'
// contributes; a deload Saturday has no run session and so falls out with no
// guard. Returns null — not 0 — when there is no week (before the start date
// or after the last week), so callers can render an em dash rather than a lie.
export function sumWeekKm(week) {
  if (!week?.length) return null
  let total = 0
  for (const day of week) {
    for (const s of (day?.sessions || [])) {
      if (s.type !== 'run') continue
      const km = parseRunKm(s.details)
      if (km != null) total += km
    }
  }
  return Math.round(total * 10) / 10
}

// ─── Session-type taxonomy (single source of truth) ──────────────────────────
// DISCIPLINE_BY_TYPE — what a session actually IS (fine, per-type). Coarse glance
// surfaces pass the discipline through COARSE_BY_DISCIPLINE. No surface defines
// its own map. 'recovery' belongs with yoga; 'custom' is its own bucket.
export const DISCIPLINE_BY_TYPE = {
  run: 'run', swim: 'run', cycle: 'run', hike: 'run',
  gym: 'gym', strength: 'gym',
  functional: 'functional',
  climbing: 'climb',
  yoga: 'yoga', stretch: 'yoga', recovery: 'yoga',
  rest: 'rest',
  custom: 'custom',
}
export const COARSE_BY_DISCIPLINE = {
  run: 'run',
  gym: 'strength', functional: 'strength',
  yoga: 'recovery',
  climb: 'climb',
  rest: 'rest',
  custom: 'recovery', // a custom session is activity, not a rest day
}

// Fine discipline for a session type (unknown → custom, a neutral bucket).
export function disciplineForType(type) {
  return DISCIPLINE_BY_TYPE[type] || 'custom'
}
// Coarse glance bucket for a session type.
export function coarseForType(type) {
  return COARSE_BY_DISCIPLINE[disciplineForType(type)] || 'rest'
}

// ─── Plan shape ───────────────────────────────────────────────────────────────
// New shape: { weeks: [ <7-day-array> | { repeatsWeek: N } ], meta: { startDate: 'YYYY-MM-DD', name: string } }
// Legacy shape: 7-element array — normalised on load

const PLAN_DAYS_META = [
  { day: 'Monday',    short: 'MON' },
  { day: 'Tuesday',   short: 'TUE' },
  { day: 'Wednesday', short: 'WED' },
  { day: 'Thursday',  short: 'THU' },
  { day: 'Friday',    short: 'FRI' },
  { day: 'Saturday',  short: 'SAT' },
  { day: 'Sunday',    short: 'SUN' },
]

export function buildEmptyWeek() {
  return PLAN_DAYS_META.map(meta => ({ ...meta, sessions: [] }))
}

// ─── Rat Race 100 programme (FI-001) ─────────────────────────────────────────
// 51-week build for Rat Race 100: Bamburgh to Edinburgh (race 3 Jul 2027).
// Deterministic. Base week 95 km; each build week ×1.05 compounding; the weekly
// TOTAL is capped at 160 km (first reached week 15, then held). Every 4th week
// is a deload — the previous build week's runs minus 5 km with the long run
// skipped, and the ×1.05 multiplier does not advance. Non-running sessions are
// identical on every week; only running volume changes. Week 51 is race week.

const RR_BASE   = { mon: 15, tue: 10, wed: 15, thu: 15, sat: 30, sun: 10 } // run km
const RR_CAP_M  = 160 / 95 // multiplier at which the weekly total reaches 160
const r1        = (v) => Math.round(v * 10) / 10
const runDetail = (label, km) => `${label} · ${r1(km).toFixed(1)} km`

// One week's 7-day array from a run-distance map. `runs.<day> === null` means no
// run that day (Saturday long run is null on deload weeks). Non-run sessions are
// the fixed template; the run leads on days that have one, hangboard is last.
function rrWeek(runs) {
  const S = (type, details) => ({ type, details })
  const byDay = {
    Monday: [
      runs.mon != null && S('run', runDetail('Zone 2 run', runs.mon)),
      S('gym', 'Chest / triceps'),
      S('functional', 'Hip mobility, easy legs, pull-up variations'),
      S('climbing', 'Hangboard · no-weight dead hangs · ~10 min'),
    ],
    Tuesday: [
      runs.tue != null && S('run', runDetail('Recovery run', runs.tue)),
      S('climbing', 'Bouldering · endurance, spray wall'),
      S('functional', 'Weighted hangboard + weighted pull-ups'),
      S('climbing', 'Hangboard'),
    ],
    Wednesday: [
      runs.wed != null && S('run', runDetail('Zone 2 run', runs.wed)),
      S('functional', 'Hip mobility, easy legs, pull-up variations'),
      S('custom', 'Tennis'),
      S('climbing', 'Hangboard'),
    ],
    Thursday: [
      runs.thu != null && S('run', runDetail('Zone 2 run', runs.thu)),
      S('gym', 'Leg day'),
      S('functional', 'Hip mobility, easy legs, pull-up variations'),
      S('climbing', 'Hangboard'),
    ],
    Friday: [
      S('climbing', 'Bouldering · relaxed'),
      S('gym', 'Shoulders / biceps'),
      S('climbing', 'Hangboard'),
    ],
    Saturday: [
      runs.sat != null && S('run', runDetail('Long run · Zone 2', runs.sat)),
      S('functional', 'Hip mobility, easy legs, pull-up variations'),
      S('climbing', 'Hangboard'),
    ],
    Sunday: [
      runs.sun != null && S('run', runDetail('Zone 2 recovery run', runs.sun)),
      S('climbing', 'Bouldering · long session, projects'),
      S('custom', 'Tennis'),
      S('climbing', 'Hangboard'),
    ],
  }
  return PLAN_DAYS_META.map(meta => ({
    ...meta,
    sessions: byDay[meta.day].filter(Boolean).map(s => ({ id: uid(), ...s })),
  }))
}

// Race week (week 51). Easy shake-outs, two rest days, then the 48-hour race.
// No gym, bouldering, tennis or weighted work.
function rrRaceWeek() {
  const S = (type, details) => ({ id: uid(), type, details })
  const byDay = {
    Monday:    [S('run', 'Easy · 8.0 km'), S('climbing', 'Hangboard')],
    Tuesday:   [S('run', 'Easy · 6.0 km'), S('climbing', 'Hangboard')],
    Wednesday: [S('run', 'Easy · 5.0 km'), S('climbing', 'Hangboard')],
    Thursday:  [S('rest', 'Rest')],
    Friday:    [S('rest', 'Rest — travel')],
    Saturday:  [S('run', 'Race · Rat Race 100: Bamburgh to Edinburgh · 161.0 km')],
    Sunday:    [S('run', 'Race continues · 48-hour event')],
  }
  return PLAN_DAYS_META.map(meta => ({ ...meta, sessions: byDay[meta.day] }))
}

export function buildRatRace100Plan() {
  const weeks = []
  let e = 0            // build-week exponent; deloads do not advance it
  let lastBuild = null // previous build week's UNROUNDED run distances
  for (let wk = 1; wk <= 50; wk++) {
    if (wk % 4 === 0) {
      // Deload — previous build week minus 5 km per run, long run skipped.
      weeks.push(rrWeek({
        mon: r1(lastBuild.mon - 5), tue: r1(lastBuild.tue - 5),
        wed: r1(lastBuild.wed - 5), thu: r1(lastBuild.thu - 5),
        sat: null,                  sun: r1(lastBuild.sun - 5),
      }))
    } else {
      const M = Math.min(Math.pow(1.05, e), RR_CAP_M)
      lastBuild = {
        mon: RR_BASE.mon * M, tue: RR_BASE.tue * M, wed: RR_BASE.wed * M,
        thu: RR_BASE.thu * M, sat: RR_BASE.sat * M, sun: RR_BASE.sun * M,
      }
      e += 1
      weeks.push(rrWeek({
        mon: r1(lastBuild.mon), tue: r1(lastBuild.tue), wed: r1(lastBuild.wed),
        thu: r1(lastBuild.thu), sat: r1(lastBuild.sat), sun: r1(lastBuild.sun),
      }))
    }
  }
  weeks.push(rrRaceWeek()) // week 51 — race week
  return { weeks, meta: { startDate: '2026-07-13', name: 'Rat Race 100: Bamburgh to Edinburgh' } }
}

export function getDefaultPlan() {
  return buildRatRace100Plan()
}

// ─── Week resolution ──────────────────────────────────────────────────────────

function weeksBetween(startDateStr, date) {
  const start  = toMonday(new Date(startDateStr + 'T00:00:00'))
  const target = toMonday(new Date(date))
  target.setHours(0, 0, 0, 0)
  return Math.round((target - start) / (7 * 86400000))
}

// Follows repeatsWeek pointers. Returns null on cycle or out-of-bounds.
export function resolveWeek(weeks, idx, seen = new Set()) {
  if (idx < 0 || idx >= weeks.length) return null
  if (seen.has(idx)) return null
  const w = weeks[idx]
  if (!w) return null
  if (Array.isArray(w)) return w
  if (w.repeatsWeek != null) {
    seen.add(idx)
    return resolveWeek(weeks, w.repeatsWeek, seen)
  }
  return null
}

// Returns the resolved 7-day array for the week containing `date`, or null if
// the date is outside the programme or a cycle is detected.
export function getCurrentWeek(plan, date = new Date()) {
  if (Array.isArray(plan)) return plan // backward compat with legacy shape
  if (!plan?.weeks || !plan?.meta?.startDate) return null
  if (plan.weeks.length === 1) return resolveWeek(plan.weeks, 0) // single-week: repeat indefinitely
  const idx = weeksBetween(plan.meta.startDate, date)
  if (idx < 0 || idx >= plan.weeks.length) return null
  return resolveWeek(plan.weeks, idx)
}

// Returns positioning metadata for banners and eyebrow labels.
export function getPlanPosition(plan, date = new Date()) {
  if (Array.isArray(plan)) return { idx: 0, total: 1, before: false, after: false }
  if (!plan?.weeks || !plan?.meta?.startDate) return { idx: 0, total: 1, before: false, after: false }
  if (plan.weeks.length === 1) return { idx: 0, total: 1, before: false, after: false } // single-week: no expiry
  const idx   = weeksBetween(plan.meta.startDate, date)
  const total = plan.weeks.length
  return { idx, total, before: idx < 0, after: idx >= total }
}

// ─── normalise ────────────────────────────────────────────────────────────────

export function normalisePlan(rawValue, logs) {
  // No plan row → no plan. A new user gets an EMPTY plan, never a clone of
  // someone else's default (FC-075a; locked decision). The plan views render an
  // empty state pointing at the builder (FC-035). Do not synthesise here.
  if (!rawValue) return null
  if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue) && rawValue.weeks && rawValue.meta) {
    return rawValue
  }
  if (Array.isArray(rawValue)) {
    return {
      weeks: [rawValue],
      meta: { startDate: earliestLogMonday(logs), name: 'Training plan' },
    }
  }
  return getDefaultPlan()
}
