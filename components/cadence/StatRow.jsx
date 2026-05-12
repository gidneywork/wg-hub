'use client'

import {
  localIso,
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

// Arrow always reflects literal direction of change.
// Colour reflects semantic goodness for the metric:
//   'higher'  → bigger is better (HRV, sleep, recovery, load, steps)
//   'lower'   → smaller is better (RHR)
// .up class = moss (good), .down class = clay (bad), .flat class = neutral.
function deltaClass(delta, direction = 'higher') {
  if (delta == null || delta === 0) return 'flat'
  const better = direction === 'lower' ? delta < 0 : delta > 0
  return better ? 'up' : 'down'
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
    return localIso(d)
  })
  const todayIdx = (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1)
  const weekLoads = weekDays.map((d, i) => i <= todayIdx ? computeLoadForDay(d, logs, activities, stravaKm) : null)
  const weeklyLoadValue = weekLoads.filter(v => v !== null).reduce((s, v) => s + v, 0)
  const weeklyLoadRound = Math.round(weeklyLoadValue)

  // Prior week (Mon..Sun fully complete)
  const lastWeekStart = new Date(weekStart); lastWeekStart.setDate(lastWeekStart.getDate() - 7)
  const lastWeekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lastWeekStart); d.setDate(d.getDate() + i); return localIso(d)
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

  // ── Steps ───────────────────────────────────────────────────
  // Manual-entry field on Daily Data; no Whoop sync yet so this reads
  // logs only (no mergeWhoopForDate fallback).
  const stepsToday = parseFloat(todayMerged?.body?.steps)
  const stepsNum = isFinite(stepsToday) ? Math.round(stepsToday) : null
  const last7Steps = last7.map(d => {
    const v = parseFloat(logs?.[d]?.body?.steps)
    return isFinite(v) ? v : null
  })
  const prior7Steps = last7Steps.slice(0, -1).filter(v => v !== null)
  const avgPrior7Steps = prior7Steps.length
    ? prior7Steps.reduce((a, b) => a + b, 0) / prior7Steps.length
    : null
  const stepsDelta = (stepsNum != null && avgPrior7Steps != null)
    ? Math.round(stepsNum - avgPrior7Steps)
    : null
  const stepsAvgPrior = avgPrior7Steps != null ? Math.round(avgPrior7Steps) : null

  return (
    <section className="stat-row r r-4" aria-label="Daily stats">

      <div className="stat">
        <div className="label">Resting HR</div>
        <div className="value">
          {rhrNum != null ? rhrNum : '—'}
          <span className="unit">bpm</span>
        </div>
        <div className="row">
          <span className={`delta ${deltaClass(rhrDelta, 'lower')}`}>
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
          <span className={`delta ${deltaClass(weekLoadDelta, 'higher')}`}>
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
          <span className={`delta ${sleepAtTarget ? 'flat' : deltaClass(hoursValid && isFinite(sleepTarget) ? hours - sleepTarget : null, 'higher')}`}>
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
          <span className={`delta ${deltaClass(hrvDelta, 'higher')}`}>
            {hrvDelta != null
              ? <>{arrow(hrvDelta)} {Math.abs(hrvDelta)} · 7d</>
              : 'no baseline'}
          </span>
          <MiniSpark values={last7Hrv} />
        </div>
      </div>

      <div className="stat">
        <div className="label">Steps</div>
        <div className="value">
          {stepsNum != null ? stepsNum : '—'}
          {stepsNum != null && <span className="unit">steps</span>}
        </div>
        <div className="row">
          <span className={`delta ${deltaClass(stepsDelta, 'higher')}`}>
            {stepsDelta != null
              ? <>{arrow(stepsDelta)} {Math.abs(stepsDelta)} vs prev 7d avg</>
              : stepsAvgPrior != null
                ? <>avg {stepsAvgPrior} last 7d</>
                : 'no data yet'}
          </span>
          <MiniSpark values={last7Steps} />
        </div>
      </div>

    </section>
  )
}
