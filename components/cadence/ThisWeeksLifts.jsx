'use client'

import { localIso, startOfWeek } from './helpers'

const DAY_LABELS = ['MON','TUE','WED','THU','FRI','SAT','SUN']
const MONTH_LABELS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']

function buildWeekDates() {
  const monday = startOfWeek()
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return { iso: localIso(d), label: `${DAY_LABELS[i]} ${d.getDate()} ${MONTH_LABELS[d.getMonth()]}` }
  })
}

function groupLifts(lifts) {
  const groups = []
  const index = new Map()
  for (const lift of lifts) {
    const weight = parseFloat(lift.weight)
    const reps = parseInt(lift.reps, 10) || 0
    const exercise = lift.exercise || 'Lift'
    const key = `${exercise}__${isFinite(weight) ? weight : 0}__${reps}`
    if (index.has(key)) {
      groups[index.get(key)].sets++
    } else {
      index.set(key, groups.length)
      groups.push({ exercise, weight: isFinite(weight) ? weight : 0, reps, sets: 1 })
    }
  }
  return groups
}

function formatLift(g) {
  const setsPart = `${g.sets} set${g.sets !== 1 ? 's' : ''}`
  const repsPart = `${g.reps} rep${g.reps !== 1 ? 's' : ''}`
  const weightPart = g.weight > 0 ? ` @ ${g.weight}kg` : ''
  return `${setsPart} × ${repsPart}${weightPart}`
}

export default function ThisWeeksLifts({ logs }) {
  const week = buildWeekDates()
  const days = week
    .map(d => {
      const lifts = Array.isArray(logs?.[d.iso]?.lifts) ? logs[d.iso].lifts : []
      return { ...d, groups: groupLifts(lifts) }
    })
    .filter(d => d.groups.length > 0)

  const totalRows = days.reduce((sum, d) => sum + d.groups.length, 0)
  const isLong = totalRows >= 15

  return (
    <section className="section r r-7">
      <div className="section-head">
        <h2>This week’s lifts</h2>
      </div>
      {days.length === 0 ? (
        <div className="twl-empty">No lifts logged this week.</div>
      ) : (
        <div className={`twl-list${isLong ? ' twl-list--scroll' : ''}`}>
          {days.map(day => (
            <div key={day.iso} className="twl-day">
              <div className="twl-day-label">{day.label}</div>
              <ul className="twl-rows">
                {day.groups.map((g, i) => (
                  <li key={i} className="twl-row">
                    <span className="twl-exercise">{g.exercise}</span>
                    <span className="twl-meta">{formatLift(g)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
