import { localIso, startOfWeek } from './helpers'

/**
 * computeAdherenceSeries — maps scheduled_sessions rows onto weekly buckets
 * compatible with ChartSVG's bars[] format.
 *
 * null  = no sessions scheduled in this week (renders no bar)
 * 0     = sessions existed but zero were completed (renders a zero bar)
 *
 * "Missed" = status 'scheduled' AND scheduled_date < referenceIso (past, not actioned).
 * Sessions in the current/future week with status 'scheduled' are pending — not penalised.
 *
 * @param {Array}  sessions      rows from db.listScheduledSessions
 * @param {Array}  allWeeks      ISO YYYY-MM-DD Monday dates (from daysWindow)
 * @param {string} referenceIso  today's date as ISO string (for missed detection)
 */
export function computeAdherenceSeries(sessions, allWeeks, referenceIso) {
  const weekMap = {}
  allWeeks.forEach(wk => {
    weekMap[wk] = { scheduled: 0, completed: 0, skipped: 0, missed: 0 }
  })

  sessions.forEach(s => {
    const wk = localIso(startOfWeek(new Date(s.scheduled_date + 'T00:00:00')))
    if (!weekMap[wk]) return
    weekMap[wk].scheduled++
    if (s.status === 'completed') {
      weekMap[wk].completed++
    } else if (s.status === 'skipped') {
      weekMap[wk].skipped++
    } else if (s.scheduled_date < referenceIso) {
      weekMap[wk].missed++
    }
    // status === 'scheduled' AND date >= referenceIso → pending, not counted
  })

  const currentWk = localIso(startOfWeek(new Date()))

  return allWeeks.map(wk => {
    const d = new Date(wk + 'T00:00:00')
    const weekLabel = 'WEEK OF ' + d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase()
    const { scheduled, completed, skipped, missed } = weekMap[wk]
    const denominator = completed + skipped + missed
    // null if no sessions scheduled, or all still pending
    const value = scheduled === 0 || denominator === 0
      ? null
      : Math.round((completed / denominator) * 100)
    return { weekKey: wk, weekLabel, value, isCurrent: wk === currentWk, scheduled, completed, skipped, missed }
  })
}
