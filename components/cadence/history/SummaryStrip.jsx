'use client'

import {
  rollingScopeLabel,
  dayKmMap,
  densityBars,
  densityDesc,
  summaryStats,
  fmtHM,
  fmtDeltaHM,
} from './historyHelpers'

function StatTile({ label, scope, value, unit, deltaPrefix, deltaTone, deltaText }) {
  return (
    <div className="stat-tile">
      <div className="label">
        {label}
        {scope ? <span className="scope">{scope}</span> : null}
      </div>
      <div className="value">
        {value}
        {unit ? <span className="unit">{unit}</span> : null}
      </div>
      <div className="delta">
        {deltaPrefix ? (
          <span className={`pct ${deltaTone || 'flat'}`}>{deltaPrefix}</span>
        ) : null}
        <span>{deltaText}</span>
      </div>
    </div>
  )
}

export default function SummaryStrip({ activities }) {
  const kmMap = dayKmMap(activities)
  const bars = densityBars(kmMap)
  const scopeLabel = rollingScopeLabel(30)
  const desc = densityDesc(kmMap)
  const stats = summaryStats(activities)

  const totalKm30d = bars.reduce((s, b) => s + b.km, 0)
  const totalKmDisplay = totalKm30d > 0 ? totalKm30d.toFixed(1) : '0'

  // Sessions delta — moss arrow up, clay arrow down, flat otherwise.
  let sessionsPrefix = null, sessionsTone = 'flat'
  if (stats.sessionsDelta > 0) { sessionsPrefix = `▲ ${stats.sessionsDelta}`; sessionsTone = 'up' }
  else if (stats.sessionsDelta < 0) { sessionsPrefix = `▼ ${Math.abs(stats.sessionsDelta)}`; sessionsTone = 'down' }

  // Time delta — same arrows applied to H:MM diff.
  const timeDeltaStr = fmtDeltaHM(stats.timeDeltaSeconds)
  let timePrefix = null, timeTone = 'flat'
  if (stats.timeDeltaSeconds > 0) { timePrefix = `▲ ${fmtHM(stats.timeDeltaSeconds)}`; timeTone = 'up' }
  else if (stats.timeDeltaSeconds < 0) { timePrefix = `▼ ${fmtHM(Math.abs(stats.timeDeltaSeconds))}`; timeTone = 'down' }

  const longestStr = stats.longestSeconds > 0 ? fmtHM(stats.longestSeconds) : '—'
  const hrValue = stats.avgHr ?? '—'
  const hrRange = stats.hrPeak != null && stats.hrLow != null
    ? `peak ${stats.hrPeak} · low ${stats.hrLow}`
    : '—'

  return (
    <section className="summary r r-2">

      <div className="density-card">
        <div className="top">
          <span className="label">Distance · this month</span>
          <span className="scope">{scopeLabel}</span>
        </div>
        <div>
          <div className="value">{totalKmDisplay}<span className="unit">km</span></div>
          <div className="desc">{desc}</div>
        </div>
        <svg className="density-viz" viewBox="0 0 600 56" preserveAspectRatio="none">
          <line className="axis-line" x1="0" y1="50" x2="600" y2="50" />
          {bars.map(b => {
            const cls = b.today ? 'bar today' : b.rest ? 'bar rest' : 'bar'
            return (
              <rect
                key={b.date}
                className={cls}
                x={b.x}
                y={b.y}
                width={b.width}
                height={b.height}
                style={{ animationDelay: `${b.delay}ms` }}
              />
            )
          })}
        </svg>
      </div>

      <StatTile
        label="Sessions"
        scope="this month"
        value={stats.sessions}
        deltaPrefix={sessionsPrefix}
        deltaTone={sessionsTone}
        deltaText="vs prev 30d"
      />

      <StatTile
        label="Time"
        scope="this month"
        value={fmtHM(stats.totalSeconds)}
        unit="h"
        deltaPrefix={timePrefix}
        deltaTone={timeTone}
        deltaText={`longest ${longestStr}`}
      />

      <StatTile
        label="Avg HR"
        scope="running"
        value={hrValue}
        unit={stats.avgHr != null ? 'bpm' : null}
        deltaText={hrRange}
      />

    </section>
  )
}
