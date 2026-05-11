/**
 * Settings helpers — pure functions for the Settings page.
 */

import {
  startOfWeek,
  daysWindow,
  mergeWhoopForDate,
  kmByDateMap,
} from '../helpers'

// Relative time for Strava sync / connected timestamps.
export function timeAgo(iso) {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(hours / 24)
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

// ── Target band + percentage
// Returns { band: 'on'|'amber'|'off', pct: number } or null if there's
// no live actual yet. Band thresholds mirror the legacy targetStatus
// rules (which return hex literals); this version returns enum strings
// and leaves the colour mapping to CSS via class names.
//
//   isWeight       — ±0.5 tolerance band; amber within 2 kg either way
//   lowerIsBetter  — RHR-style: actual ≤ target is on, otherwise pct = t/a
//   default        — higher-is-better: actual ≥ target is on, otherwise pct = a/t
export function targetState(actual, def) {
  if (actual == null || actual === '' || !def?.value) return null
  const a = parseFloat(actual)
  const t = parseFloat(def.value)
  if (isNaN(a) || isNaN(t) || t === 0) return null

  if (def.isWeight) {
    const diff = Math.abs(a - t)
    const band = diff <= 0.5 ? 'on' : diff <= 2 ? 'amber' : 'off'
    // pct = 100 at zero diff, falls 5%/kg-of-target away. Capped at 0.
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

// ── Live current values per target key
// Reads from the existing logs / whoopData / activities shapes that
// WGHub already keeps in state. weeklyKm sums the current Monday-week
// from Strava activities; body/sleep metrics are rolling-7-day means
// over merged Whoop + log data; nutrition is a 7-day mean from logs.
export function currentValues({ logs = {}, whoopData = {}, activities = [] }) {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  // Weekly run km — sum from start of this Monday-week through today.
  const weekStart = startOfWeek(today)
  const weekDates = []
  for (let d = new Date(weekStart); d <= today; d.setDate(d.getDate() + 1)) {
    weekDates.push(d.toISOString().split('T')[0])
  }
  const kmMap = kmByDateMap(activities)
  const weeklyKm = weekDates.reduce((s, d) => s + (kmMap[d] || 0), 0)

  // Most recent recorded weight, walking back from today.
  let weight = null
  const sortedDates = Object.keys(logs).sort().reverse()
  for (const d of sortedDates) {
    const w = parseFloat(logs[d]?.body?.weight)
    if (isFinite(w) && w > 0) { weight = w; break }
  }

  // Last 7 days for rolling means.
  const last7 = daysWindow(7, today)

  const meanFromMerged = (group, key) => {
    const vals = last7
      .map(d => mergeWhoopForDate(d, logs[d], whoopData))
      .map(m => parseFloat(m?.[group]?.[key]))
      .filter(v => isFinite(v) && v > 0)
    if (!vals.length) return null
    return vals.reduce((a, b) => a + b, 0) / vals.length
  }

  const meanFromLogs = (group, key) => {
    const vals = last7
      .map(d => parseFloat(logs[d]?.[group]?.[key]))
      .filter(v => isFinite(v) && v > 0)
    if (!vals.length) return null
    return vals.reduce((a, b) => a + b, 0) / vals.length
  }

  return {
    weeklyKm:       weeklyKm > 0 ? weeklyKm : null,
    weightTarget:   weight,
    hrv:            meanFromMerged('body',  'hrv'),
    rhr:            meanFromMerged('body',  'rhr'),
    sleepScore:     meanFromMerged('sleep', 'sleepScore'),
    recoveryScore:  meanFromMerged('sleep', 'recoveryScore'),
    hoursSlept:     meanFromMerged('sleep', 'hoursSlept'),
    dailyCalories:  meanFromLogs('nutrition', 'calories'),
    dailyProtein:   meanFromLogs('nutrition', 'protein'),
    dailyCarbs:     meanFromLogs('nutrition', 'carbs'),
  }
}

// ── Target row spec — label, pill, unit, helper-text formatters.
// Verb format mirrors the mockup; the actualLabel + state words are
// composed by TargetRow.
//
// Each entry's `prefix(t)` formats the muted helper prefix
// ("Target: 100 km/week") and `actual(v)` formats the live half
// ("38 km logged"). Both run sentence-case and tabular-nums in mono.
const numFmt = n => Math.round(n).toLocaleString('en-GB')

export const TARGET_SPECS = {
  weeklyKm: {
    label: 'Weekly running target',
    pill: null,
    unit: 'km / week',
    step: 1,
    prefix: t => `Target: ${numFmt(t)} km/week`,
    actual: v => `${numFmt(v)} km logged`,
  },
  weightTarget: {
    label: 'Weight target',
    pill: { text: 'goal weight' },
    unit: 'kg',
    step: 0.5,
    prefix: t => `Target: ${t} kg ±0.5`,
    actual: v => `currently ${v.toFixed(1)} kg`,
  },
  hrv: {
    label: 'HRV target',
    pill: null,
    unit: 'ms',
    step: 1,
    prefix: t => `Target: HRV ≥ ${numFmt(t)} ms`,
    actual: v => `avg ${numFmt(v)} ms`,
  },
  rhr: {
    label: 'Resting HR target',
    pill: { text: '↓ lower is better', clayFlag: true },
    unit: 'bpm',
    step: 1,
    prefix: t => `Target: RHR ≤ ${numFmt(t)} bpm`,
    actual: v => `avg ${numFmt(v)} bpm`,
  },
  sleepScore: {
    label: 'Sleep score target',
    pill: null,
    unit: '/ 100',
    step: 1,
    prefix: t => `Target: ${numFmt(t)}+`,
    actual: v => `avg ${numFmt(v)}`,
  },
  recoveryScore: {
    label: 'Recovery score target',
    pill: null,
    unit: '/ 100',
    step: 1,
    prefix: t => `Target: ${numFmt(t)}+`,
    actual: v => `avg ${numFmt(v)}`,
  },
  hoursSlept: {
    label: 'Hours slept target',
    pill: null,
    unit: 'hrs',
    step: 0.5,
    prefix: t => `Target: ${t} hrs`,
    actual: v => {
      const h = Math.floor(v)
      const m = Math.round((v - h) * 60)
      return `avg ${h}h ${m.toString().padStart(2, '0')}m`
    },
  },
  dailyCalories: {
    label: 'Daily calories',
    pill: null,
    unit: 'kcal',
    step: 10,
    prefix: t => `Target: ${numFmt(t)} kcal/day`,
    actual: v => `avg ${numFmt(v)}`,
  },
  dailyProtein: {
    label: 'Daily protein',
    pill: null,
    unit: 'g',
    step: 1,
    prefix: t => `Target: ${numFmt(t)} g/day`,
    actual: v => `avg ${numFmt(v)} g`,
  },
  dailyCarbs: {
    label: 'Daily carbs',
    pill: null,
    unit: 'g',
    step: 1,
    prefix: t => `Target: ${numFmt(t)} g/day`,
    actual: v => `avg ${numFmt(v)} g`,
  },
}

export const SECTION_LAYOUT = [
  { label: 'Running',          rN: 'r-4', keys: ['weeklyKm'] },
  { label: 'Body metrics',     rN: 'r-5', keys: ['weightTarget', 'hrv', 'rhr'] },
  { label: 'Sleep & recovery', rN: 'r-6', keys: ['sleepScore', 'recoveryScore', 'hoursSlept'] },
  { label: 'Nutrition',        rN: 'r-7', keys: ['dailyCalories', 'dailyProtein', 'dailyCarbs'] },
]

// Word for the trailing state span — coloured to match the bar.
export function stateWord(band) {
  return band === 'on' ? 'on target' : band === 'amber' ? 'approaching' : 'off target'
}
