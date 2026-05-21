'use client'

import {
  daysWindow,
  mergeWhoopForDate,
  formatHoursColon,
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

// Parses "HH:MM" to minutes, shifting times before 04:00 (pivot) by +1440
// so overnight bedtimes (e.g. 23:30) compare correctly against early times (e.g. 00:30).
const BEDTIME_PIVOT = 240

function parseBedtimeMins(str) {
  if (!str) return null
  const [h, m] = str.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return null
  const raw = h * 60 + m
  return raw < BEDTIME_PIVOT ? raw + 1440 : raw
}

// Formats pivot-adjusted minutes back to HH:MM. Values >= 1440 wrap to the next day.
function bedtimeMinsToStr(mins) {
  const wrapped = Math.round(mins) % 1440
  const h = Math.floor(wrapped / 60)
  const m = wrapped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Returns the mean of non-null values if there are at least minPoints of them; else null.
function rollingAvg(values, minPoints = 4) {
  const clean = values.filter(v => v !== null)
  if (clean.length < minPoints) return null
  return clean.reduce((a, b) => a + b, 0) / clean.length
}

export default function StatRow({ logs, whoopData, settings }) {
  // 30-day window kept for RHR sparkline (shows longer trajectory).
  const last30 = daysWindow(30)
  // 14-day window: last14.slice(7) = current week, last14.slice(0,7) = prior week.
  const last14     = daysWindow(14)
  const win7       = last14.slice(7)
  const win7prior  = last14.slice(0, 7)

  // ── Resting HR ──────────────────────────────────────────────
  const last30Rhr = last30.map(d => {
    const v = parseFloat(mergeWhoopForDate(d, logs?.[d], whoopData)?.body?.rhr)
    return isFinite(v) ? v : null
  })
  const win7Rhr = win7.map(d => {
    const v = parseFloat(mergeWhoopForDate(d, logs?.[d], whoopData)?.body?.rhr)
    return isFinite(v) ? v : null
  })
  const win7PriorRhr = win7prior.map(d => {
    const v = parseFloat(mergeWhoopForDate(d, logs?.[d], whoopData)?.body?.rhr)
    return isFinite(v) ? v : null
  })
  const avg7Rhr      = rollingAvg(win7Rhr)
  const avg7PriorRhr = rollingAvg(win7PriorRhr)
  const rhrDisplay   = avg7Rhr != null ? Math.round(avg7Rhr) : null
  const rhrDelta     = avg7Rhr != null && avg7PriorRhr != null ? Math.round(avg7Rhr - avg7PriorRhr) : null

  // ── Sleep ───────────────────────────────────────────────────
  const win7Hours = win7.map(d => {
    const v = parseFloat(mergeWhoopForDate(d, logs?.[d], whoopData)?.sleep?.hoursSlept)
    return isFinite(v) ? v : null
  })
  const avg7Hours    = rollingAvg(win7Hours)
  const sleepDisplay = avg7Hours != null ? formatHoursColon(avg7Hours) : null
  const sleepTarget  = parseFloat(settings?.hoursSlept?.value)
  const sleepAtTarget = avg7Hours != null && isFinite(sleepTarget) && avg7Hours >= sleepTarget

  // ── Bedtime ──────────────────────────────────────────────────
  // Reads schedule.bedtime directly from logs — manually entered, no Whoop source.
  const win7BedtimeMins      = win7.map(d => parseBedtimeMins(logs?.[d]?.schedule?.bedtime ?? null))
  const win7PriorBedtimeMins = win7prior.map(d => parseBedtimeMins(logs?.[d]?.schedule?.bedtime ?? null))
  const avg7BedtimeMins      = rollingAvg(win7BedtimeMins)
  const avg7PriorBedtimeMins = rollingAvg(win7PriorBedtimeMins)
  const bedtimeDisplay       = avg7BedtimeMins != null ? bedtimeMinsToStr(avg7BedtimeMins) : null
  const bedtimeDeltaMins     = avg7BedtimeMins != null && avg7PriorBedtimeMins != null
    ? Math.round(avg7BedtimeMins - avg7PriorBedtimeMins)
    : null

  // ── HRV ─────────────────────────────────────────────────────
  const win7Hrv = win7.map(d => {
    const v = parseFloat(mergeWhoopForDate(d, logs?.[d], whoopData)?.body?.hrv)
    return isFinite(v) ? v : null
  })
  const win7PriorHrv = win7prior.map(d => {
    const v = parseFloat(mergeWhoopForDate(d, logs?.[d], whoopData)?.body?.hrv)
    return isFinite(v) ? v : null
  })
  const avg7Hrv      = rollingAvg(win7Hrv)
  const avg7PriorHrv = rollingAvg(win7PriorHrv)
  const hrvDisplay   = avg7Hrv != null ? Math.round(avg7Hrv) : null
  const hrvDelta     = avg7Hrv != null && avg7PriorHrv != null ? Math.round(avg7Hrv - avg7PriorHrv) : null

  // ── Steps ───────────────────────────────────────────────────
  // Manual-entry field on Daily Data; no Whoop sync yet so this reads
  // logs only (no mergeWhoopForDate fallback).
  const win7Steps = win7.map(d => {
    const v = parseFloat(logs?.[d]?.body?.steps)
    return isFinite(v) ? v : null
  })
  const win7PriorSteps = win7prior.map(d => {
    const v = parseFloat(logs?.[d]?.body?.steps)
    return isFinite(v) ? v : null
  })
  const avg7Steps      = rollingAvg(win7Steps)
  const avg7PriorSteps = rollingAvg(win7PriorSteps)
  const stepsDisplay   = avg7Steps != null ? Math.round(avg7Steps) : null
  const stepsDelta     = avg7Steps != null && avg7PriorSteps != null
    ? Math.round(avg7Steps - avg7PriorSteps)
    : null

  return (
    <section className="stat-row r r-4" aria-label="Daily stats">

      <div className="stat">
        <div className="label">Resting HR</div>
        <div className="value">
          {rhrDisplay != null ? rhrDisplay : '—'}
          <span className="unit">bpm</span>
        </div>
        <div className="row">
          <span className={`delta ${deltaClass(rhrDelta, 'lower')}`}>
            {rhrDelta != null
              ? <>{arrow(rhrDelta)} {Math.abs(rhrDelta)} · 7d avg</>
              : 'no baseline'}
          </span>
          <MiniSpark values={last30Rhr} />
        </div>
      </div>

      <div className="stat">
        <div className="label">Sleep</div>
        <div className="value">
          {sleepDisplay || '—'}
          {sleepDisplay && <span className="unit">h</span>}
        </div>
        <div className="row">
          <span className={`delta ${sleepAtTarget ? 'flat' : deltaClass(avg7Hours != null && isFinite(sleepTarget) ? avg7Hours - sleepTarget : null, 'higher')}`}>
            {sleepAtTarget
              ? <>● target</>
              : avg7Hours != null && isFinite(sleepTarget)
                ? <>{arrow(avg7Hours - sleepTarget)} {Math.abs(avg7Hours - sleepTarget).toFixed(1)}h · target</>
                : '—'}
          </span>
          <MiniSpark values={win7Hours} />
        </div>
      </div>

      <div className="stat">
        <div className="label">Bedtime</div>
        <div className="value">{bedtimeDisplay ?? '—'}</div>
        <div className="row">
          <span className="delta flat">
            {bedtimeDeltaMins != null
              ? <>{arrow(bedtimeDeltaMins)} {Math.abs(bedtimeDeltaMins)}m · 7d avg</>
              : 'no baseline'}
          </span>
        </div>
      </div>

      <div className="stat">
        <div className="label">HRV</div>
        <div className="value">
          {hrvDisplay != null ? hrvDisplay : '—'}
          <span className="unit">ms</span>
        </div>
        <div className="row">
          <span className={`delta ${deltaClass(hrvDelta, 'higher')}`}>
            {hrvDelta != null
              ? <>{arrow(hrvDelta)} {Math.abs(hrvDelta)} · 7d avg</>
              : 'no baseline'}
          </span>
          <MiniSpark values={win7Hrv} />
        </div>
      </div>

      <div className="stat">
        <div className="label">Steps</div>
        <div className="value">
          {stepsDisplay != null ? stepsDisplay : '—'}
          {stepsDisplay != null && <span className="unit">steps</span>}
        </div>
        <div className="row">
          <span className={`delta ${deltaClass(stepsDelta, 'higher')}`}>
            {stepsDelta != null
              ? <>{arrow(stepsDelta)} {Math.abs(stepsDelta)} · 7d avg</>
              : null}
          </span>
          <MiniSpark values={win7Steps} />
        </div>
      </div>

    </section>
  )
}
