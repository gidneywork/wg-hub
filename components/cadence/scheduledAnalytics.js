import { localIso, startOfWeek } from './helpers'
import { getCurrentWeek, disciplineForType } from '../../lib/plan'

/**
 * Plan-vs-actual adherence (FC-076). The 51-week plan is the single producer of
 * PLANNED sessions; actuals come from logged activity. There is no hand-booked
 * scheduled_sessions shadow any more.
 *
 * Denominator — the distinct non-rest disciplines the plan schedules for each
 * gradable date. A date is gradable only when it is strictly in the PAST
 * (iso < today) and inside the 51-week window; today is never graded (you cannot
 * miss a session that hasn't happened), and dates outside the window contribute
 * to neither side. Rest days carry no denominator — you cannot adhere to rest.
 *
 * Numerator — planned disciplines that have a matching actual on the same date.
 * Match is on date + FINE discipline (disciplineForType).
 */

// Non-rest disciplines the plan schedules for a date. null = date outside the
// plan window (contributes to neither side).
function plannedDisciplines(plan, iso) {
  const date = new Date(iso + 'T00:00:00')
  const week = getCurrentWeek(plan, date)
  if (!week) return null
  const dow = (date.getDay() + 6) % 7 // Mon=0
  const set = new Set()
  ;(week[dow]?.sessions || []).forEach(s => {
    const d = disciplineForType(s.type)
    if (d !== 'rest') set.add(d)
  })
  return set
}

// Disciplines actually done on a date. `activities` is already WHOOP-auto-walk
// filtered upstream (db.loadActivities, FI-004).
//
// KNOWN GAP — deferred to FC-035 (Workout Plan Builder): climb and functional
// have NO actuals source unless they arrive via Strava. Daily hangboard and
// mobility work that never hits Strava reads as permanently unmatched. This is a
// logging gap, not an adherence bug — FC-035 adds the missing producer. Do not
// "fix" it by loosening the match; name it here so nobody rediscovers it cold.
function actualDisciplines(activities, logs, iso) {
  const set = new Set()
  ;(activities || []).forEach(a => {
    if ((a.start_date || '').slice(0, 10) !== iso) return
    set.add(disciplineForType(a.custom_type ?? a.strava_type))
  })
  const log = logs?.[iso]
  if (Array.isArray(log?.lifts) && log.lifts.length > 0) set.add('gym')
  return set
}

// Weekly series (bars) + rolled-up summary (hero/tiles), from one pass.
//   days      — ISO YYYY-MM-DD dates in the chart window
//   todayIso  — today's ISO; dates >= today are never graded
export function computeAdherence(plan, activities, logs, days, todayIso) {
  const byWeek = {}
  let totalPlanned = 0, totalMatched = 0, gradedDays = 0

  ;(days || []).forEach(iso => {
    if (iso >= todayIso) return // past only
    const planned = plannedDisciplines(plan, iso)
    if (!planned || planned.size === 0) return // outside plan, or rest-only day
    const actual  = actualDisciplines(activities, logs, iso)
    const matched = [...planned].filter(d => actual.has(d)).length

    gradedDays   += 1
    totalPlanned += planned.size
    totalMatched += matched

    const wk = localIso(startOfWeek(new Date(iso + 'T00:00:00')))
    ;(byWeek[wk] ||= { planned: 0, matched: 0 })
    byWeek[wk].planned += planned.size
    byWeek[wk].matched += matched
  })

  const currentWk = localIso(startOfWeek(new Date()))
  const weekKeys  = Object.keys(byWeek).sort()

  const series = weekKeys.map(wk => {
    const { planned, matched } = byWeek[wk]
    return {
      weekKey:   wk,
      weekLabel: 'WEEK OF ' + new Date(wk + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase(),
      value:     planned > 0 ? Math.round((matched / planned) * 100) : null,
      isCurrent: wk === currentWk,
      planned, matched,
    }
  })

  // Best streak — consecutive weeks with adherence >= 75%.
  let bestStreak = 0, cur = 0
  weekKeys.forEach(wk => {
    const { planned, matched } = byWeek[wk]
    const pct = planned > 0 ? (matched / planned) * 100 : null
    if (pct !== null && pct >= 75) { cur += 1; bestStreak = Math.max(bestStreak, cur) }
    else cur = 0
  })

  const pct = totalPlanned > 0 ? Math.round((totalMatched / totalPlanned) * 100) : null
  return {
    series,
    summary: { pct, planned: totalPlanned, matched: totalMatched, gradedDays, bestStreak },
  }
}
