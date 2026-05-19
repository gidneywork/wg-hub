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

function buildDefaultWeek() {
  const raw = [
    { runs: ['1:45–2hrs Easy Run · 150–160bpm · 15–20km'],            func: '100 Pull Ups\n200 Press Ups\n200 Crunches\n200 Shrugs',        gym: 'Chest / Triceps',                     yoga: '30 mins' },
    { runs: ['1hr Zone 2 Easy · 10–12km', '8× Hill Sprints (Pipers Way – full length)'], func: '100 Pull Ups\n200 Press Ups\n200 Crunches\n200 Shrugs (40kg)', gym: 'Bicep / Shoulders',                    yoga: '30 mins' },
    { runs: ['1:45–2hrs Zone 2 Easy · 15–20km'],                      func: '100 Pull Ups\n200 Press Ups\n200 Crunches\n200 Shrugs (40kg)', gym: 'Core Training',                        yoga: '30 mins' },
    { runs: ['10km Easy Run'],                                         func: '100 Pull Ups\n200 Press Ups\n200 Crunches\n200 Shrugs (40kg)', gym: 'Leg Day – focus on running movements', yoga: '30 mins' },
    { rest: true,                                                                                                                             gym: 'Chest / Triceps',                     yoga: '30 mins' },
    { runs: ['Long Run · 40km minimum'],                                                                                                      gym: 'Bicep / Shoulders',                    yoga: '30 mins' },
    { runs: ['10km Recovery Run'],                                     func: '100 Pull Ups\n200 Press Ups\n200 Crunches\n200 Shrugs (40kg)',                                               yoga: '30 mins' },
  ]
  return PLAN_DAYS_META.map((meta, i) => {
    const d = raw[i], sessions = []
    if (d.rest) sessions.push({ id: uid(), type: 'rest',       details: 'Running Rest Day' })
    if (d.runs) d.runs.forEach(r => sessions.push({ id: uid(), type: 'run',        details: r }))
    if (d.func) sessions.push({ id: uid(), type: 'functional', details: d.func })
    if (d.gym)  sessions.push({ id: uid(), type: 'gym',        details: d.gym })
    if (d.yoga) sessions.push({ id: uid(), type: 'yoga',       details: `Yoga · ${d.yoga}` })
    return { ...meta, sessions }
  })
}

export function getDefaultPlan() {
  return {
    weeks: [buildDefaultWeek()],
    meta: { startDate: isoDate(toMonday(new Date())), name: 'Training plan' },
  }
}

export function normalisePlan(rawValue, logs) {
  if (!rawValue) return getDefaultPlan()
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
