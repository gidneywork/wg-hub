'use client'

import {
  todayStr,
  daysWindow,
  mergeWhoopForDate,
  mean,
  formatHoursColon,
  computeLoadForDay,
  kmByDateMap,
  startOfWeek,
  sparklinePath,
} from './helpers'

function MiniSpark({ values, color = 'var(--moss)' }) {
  const path = sparklinePath(values, 60, 20, 3)
  if (!path) return <svg width="60" height="20" viewBox="0 0 60 20" />
  return (
    <svg width="60" height="20" viewBox="0 0 60 20">
      <path
        className="draw-spark"
        pathLength="1"
        d={path}
        style={{ stroke: color, fill: 'none' }}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function arrow(delta) {
  if (delta == null) return null
  if (delta > 0) return '▲'
  if (delta < 0) return '▼'
  return '●'
}

function deltaClass(delta) {
  if (delta == null) return 'flat'
  if (delta > 0) return 'up'
  if (delta < 0) return 'down'
  return 'flat'
}

export default function StatRow({ logs, whoopData, settings, activities }) {
  const today = todayStr()
  const todayMerged = mergeWhoopForDate(today, logs?.[today], whoopData)

  // ── Resting HR ──────────────────────────────────────────────
  const rhr = parseFloat(todayMerged?.body?.rhr)
  const rhrNum = isFinite(rhr) ? Math.round(rhr) : null
  const last30 = daysWindow(30)
  const last30Rhr = last30.map(d => {
    const v = parseFloat(mergeWhoopForDate(d, logs?.[d], whoopData)?.body?.rhr)
    return isFinite(v) ? v : null
  })
  const prior30Rhr = last30Rhr.slice(0, -1).filter(v => v !== null)
  const avgPrior30Rhr = prior30Rhr.length ? prior30Rhr.reduce((a, b) => a + b, 0) / prior30Rhr.length : null
  const rhrDelta = (rhrNum != null && avgPrior30Rhr != null) ? Math.round(rhrNum - avgPrior30Rhr) : null

  // ── Weekly load ─────────────────────────────────────────────
  const stravaKm = kmByDateMap(activities)
  const weekStart = startOfWeek()
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d.toISOString().split('T')[0]
  })
  const todayIdx = (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1)
  const weekLoads = weekDays.map((d, i) => i <= todayIdx ? computeLoadForDay(d, logs, activities, stravaKm) : null)
  const weeklyLoadValue = weekLoads.filter(v => v !== null).reduce((s, v) => s + v, 0)
  const weeklyLoadRound = Math.round(weeklyLoadValue)

  // Prior week (Mon..Sun fully complete)
  const lastWeekStart = new Date(weekStart); lastWeekStart.setDate(lastWeekStart.getDate() - 7)
  const lastWeekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lastWeekStart); d.setDate(d.getDate() + i); return d.toISOString().split('T')[0]
  })
  const lastWeekLoad = lastWeekDays.reduce((s, d) => s + computeLoadForDay(d, logs, activities, stravaKm), 0)
  const weekLoadDelta = weeklyLoadValue && lastWeekLoad
    ? Math.round(weeklyLoadValue - lastWeekLoad)
    : null

  // ── Sleep ───────────────────────────────────────────────────
  const hours = parseFloat(todayMerged?.sleep?.hoursSlept)
  const hoursValid = isFinite(hours)
  const sleepValue = hoursValid ? formatHoursColon(hours) : null
  const last7 = daysWindow(7)
  const last7Hours = last7.map(d => {
    const v = parseFloat(mergeWhoopForDate(d, logs?.[d], whoopData)?.sleep?.hoursSlept)
    return isFinite(v) ? v : null
  })
  const sleepTarget = parseFloat(settings?.hoursSlept?.value)
  const sleepAtTarget = hoursValid && isFinite(sleepTarget) && hours >= sleepTarget

  // ── HRV ─────────────────────────────────────────────────────
  const hrv = parseFloat(todayMerged?.body?.hrv)
  const hrvNum = isFinite(hrv) ? Math.round(hrv) : null
  const last7Hrv = last7.map(d => {
    const v = parseFloat(mergeWhoopForDate(d, logs?.[d], whoopData)?.body?.hrv)
    return isFinite(v) ? v : null
  })
  const prior7Hrv = last7Hrv.slice(0, -1).filter(v => v !== null)
  const avgPrior7Hrv = prior7Hrv.length ? prior7Hrv.reduce((a, b) => a + b, 0) / prior7Hrv.length : null
  const hrvDelta = (hrvNum != null && avgPrior7Hrv != null) ? Math.round(hrvNum - avgPrior7Hrv) : null

  // ── Steps (no source yet) ───────────────────────────────────
  // Per the audit: keep the tile, show "—", helper text "No data yet".

  return (
    <section className="stat-row r r-4" aria-label="Daily stats">

      <div className="stat">
        <div className="label">Resting HR</div>
        <div className="value">
          {rhrNum != null ? rhrNum : '—'}
          <span className="unit">bpm</span>
        </div>
        <div className="row">
          <span className={`delta ${deltaClass(rhrDelta)}`}>
            {rhrDelta != null
              ? <>{arrow(rhrDelta)} {Math.abs(rhrDelta)} · 30d</>
              : 'no baseline'}
          </span>
          <MiniSpark values={last30Rhr} />
        </div>
      </div>

      <div className="stat">
        <div className="label">Weekly load</div>
        <div className="value">{weeklyLoadRound > 0 ? weeklyLoadRound : '—'}</div>
        <div className="row">
          <span className={`delta ${deltaClass(weekLoadDelta)}`}>
            {weekLoadDelta != null
              ? <>{arrow(weekLoadDelta)} {Math.abs(weekLoadDelta)} · wk</>
              : 'no baseline'}
          </span>
          <MiniSpark values={weekLoads} />
        </div>
      </div>

      <div className="stat">
        <div className="label">Sleep</div>
        <div className="value">
          {sleepValue || '—'}
          {sleepValue && <span className="unit">h</span>}
        </div>
        <div className="row">
          <span className={`delta ${sleepAtTarget ? 'flat' : deltaClass(hoursValid && isFinite(sleepTarget) ? hours - sleepTarget : null)}`}>
            {sleepAtTarget
              ? <>● target</>
              : hoursValid && isFinite(sleepTarget)
                ? <>{arrow(hours - sleepTarget)} {Math.abs(hours - sleepTarget).toFixed(1)}h · target</>
                : '—'}
          </span>
          <MiniSpark values={last7Hours} />
        </div>
      </div>

      <div className="stat">
        <div className="label">HRV</div>
        <div className="value">
          {hrvNum != null ? hrvNum : '—'}
          <span className="unit">ms</span>
        </div>
        <div className="row">
          <span className={`delta ${deltaClass(hrvDelta)}`}>
            {hrvDelta != null
              ? <>{arrow(hrvDelta)} {Math.abs(hrvDelta)} · 7d</>
              : 'no baseline'}
          </span>
          <MiniSpark values={last7Hrv} />
        </div>
      </div>

      <div className="stat">
        <div className="label">Steps</div>
        <div className="value">—</div>
        <div className="helper">No data yet</div>
      </div>

    </section>
  )
}
