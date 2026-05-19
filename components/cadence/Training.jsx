'use client'

import './training.css'

function isoWeek(d = new Date()) {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7)
  const jan4 = new Date(date.getFullYear(), 0, 4)
  return 1 + Math.round(((date - jan4) / 86400000 - 3 + (jan4.getDay() + 6) % 7) / 7)
}

const TYPE_LABEL = {
  run: 'Running', swim: 'Swimming', cycle: 'Cycling', hike: 'Hiking',
  gym: 'Gym', strength: 'Strength', functional: 'Functional',
  yoga: 'Yoga', stretch: 'Stretching', rest: 'Rest day', custom: 'Custom',
}

function pipClass(type) {
  if (['run', 'swim', 'cycle', 'hike'].includes(type)) return 't-run'
  if (['gym', 'strength'].includes(type)) return 't-gym'
  if (type === 'functional') return 't-functional'
  if (['yoga', 'stretch'].includes(type)) return 't-yoga'
  return 't-rest'
}

function shortTitle(details, type) {
  const fallback = TYPE_LABEL[type] || 'Session'
  if (!details) return fallback
  const first = String(details).split(/\n/)[0].trim()
  const s = first.replace(/^\d+(?:[:.]\d+)?(?:[–-]\d+)?\s*(?:hr|hrs|h|min|m)\b\s*/i, '').trim()
  const c = s || first
  return c.length <= 28 ? c : c.slice(0, 26).replace(/\s+\S*$/, '') + '…'
}

export default function Training({ plan, savePlan, settings, getDefaultPlan }) {
  if (!plan) return null

  const wk = isoWeek()
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })

  const kmTarget    = parseFloat(settings?.weeklyKm?.value) || null
  const funcCount   = plan.filter(d => d.sessions.some(s => s.type === 'functional')).length
  const gymTypes    = [...new Set(
    plan.flatMap(d => d.sessions.filter(s => s.type === 'gym').map(s =>
      s.details.split('–')[0].split('/')[0].trim()
    ))
  )].length
  const yogaCount   = plan.filter(d => d.sessions.some(s => s.type === 'yoga')).length
  const sessionTotal = plan.reduce((n, day) => n + day.sessions.length, 0)

  return (
    <>
      <header className="training-header">
        <div className="training-title">
          <h1>Training plan</h1>
          <span className="training-week">WK {wk}</span>
        </div>
      </header>

      <div className="stat-row">
        <div className="stat">
          <div className="label">Distance</div>
          <div className="value">
            {kmTarget != null ? `~${kmTarget}` : '—'}
            {kmTarget != null && <span className="unit">km</span>}
          </div>
          <div className="helper">weekly target</div>
        </div>
        <div className="stat">
          <div className="label">Functional</div>
          <div className="value">{funcCount}</div>
          <div className="helper">sessions this week</div>
        </div>
        <div className="stat">
          <div className="label">Gym types</div>
          <div className="value">{gymTypes}</div>
          <div className="helper">types in plan</div>
        </div>
        <div className="stat">
          <div className="label">Yoga</div>
          <div className="value">{yogaCount}</div>
          <div className="helper">days this week</div>
        </div>
        <div className="stat">
          <div className="label">Sessions</div>
          <div className="value">{sessionTotal}</div>
          <div className="helper">in plan this week</div>
        </div>
      </div>

      <section className="section training-plan">
        <div className="section-head">
          <h2>Weekly plan · WK {wk}</h2>
        </div>
        <div className="week-grid">
          {plan.map(day => {
            const isToday = day.day === todayName
            const primary = day.sessions[0]
            const isRest  = primary?.type === 'rest'

            return (
              <div
                key={day.day}
                className={`day${isToday ? ' today' : ''}${isRest ? ' rest' : ''}`}
              >
                <div className="day-head">
                  <span className="day-name">{day.short}</span>
                  <span className="day-num">{day.sessions.length}</span>
                </div>
                <div className="day-session">
                  {primary ? shortTitle(primary.details, primary.type) : 'Free day'}
                </div>
                <div className="day-meta">
                  {day.sessions.map(s => (
                    <span key={s.id} className={`pip ${pipClass(s.type)}`} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </>
  )
}
