'use client'

// PB tiles per the audit decision: five running PBs computable from
// Strava `activities` data. Tiles with no qualifying run show "—".

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds <= 0) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.round(seconds % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatPace(secondsPerKm) {
  if (!isFinite(secondsPerKm) || secondsPerKm <= 0) return '—'
  const m = Math.floor(secondsPerKm / 60)
  const s = Math.round(secondsPerKm % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function daysAgo(dateIso) {
  if (!dateIso) return null
  const then = new Date(dateIso)
  const days = Math.floor((Date.now() - then.getTime()) / 86400000)
  return days
}

function ageLabel(d) {
  if (d == null) return ''
  if (d === 0) return 'today'
  if (d === 1) return '1d ago'
  if (d < 30) return `${d}d`
  if (d < 365) {
    const m = Math.floor(d / 30)
    return `${m}mo`
  }
  return `${Math.floor(d / 365)}y`
}

function runs(activities) {
  return (activities || []).filter(a => {
    const t = a.custom_type || a.strava_type || ''
    return t === 'run'
  })
}

function pbAtDistance(activities, targetKm, tolerance = 0.10) {
  const lo = targetKm * (1 - tolerance) * 1000
  const hi = targetKm * (1 + tolerance) * 1000
  const candidates = runs(activities)
    .map(a => ({
      distance: a.data?.distance || 0,
      time: a.data?.moving_time || 0,
      date: a.start_date,
    }))
    .filter(c => c.distance >= lo && c.distance <= hi && c.time > 0)
  if (!candidates.length) return null
  const sorted = [...candidates].sort((a, b) => a.time - b.time)
  return {
    time: sorted[0].time,
    date: sorted[0].date,
    runnerUp: sorted[1]?.time,
  }
}

function longestRun(activities) {
  const list = runs(activities)
    .map(a => ({ distance: a.data?.distance || 0, date: a.start_date }))
    .filter(c => c.distance > 0)
  if (!list.length) return null
  const sorted = [...list].sort((a, b) => b.distance - a.distance)
  return {
    distanceKm: sorted[0].distance / 1000,
    date: sorted[0].date,
    runnerUpKm: sorted[1] ? sorted[1].distance / 1000 : null,
  }
}

function fastestPace(activities, minKm = 3) {
  const list = runs(activities)
    .map(a => ({
      distance: a.data?.distance || 0,
      time: a.data?.moving_time || 0,
      date: a.start_date,
    }))
    .filter(c => c.distance >= minKm * 1000 && c.time > 0)
    .map(c => ({ ...c, sPerKm: c.time / (c.distance / 1000) }))
  if (!list.length) return null
  const sorted = [...list].sort((a, b) => a.sPerKm - b.sPerKm)
  return {
    sPerKm: sorted[0].sPerKm,
    date: sorted[0].date,
    runnerUp: sorted[1]?.sPerKm,
  }
}

function Tile({ lift, value, unit, delta, age }) {
  return (
    <div className="pb-tile">
      <div className="lift">{lift}</div>
      <div className="val">
        {value}
        {unit && value !== '—' && <span className="unit">{unit}</span>}
      </div>
      <div className={`delta${delta ? '' : ' held'}`}>
        {delta || '● held'}
        {age && <span className="age"> · {age}</span>}
      </div>
    </div>
  )
}

export default function PersonalBests({ activities }) {
  const longest = longestRun(activities)
  const pb5 = pbAtDistance(activities, 5)
  const pb10 = pbAtDistance(activities, 10)
  const pbHalf = pbAtDistance(activities, 21.0975)
  const pace = fastestPace(activities)

  const longestTile = {
    lift: 'Longest run',
    value: longest ? longest.distanceKm.toFixed(1) : '—',
    unit: 'km',
    delta: longest && longest.runnerUpKm != null
      ? `▲ ${(longest.distanceKm - longest.runnerUpKm).toFixed(1)} km`
      : null,
    age: longest ? ageLabel(daysAgo(longest.date)) : null,
  }
  const tile5 = {
    lift: '5km PB',
    value: pb5 ? formatTime(pb5.time) : '—',
    unit: null,
    delta: pb5 && pb5.runnerUp != null
      ? `▼ ${formatTime(pb5.runnerUp - pb5.time)}`
      : null,
    age: pb5 ? ageLabel(daysAgo(pb5.date)) : null,
  }
  const tile10 = {
    lift: '10km PB',
    value: pb10 ? formatTime(pb10.time) : '—',
    unit: null,
    delta: pb10 && pb10.runnerUp != null
      ? `▼ ${formatTime(pb10.runnerUp - pb10.time)}`
      : null,
    age: pb10 ? ageLabel(daysAgo(pb10.date)) : null,
  }
  const tileHalf = {
    lift: 'Half marathon',
    value: pbHalf ? formatTime(pbHalf.time) : '—',
    unit: null,
    delta: pbHalf && pbHalf.runnerUp != null
      ? `▼ ${formatTime(pbHalf.runnerUp - pbHalf.time)}`
      : null,
    age: pbHalf ? ageLabel(daysAgo(pbHalf.date)) : null,
  }
  const tilePace = {
    lift: 'Fastest pace',
    value: pace ? formatPace(pace.sPerKm) : '—',
    unit: '/km',
    delta: pace && pace.runnerUp != null
      ? `▼ ${formatPace(pace.runnerUp - pace.sPerKm)}`
      : null,
    age: pace ? ageLabel(daysAgo(pace.date)) : null,
  }

  return (
    <section className="section r r-8">
      <div className="section-head">
        <h2>Personal bests · this block</h2>
        <div className="right">
          <button type="button" className="link">All records →</button>
        </div>
      </div>
      <div className="pb-strip">
        <Tile {...longestTile} />
        <Tile {...tile5} />
        <Tile {...tile10} />
        <Tile {...tileHalf} />
        <Tile {...tilePace} />
      </div>
    </section>
  )
}
