/**
 * Cadence — weekly muscle volume analytics.
 * Pure functions; reads daily_logs.data.lifts[] shapes already loaded by db.loadLogs.
 */

import { getExerciseByName, getMuscleGroups } from './exercises'

// Returns the most recent data.body.weight value from logs on or before `date`.
// sortedLogDates: pre-sorted ascending array of log date strings.
// Returns null if no weight found on or before `date`.
function imputeBodyweight(logs, date, sortedLogDates) {
  for (let i = sortedLogDates.length - 1; i >= 0; i--) {
    const d = sortedLogDates[i]
    if (d > date) continue
    const w = parseFloat(logs[d]?.body?.weight)
    if (isFinite(w) && w > 0) return w
  }
  return null
}

// Computes tonnage (weight × reps) for the ISO week beginning on isoWeekStart (Monday).
//
// Bodyweight exercises: tonnage = (imputedBodyweight + vestWeight) × reps.
//   vestWeight = lift.weight if > 0 (user added extra load), else 0.
//   If no prior body.weight is logged, the lift is unattributed regardless of vest weight.
//
// Custom exercises (no DB entry): counted in totalTonnage and unattributedTonnage, not in byMuscle.
// Cardio exercises: skipped entirely (no weight × reps metric).
//
// Returns:
//   { totalTonnage, totalSets, byMuscle: { chest, back, ... }, unattributedTonnage, unattributedSets }
export function computeWeeklyMuscleVolume(logs, isoWeekStart) {
  const muscleGroups = getMuscleGroups().filter(m => m !== 'cardio')
  const byMuscle = Object.fromEntries(muscleGroups.map(m => [m, { tonnage: 0, sets: 0 }]))

  let totalTonnage = 0
  let totalSets = 0
  let unattributedTonnage = 0
  let unattributedSets = 0

  const sortedLogDates = Object.keys(logs).sort()

  const [sy, sm, sd] = isoWeekStart.split('-').map(Number)
  const weekStart = new Date(sy, sm - 1, sd)

  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const lifts = Array.isArray(logs[date]?.lifts) ? logs[date].lifts : []

    for (const lift of lifts) {
      const entry = getExerciseByName(lift.exercise)
      if (entry?.cardio) continue

      const reps = parseInt(lift.reps, 10) || 0
      let effectiveWeight = null
      let isAttributed = false

      if (entry?.bodyweight) {
        const bw = imputeBodyweight(logs, date, sortedLogDates)
        if (bw != null) {
          const vestWeight = parseFloat(lift.weight) || 0
          effectiveWeight = bw + vestWeight
          isAttributed = true
        }
        // bw == null → unattributed regardless of vest weight
      } else if (entry) {
        const w = parseFloat(lift.weight)
        effectiveWeight = isFinite(w) ? w : 0
        isAttributed = true
      } else {
        // Custom exercise — no DB entry; counts toward total but not byMuscle
        const w = parseFloat(lift.weight)
        effectiveWeight = isFinite(w) ? w : 0
        isAttributed = false
      }

      const tonnage = (effectiveWeight ?? 0) * reps
      totalTonnage += tonnage
      totalSets += 1

      if (isAttributed && entry?.muscle && byMuscle[entry.muscle]) {
        byMuscle[entry.muscle].tonnage += tonnage
        byMuscle[entry.muscle].sets += 1
      } else {
        unattributedTonnage += tonnage
        unattributedSets += 1
      }
    }
  }

  return { totalTonnage, totalSets, byMuscle, unattributedTonnage, unattributedSets }
}
