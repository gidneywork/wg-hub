'use client'

const PIP_MAP = {
  run: 'run',
  swim: 'run',
  cycle: 'run',
  hike: 'run',
  gym: 'strength',
  functional: 'strength',
  strength: 'strength',
  yoga: 'recovery',
  stretch: 'recovery',
  recovery: 'recovery',
  walk: 'recovery',
  walking: 'recovery',
  custom: 'recovery',
}

const TYPE_LABEL = {
  run: 'running',
  swim: 'swimming',
  cycle: 'cycling',
  hike: 'hiking',
  gym: 'strength · gym',
  functional: 'functional',
  yoga: 'yoga',
  stretch: 'stretching',
  recovery: 'recovery',
  walk: 'walking',
  walking: 'walking',
  custom: 'custom',
}

function formatWhen(dateIso) {
  if (!dateIso) return '—'
  const d = new Date(dateIso)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(d); target.setHours(0, 0, 0, 0)
  const diffDays = Math.round((today - target) / 86400000)
  if (diffDays === 0) return 'TODAY'
  if (diffDays === 1) return 'YESTERDAY'
  return d
    .toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })
    .toUpperCase()
    .replace(',', ' ·')
}

function formatDuration(seconds) {
  if (!isFinite(seconds) || seconds <= 0) return null
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.round(seconds % 60)
  if (h > 0) return { value: `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`, unit: 'h' }
  return { value: `${m}:${s.toString().padStart(2, '0')}`, unit: 'min' }
}

// Match WGHub's load formula: km + (gymHrs × 8) + (yogaHrs × 3).
// Apply per-activity: count km for runs, count time for gym/yoga.
function computeRowLoad(a, type) {
  const km = type === 'run' ? (a.data?.distance || 0) / 1000 : 0
  const hours = (a.data?.moving_time || 0) / 3600
  const gymLoad = (type === 'gym' || type === 'functional' || type === 'strength') ? hours * 8 : 0
  const yogaLoad = (type === 'yoga' || type === 'stretch') ? hours * 3 : 0
  return Math.round(km + gymLoad + yogaLoad)
}

export default function Recent({ activities }) {
  const recent = (activities || []).slice(0, 5)

  return (
    <section className="section r r-9">
      <div className="section-head">
        <h2>Recent</h2>
        <div className="right">
          <button type="button" className="link">Full history →</button>
        </div>
      </div>
      {recent.length === 0 ? (
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-quiet)', padding: '12px 0' }}>
          No activity logged yet
        </div>
      ) : (
        <table className="activity">
          <thead>
            <tr>
              <th style={{ width: 110 }}>When</th>
              <th>Session</th>
              <th className="r" style={{ width: 100 }}>Duration</th>
              <th className="r" style={{ width: 100 }}>Distance</th>
              <th className="r" style={{ width: 100 }}>Avg HR</th>
              <th className="r" style={{ width: 80 }}>Load</th>
            </tr>
          </thead>
          <tbody>
            {recent.map(a => {
              const type = a.custom_type || a.strava_type || 'custom'
              const name = a.custom_name || a.data?.name || (TYPE_LABEL[type] || type)
              const dur = formatDuration(a.data?.moving_time)
              const distKm = a.data?.distance ? (a.data.distance / 1000) : null
              const hr = a.data?.average_heartrate
              const load = computeRowLoad(a, type)
              return (
                <tr key={a.id}>
                  <td className="date">{formatWhen(a.start_date)}</td>
                  <td className="title">
                    <span className={`pip ${PIP_MAP[type] || 'recovery'}`} />
                    {name}
                    <span className="type">{TYPE_LABEL[type] || type}</span>
                  </td>
                  <td className="r">
                    {dur ? <>{dur.value}<span className="unit">{dur.unit}</span></> : '—'}
                  </td>
                  <td className="r">
                    {distKm ? <>{distKm.toFixed(1)}<span className="unit">km</span></> : '—'}
                  </td>
                  <td className="r">
                    {hr ? <>{Math.round(hr)}<span className="unit">bpm</span></> : '—'}
                  </td>
                  <td className="r">{load > 0 ? load : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}
