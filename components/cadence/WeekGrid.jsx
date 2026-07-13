'use client'

import { getCurrentWeek } from '../../lib/plan'

const localIso = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const PIP_BY_TYPE = {
  run: 'run',
  swim: 'run',
  cycle: 'run',
  hike: 'run',
  gym: 'strength',
  functional: 'strength',
  strength: 'strength',
  climbing: 'climb',
  yoga: 'recovery',
  stretch: 'recovery',
  recovery: 'recovery',
  rest: 'rest',
  custom: 'recovery',
}

// Try to pull a short "1h 45m · 20km" style meta from a free-text session detail.
// Falls back to a generic type label when nothing matches.
function parseSessionMeta(details, type) {
  if (!details) return type ? type.toUpperCase() : ''
  const s = String(details)

  // Duration: "1:45–2hrs", "1:45", "1h 45m", "1hr", "45m", "45min", "1.5hrs"
  const durMatch =
    s.match(/\b(\d+:\d+(?:[–-]\d+(?::\d+)?)?\s*(?:hr|h|hrs)?)\b/i) ||
    s.match(/\b(\d+(?:\.\d+)?\s*(?:hrs?|hours?))\b/i) ||
    s.match(/\b(\d+\s*(?:min|m)\b)/i)
  const distMatch = s.match(/\b(\d+(?:[–-]\d+)?(?:\.\d+)?\s*km)\b/i)

  const parts = []
  if (durMatch) parts.push(durMatch[1].replace(/\s+/g, ' ').trim())
  if (distMatch) parts.push(distMatch[1].replace(/\s+/g, ' ').trim())
  if (parts.length) return parts.join(' · ')
  return type ? type : ''
}

// First line up to ~24 chars, used as the day-session title.
function shortTitle(details, type) {
  if (!details) {
    if (type === 'rest') return 'Rest'
    if (type === 'run') return 'Run'
    if (type === 'gym') return 'Gym'
    if (type === 'yoga') return 'Yoga'
    if (type === 'functional') return 'Functional'
    return type || 'Session'
  }
  const first = String(details).split(/\n/)[0].trim()
  // Strip leading durations so we lead on the session intent
  const stripped = first.replace(/^\d+(?:[:.]\d+)?(?:[–-]\d+)?\s*(?:hr|hrs|h|min|m)\b\s*/i, '').trim()
  const candidate = stripped || first
  if (candidate.length <= 28) return candidate
  return candidate.slice(0, 26).replace(/\s+\S*$/, '') + '…'
}

// Pick the primary session of a plan day. Order from getDefaultPlan in WGHub:
// rest pushed first (if any), then runs, then func, then gym, then yoga.
// "Primary" = first session, which already reflects that priority.
function primarySession(planDay) {
  if (!planDay?.sessions?.length) return null
  return planDay.sessions[0]
}

export default function WeekGrid({ plan }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dow = today.getDay() === 0 ? 6 : today.getDay() - 1
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - dow)

  const week = getCurrentWeek(plan, today)

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + i)
    const planDay = week?.[i]
    const session = primarySession(planDay)
    const type = session?.type || 'custom'
    return {
      key: localIso(date),
      isToday: i === dow,
      isRest: type === 'rest',
      dayName: date.toLocaleDateString('en-GB', { weekday: 'short' }),
      dayNum: date.getDate(),
      title: shortTitle(session?.details, type),
      meta: parseSessionMeta(session?.details, type),
      pip: PIP_BY_TYPE[type] || 'recovery',
    }
  })

  return (
    <section className="week r r-5">
      <div className="section-head">
        <h2>This week’s training</h2>
        <div className="right">
          <button type="button" className="link">Edit plan →</button>
        </div>
      </div>
      <div className="week-grid">
        {days.map(d => (
          <div key={d.key} className={`day${d.isToday ? ' today' : ''}${d.isRest ? ' rest' : ''}`}>
            <div className="day-head">
              <span className="day-name">{d.dayName}</span>
              <span className="day-num">{d.dayNum}</span>
            </div>
            <div className="day-session">{d.title}</div>
            <div className="day-meta">
              <span className={`pip ${d.pip}`} />
              {d.meta}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
