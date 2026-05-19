/**
 * lib/bmr.js — Mifflin–St Jeor BMR estimation.
 *
 * Pure functions. No React, no Supabase, no DOM. Safe to import anywhere.
 *
 * The user-profile schema (Group A) stores the inputs as:
 *   identity.heightCm        — cm
 *   identity.dateOfBirth     — ISO 'YYYY-MM-DD' string
 *   identity.biologicalSex   — 'male' | 'female' | 'other' | null
 *
 * Weight is NOT a profile field; it lives in daily logs as logs[date].body.weight.
 * mostRecentWeightKg() walks the logs to find the last known value at-or-before
 * a given date.
 */

// Compute BMR in kcal/day, or null if any required input is missing.
//
// sex === 'male'    → base + 5
// sex === 'female'  → base − 161
// sex === 'other'   → base − 78 (average of the two offsets; deliberate opt-out)
// sex === null      → null (field not set; not estimable)
export function computeBMR({ heightCm, weightKg, ageYears, sex }) {
  if (!heightCm || !weightKg || ageYears == null) return null
  if (sex !== 'male' && sex !== 'female' && sex !== 'other') return null
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears
  if (sex === 'male')   return Math.round(base + 5)
  if (sex === 'female') return Math.round(base - 161)
  return Math.round(base - 78)
}

// Whole-years age from ISO 'YYYY-MM-DD' (matches <input type="date"> value).
// Returns null for missing, unparseable, future-dated, or implausible inputs.
export function ageFromBirthday(isoDate) {
  if (!isoDate) return null
  const dob = new Date(`${isoDate}T00:00:00`)
  if (isNaN(dob.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
  return age < 0 || age > 130 ? null : age
}

// Most-recent weight (kg) from logs at or before dateIso.
// Returns null if no log on or before that date carries a usable weight.
//
// Signature kept narrow (logs, dateIso) so a future precomputed
// buildWeightByDate(logs) cache can wrap or replace this without rippling
// through call sites.
export function mostRecentWeightKg(logs, dateIso) {
  if (!logs || !dateIso) return null
  const dates = Object.keys(logs).filter(d => d <= dateIso).sort().reverse()
  for (const d of dates) {
    const w = parseFloat(logs[d]?.body?.weight)
    if (isFinite(w) && w > 0) return w
  }
  return null
}
