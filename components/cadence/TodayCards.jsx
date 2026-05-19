'use client'

import { todayStr, mergeWhoopForDate } from './helpers'

// Mirror the WeekGrid parser, kept inline so the two stay independent
// when their schemas diverge in a later session.
function parseScheduledMeta(details) {
  if (!details) return { duration: null, hr: null, distance: null }
  const s = String(details)
  const durMatch =
    s.match(/\b(\d+:\d+(?:[–-]\d+(?::\d+)?)?(?:\s*hrs?)?)\b/i) ||
    s.match(/\b(\d+(?:\.\d+)?\s*hrs?)\b/i) ||
    s.match(/\b(\d+\s*(?:min|m))\b/i)
  const hrMatch = s.match(/\b(\d{2,3}(?:[–-]\d{2,3})?)\s*bpm\b/i)
  const distMatch = s.match(/\b(\d+(?:[–-]\d+)?(?:\.\d+)?)\s*km\b/i)
  return {
    duration: durMatch ? durMatch[1].replace(/\s+/g, ' ').trim() : null,
    hr: hrMatch ? hrMatch[1] : null,
    distance: distMatch ? `${distMatch[1].replace(/\s+/g, ' ').trim()}km` : null,
  }
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
  const planDay = plan?.[dow]
  const session = planDay?.sessions?.[0]
  const type = session?.type || 'custom'
  const isRest = type === 'rest'
  const title = shortTitle(session?.details, type)
  const meta = parseScheduledMeta(session?.details)
  const trainingDetail = session?.details && !isRest
    ? String(session.details).trim()
    : null

  return (
    <div className="card">
      <div className="card-eyebrow">
        <span className="pip scheduled" />
        Scheduled · {isRest ? 'recovery' : 'training'}
      </div>
      <div className="card-title">{title}</div>
      <div className="card-meta">
        <div className="item">Duration<strong>{meta.duration || '—'}</strong></div>
        <div className="item">Target HR<strong>{meta.hr || '—'}</strong></div>
        <div className="item">Distance<strong>{meta.distance || '—'}</strong></div>
      </div>
      {trainingDetail && trainingDetail !== title && (
        <p className="card-note">{trainingDetail}</p>
      )}
    </div>
  )
}

function FuelCard({ logs, activities }) {
  const today = todayStr()
  const log = logs?.[today]
  const calsIn = parseFloat(log?.nutrition?.calories)
  const inValid = isFinite(calsIn) && calsIn > 0

  const todaysActs = (activities || []).filter(a => (a.start_date || '').split('T')[0] === today)
  const calsOutSum = todaysActs.reduce((s, a) => s + (parseFloat(a.data?.calories) || 0), 0)
  const outValid = calsOutSum > 0

  const balance = inValid || outValid ? Math.round((inValid ? calsIn : 0) - (outValid ? calsOutSum : 0)) : null
  const balanceLabel = balance == null
    ? '— kcal'
    : (balance < 0 ? '−' : '+') + Math.abs(balance).toLocaleString() + ' kcal'
  const nowHHMM = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })

  // Bars scale against a 3000 kcal full-track baseline so the visual
  // stays readable across typical days. Caps at 100%.
  const SCALE = 3000
  const inPct = inValid ? Math.min(100, (calsIn / SCALE) * 100) : 0
  const outPct = outValid ? Math.min(100, (calsOutSum / SCALE) * 100) : 0

  return (
    <div className="card fuel-card">
      <div className="card-eyebrow">
        <span className="pip live" />
        Live · fuel
      </div>
      <div className="balance">
        <span className="num">{balanceLabel.split(' ')[0]}</span>
        <span className="label">kcal · {nowHHMM}</span>
      </div>
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

function JournalCard() {
  // Empty state per the audit decision. Energy + soreness fields are
  // not yet in the log schema — Daily Data rebuild session will add
  // them and this card will light up automatically.
  return (
    <div className="card journal-card">
      <div className="card-eyebrow">
        <span className="pip" />
        Logged · journal
      </div>
      <div className="mood-row">
        <div className="mood">
          <div className="label">Energy</div>
          <div className="scale">
            {[0,1,2,3,4].map(i => <span key={i} className="pip" />)}
          </div>
        </div>
        <div className="mood">
          <div className="label">Soreness</div>
          <div className="scale">
            {[0,1,2,3,4].map(i => <span key={i} className="pip" />)}
          </div>
        </div>
      </div>
      <div className="entry-label">Today</div>
      <p className="entry">Nothing logged today.</p>
    </div>
  )
}

export default function TodayCards({ plan, logs, activities, setView }) {
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
        <FuelCard logs={logs} activities={activities} />
        <JournalCard />
      </div>
    </section>
  )
}
