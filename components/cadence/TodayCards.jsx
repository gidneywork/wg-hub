'use client'

import { todayStr } from './helpers'
import { getCurrentWeek } from '../../lib/plan'
import { evaluateCalorieDelta, getCalorieTargetMode } from '../../lib/calories'

const MOOD_WORDS = { 1: 'Rough', 2: 'Flat', 3: 'Okay', 4: 'Good', 5: 'Strong' }

function yesterdayStr() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// Session-type → pip bucket (mirrors WeekGrid.PIP_BY_TYPE; token colours in CSS).
const PIP_BY_TYPE = {
  run: 'run', swim: 'run', cycle: 'run', hike: 'run',
  gym: 'strength', functional: 'strength', strength: 'strength',
  climbing: 'climb',
  yoga: 'recovery', stretch: 'recovery', recovery: 'recovery', custom: 'recovery',
  rest: 'rest',
}

function shortTitle(details, type) {
  if (!details) {
    if (type === 'rest') return 'Rest'
    return (type || 'Session').replace(/^./, c => c.toUpperCase())
  }
  const first = String(details).split(/\n/)[0].trim()
  return first.length <= 60 ? first : first.slice(0, 58).replace(/\s+\S*$/, '') + '…'
}

function ScheduledCard({ plan }) {
  const dow = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1
  const planDay = getCurrentWeek(plan, new Date())?.[dow]
  const sessions = planDay?.sessions || []
  const onlyRest = sessions.length === 1 && sessions[0].type === 'rest'

  return (
    <div className="card">
      <div className="card-eyebrow">
        <span className="pip scheduled" />
        Scheduled · {onlyRest ? 'recovery' : 'training'}
      </div>
      {sessions.length === 0 ? (
        <div className="today-session-empty">Nothing scheduled</div>
      ) : onlyRest ? (
        <div className="card-title">{shortTitle(sessions[0].details, 'rest')}</div>
      ) : (
        <div className="today-session-list">
          {sessions.map(s => (
            <div key={s.id} className="today-session">
              <span className={`pip ${PIP_BY_TYPE[s.type] || 'recovery'}`} />
              <span className="today-session-title">{shortTitle(s.details, s.type)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FuelCard({ logs, activities, settings }) {
  const today = todayStr()
  const yst = yesterdayStr()

  // Use today if it has any fuel data; fall back to yesterday.
  const todayLog = logs?.[today]
  const todayCalsIn = parseFloat(todayLog?.nutrition?.calories)
  const todayActs = (activities || []).filter(a => (a.start_date || '').split('T')[0] === today)
  const todayHasData = (isFinite(todayCalsIn) && todayCalsIn > 0) || todayActs.some(a => parseFloat(a.data?.calories) > 0)

  const dateKey = todayHasData ? today : yst
  const isLive = dateKey === today

  const log = logs?.[dateKey]
  const calsIn = parseFloat(log?.nutrition?.calories)
  const inValid = isFinite(calsIn) && calsIn > 0

  const dateActs = (activities || []).filter(a => (a.start_date || '').split('T')[0] === dateKey)
  const calsOutSum = dateActs.reduce((s, a) => s + (parseFloat(a.data?.calories) || 0), 0)
  const outValid = calsOutSum > 0

  const balance = inValid || outValid ? Math.round((inValid ? calsIn : 0) - (outValid ? calsOutSum : 0)) : null
  const calMode = getCalorieTargetMode(settings)
  const calResult = calMode ? evaluateCalorieDelta(inValid ? calsIn : null, outValid ? calsOutSum : null, calMode) : null
  const showCalPill = calResult && calResult.status !== 'no_data' && calResult.status !== 'no_mode'
  const balanceLabel = balance == null
    ? '— kcal'
    : (balance < 0 ? '−' : '+') + Math.abs(balance).toLocaleString() + ' kcal'
  const nowHHMM = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })

  // Bars scale against a 3000 kcal full-track baseline. Caps at 100%.
  const SCALE = 3000
  const inPct = inValid ? Math.min(100, (calsIn / SCALE) * 100) : 0
  const outPct = outValid ? Math.min(100, (calsOutSum / SCALE) * 100) : 0

  return (
    <div className="card fuel-card">
      <div className="card-eyebrow">
        <span className={`pip${isLive ? ' live' : ''}`} />
        {isLive ? 'Live' : 'Yesterday'} · fuel
      </div>
      <div className="balance">
        <span className="num">{balanceLabel.split(' ')[0]}</span>
        <span className="label">kcal{isLive ? ` · ${nowHHMM}` : ''}</span>
      </div>
      {showCalPill && (
        <span className={`cal-pill${calResult.status === 'off_target' ? ' off' : ''}`}>
          {calResult.status === 'on_target' ? 'on target' : 'off target'}
        </span>
      )}
      <div className="fuel-bars">
        <span>IN</span>
        <div className="track"><div className="fill in" style={{ width: `${inPct}%` }} /></div>
        <span className="right">{inValid ? Math.round(calsIn).toLocaleString() : '—'}</span>
      </div>
      <div className="fuel-bars">
        <span>OUT</span>
        <div className="track"><div className="fill out" style={{ width: `${outPct}%` }} /></div>
        <span className="right">{outValid ? Math.round(calsOutSum).toLocaleString() : '—'}</span>
      </div>
    </div>
  )
}

function JournalCard({ logs, onOpenDate }) {
  const yst = yesterdayStr()
  const feelings = logs?.[yst]?.data?.feelings
  const moodNum = feelings?.mood ? parseInt(feelings.mood, 10) : null
  const moodWord = moodNum && MOOD_WORDS[moodNum] ? MOOD_WORDS[moodNum] : null
  const note = feelings?.moodNote || feelings?.journal || null
  const hasData = moodWord || note
  const handleClick = onOpenDate ? () => onOpenDate(yst) : undefined

  return (
    <div
      className={`card today-journal-card${handleClick ? ' clickable' : ''}`}
      onClick={handleClick}
      role={handleClick ? 'button' : undefined}
      tabIndex={handleClick ? 0 : undefined}
      onKeyDown={handleClick ? e => (e.key === 'Enter' || e.key === ' ') && handleClick() : undefined}
    >
      <div className="card-eyebrow">
        <span className="pip" />
        Yesterday · journal
      </div>
      {hasData ? (
        <>
          {moodWord && (
            <div className="tj-mood-row">
              <span className="tj-label">Mood</span>
              <span className="tj-value">{moodWord}</span>
            </div>
          )}
          {note && (
            <p className="tj-note">{note.length > 120 ? note.slice(0, 118).replace(/\s+\S*$/, '') + '…' : note}</p>
          )}
        </>
      ) : (
        <p className="tj-empty">Nothing logged yesterday.</p>
      )}
    </div>
  )
}

export default function TodayCards({ plan, logs, activities, settings, setView, onOpenDate }) {
  return (
    <section className="section r r-6">
      <div className="section-head">
        <h2>Today</h2>
        <div className="right">
          <button type="button" className="link" onClick={() => setView && setView('planner')}>Open planner →</button>
        </div>
      </div>
      <div className="today-grid">
        <ScheduledCard plan={plan} />
        <FuelCard logs={logs} activities={activities} settings={settings} />
        <JournalCard logs={logs} onOpenDate={onOpenDate} />
      </div>
    </section>
  )
}
