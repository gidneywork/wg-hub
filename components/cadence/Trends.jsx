'use client'

import { useState } from 'react'
import { getCurrentWeek } from '../../lib/plan'
import { evaluateDelta, getCalorieTargetMode } from '../../lib/calories'
import {
  localIso,
  daysWindow,
  mergeWhoopForDate,
  kmByDateMap,
  getKmForDate,
  startOfWeek,
} from './helpers'

// ─── Shared chart geometry ──────────────────────────────────────────
const W = 560
const TOP = 25
const BOT = 150
const H = BOT - TOP

function clean(values) {
  return values.map(v => {
    const n = typeof v === 'number' ? v : parseFloat(v)
    return isFinite(n) ? n : null
  })
}

function buildLine(values, yMin, yMax) {
  const arr = clean(values)
  const span = arr.length - 1 || 1
  const points = []
  arr.forEach((v, i) => {
    if (v === null) return
    const x = (i / span) * W
    const y = BOT - ((Math.min(Math.max(v, yMin), yMax) - yMin) / (yMax - yMin)) * H
    points.push([x, y])
  })
  if (points.length < 2) return { linePath: null, fillPath: null, points }
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const fillPath = `${linePath} L ${points[points.length - 1][0].toFixed(1)} ${BOT} L ${points[0][0].toFixed(1)} ${BOT} Z`
  return { linePath, fillPath, points }
}

// Variant of buildLine that preserves gaps: null values break the line into
// separate subpaths rather than connecting across missing data.
function buildLineWithGaps(values, yMin, yMax) {
  const arr = clean(values)
  const span = arr.length - 1 || 1
  const segments = []
  let seg = null
  arr.forEach((v, i) => {
    if (v === null) {
      if (seg) { segments.push(seg); seg = null }
      return
    }
    const x = (i / span) * W
    const y = BOT - ((Math.min(Math.max(v, yMin), yMax) - yMin) / (yMax - yMin)) * H
    if (!seg) seg = []
    seg.push([x, y])
  })
  if (seg) segments.push(seg)
  const renderable = segments.filter(s => s.length >= 2)
  if (!renderable.length) return { linePath: null, fillPaths: [], points: segments.flat() }
  const linePath = renderable
    .map(s => s.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' '))
    .join(' ')
  const fillPaths = renderable.map(s => {
    const lp = s.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
    return `${lp} L ${s[s.length - 1][0].toFixed(1)} ${BOT} L ${s[0][0].toFixed(1)} ${BOT} Z`
  })
  return { linePath, fillPaths, points: segments.flat() }
}

// Computes a padded integer axis range from actual data.
// Falls back to fallback=[min,max] when no data; enforces a minimum span.
function computeLineAxis(values, fallback, minSpan) {
  const valid = clean(values).filter(v => v !== null)
  if (!valid.length) return { axisMin: fallback[0], axisMax: fallback[1] }
  const lo = Math.min(...valid)
  const hi = Math.max(...valid)
  const rawSpan = hi - lo || 1
  const pad = Math.max(2, Math.round(rawSpan * 0.15))
  let axisMin = Math.floor(lo) - pad
  let axisMax = Math.ceil(hi) + pad
  if (axisMax - axisMin < minSpan) {
    const centre = Math.round((lo + hi) / 2)
    axisMin = centre - Math.ceil(minSpan / 2)
    axisMax = centre + Math.ceil(minSpan / 2)
  }
  return { axisMin, axisMax }
}

function formatXLabel(d) {
  if (!d) return ''
  const date = new Date(d + 'T00:00:00')
  return date
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
    .toUpperCase()
}

function xAxisTicks(days, count = 5) {
  if (!days?.length) return []
  const ticks = []
  for (let i = 0; i < count; i++) {
    const idx = Math.round(i * (days.length - 1) / (count - 1))
    ticks.push({ idx, x: (idx / (days.length - 1)) * W, label: formatXLabel(days[idx]) })
  }
  return ticks
}

function GridLines() {
  return (
    <>
      <line x1="0" y1="25"  x2="560" y2="25"  style={{ stroke: 'var(--chart-grid)' }}     strokeWidth="1" strokeDasharray="2 4" />
      <line x1="0" y1="75"  x2="560" y2="75"  style={{ stroke: 'var(--chart-grid)' }}     strokeWidth="1" strokeDasharray="2 4" />
      <line x1="0" y1="125" x2="560" y2="125" style={{ stroke: 'var(--chart-grid)' }}     strokeWidth="1" strokeDasharray="2 4" />
      <line x1="0" y1="150" x2="560" y2="150" style={{ stroke: 'var(--chart-baseline)' }} strokeWidth="1" />
    </>
  )
}

function XAxisLabels({ ticks }) {
  return (
    <>
      {ticks.map((t, i) => (
        <text
          key={i}
          x={t.x}
          y="168"
          fontFamily="JetBrains Mono"
          fontSize="9"
          style={{ fill: 'var(--chart-axis)' }}
          textAnchor={i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle'}
        >
          {t.label}
        </text>
      ))}
    </>
  )
}

function YAxisLeft({ labels }) {
  // labels: [topValue, midValue, bottomValue]
  return (
    <>
      <text x="-6" y="29"  textAnchor="end" fontFamily="JetBrains Mono" fontSize="9" style={{ fill: 'var(--chart-axis)' }}>{labels[0]}</text>
      <text x="-6" y="79"  textAnchor="end" fontFamily="JetBrains Mono" fontSize="9" style={{ fill: 'var(--chart-axis)' }}>{labels[1]}</text>
      <text x="-6" y="129" textAnchor="end" fontFamily="JetBrains Mono" fontSize="9" style={{ fill: 'var(--chart-axis)' }}>{labels[2]}</text>
    </>
  )
}

function YAxisRight({ labels, color = 'var(--chart-axis-slate)' }) {
  return (
    <>
      <text x="566" y="29"  textAnchor="start" fontFamily="JetBrains Mono" fontSize="9" style={{ fill: color }}>{labels[0]}</text>
      <text x="566" y="79"  textAnchor="start" fontFamily="JetBrains Mono" fontSize="9" style={{ fill: color }}>{labels[1]}</text>
      <text x="566" y="129" textAnchor="start" fontFamily="JetBrains Mono" fontSize="9" style={{ fill: color }}>{labels[2]}</text>
    </>
  )
}

function mean(values) {
  const c = clean(values).filter(v => v !== null)
  return c.length ? c.reduce((a, b) => a + b, 0) / c.length : null
}

function deltaStr(curr, prev, opts = {}) {
  if (curr == null || prev == null) return null
  const diff = curr - prev
  const sign = diff > 0 ? '▲' : diff < 0 ? '▼' : '●'
  const abs = Math.abs(diff)
  const rounded = opts.decimals != null ? abs.toFixed(opts.decimals) : Math.round(abs)
  return `${sign} ${rounded}${opts.suffix || ''}`
}

// ─── Period model ───────────────────────────────────────────────────
function periodDays(period) {
  if (period === '7D')  return 7
  if (period === '30D') return 30
  if (period === '6M')  return 183
  if (period === '1Y')  return 365
  if (period === 'YTD') {
    const start = new Date(new Date().getFullYear(), 0, 1)
    return Math.ceil((Date.now() - start.getTime()) / 86400000) + 1
  }
  return 30
}

// ─── Chart: HRV & resting heart rate ────────────────────────────────
function HrvRhrChart({ logs, whoopData, days, prevDays }) {
  const hrvValues = days.map(d => parseFloat(mergeWhoopForDate(d, logs?.[d], whoopData)?.body?.hrv))
  const rhrValues = days.map(d => parseFloat(mergeWhoopForDate(d, logs?.[d], whoopData)?.body?.rhr))
  const hrvCurr = parseFloat(mergeWhoopForDate(days[days.length - 1], logs?.[days[days.length - 1]], whoopData)?.body?.hrv)
  const rhrCurr = parseFloat(mergeWhoopForDate(days[days.length - 1], logs?.[days[days.length - 1]], whoopData)?.body?.rhr)
  const hrvPrev = mean(prevDays.map(d => parseFloat(mergeWhoopForDate(d, logs?.[d], whoopData)?.body?.hrv)))
  const rhrPrev = mean(prevDays.map(d => parseFloat(mergeWhoopForDate(d, logs?.[d], whoopData)?.body?.rhr)))
  const hrvAvg = mean(hrvValues)
  const rhrAvg = mean(rhrValues)

  const { axisMin: hrvMin, axisMax: hrvMax } = computeLineAxis(hrvValues, [30, 80], 20)
  const { axisMin: rhrMin, axisMax: rhrMax } = computeLineAxis(rhrValues, [44, 68], 8)

  const hrvLine = buildLineWithGaps(hrvValues, hrvMin, hrvMax)
  const rhrLine = buildLineWithGaps(rhrValues, rhrMin, rhrMax)
  const ticks = xAxisTicks(days)

  const hrvLabels = [String(hrvMax), String(Math.round((hrvMin + hrvMax) / 2)), String(hrvMin)]
  const rhrLabels = [String(rhrMax), String(Math.round((rhrMin + rhrMax) / 2)), String(rhrMin)]

  const hrvDelta = hrvAvg != null && hrvPrev != null ? deltaStr(hrvAvg, hrvPrev, { suffix: ' ms' }) : null
  const rhrDelta = rhrAvg != null && rhrPrev != null ? deltaStr(rhrAvg, rhrPrev, { suffix: ' bpm' }) : null
  const deltaLine = [hrvDelta, rhrDelta].filter(Boolean).join(' · ')

  return (
    <div className="chart-card">
      <div className="chart-head">
        <div>
          <div className="label">HRV &amp; resting heart rate</div>
          <div className="value">
            {isFinite(hrvCurr) ? Math.round(hrvCurr) : '—'}
            <span className="unit">ms HRV · {isFinite(rhrCurr) ? Math.round(rhrCurr) : '—'} bpm RHR</span>
          </div>
        </div>
        <div className="meta-right">
          {deltaLine && <div className="delta-line">{deltaLine}</div>}
          <div className="meta-sub">vs prev period</div>
        </div>
      </div>
      <svg viewBox="0 0 560 170" preserveAspectRatio="none" style={{ overflow: 'visible', width: '100%', height: 'auto' }}>
        <defs>
          <linearGradient id="cadHrvFade" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" style={{ stopColor: 'var(--clay)', stopOpacity: 0.18 }} />
            <stop offset="100%" style={{ stopColor: 'var(--clay)', stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <GridLines />
        <YAxisLeft labels={hrvLabels} />
        <YAxisRight labels={rhrLabels} />
        {hrvLine.fillPaths.map((fp, i) => (
          <path key={`hrv-fill-${i}`} className="draw-fill trend" d={fp} fill="url(#cadHrvFade)" />
        ))}
        {hrvLine.linePath && <path className="draw-line trend" pathLength="1" d={hrvLine.linePath} style={{ stroke: 'var(--clay)', fill: 'none' }} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />}
        {rhrLine.linePath && <path className="draw-line trend" pathLength="1" d={rhrLine.linePath} style={{ stroke: 'var(--slate)', fill: 'none' }} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 3" />}
        <XAxisLabels ticks={ticks} />
      </svg>
      <div className="legend">
        <span className="item"><span className="swatch clay" />HRV · ms</span>
        <span className="item"><span className="swatch slate" />Resting HR · bpm</span>
      </div>
    </div>
  )
}

// ─── Chart: Steps & calories out ────────────────────────────────────
// Dual-metric chart mirroring the HRV/RHR pattern: primary moss line
// (Steps, left axis) with fade fill, secondary slate dashed line
// (Calories out, right axis). Steps stays logs-only; caloriesOut reads
// merged Whoop data via mergeWhoopForDate (logs primary, Whoop fallback).
function StepsCaloriesOutChart({ logs, whoopData, days, prevDays }) {
  const stepsValues = days.map(d => parseFloat(logs?.[d]?.body?.steps))
  const coutValues  = days.map(d => parseFloat(mergeWhoopForDate(d, logs?.[d], whoopData)?.body?.caloriesOut))
  const stepsCurr   = stepsValues[stepsValues.length - 1]
  const coutCurr    = coutValues[coutValues.length - 1]
  const stepsAvg    = mean(stepsValues)
  const coutAvg     = mean(coutValues)
  const stepsPrev   = mean(prevDays.map(d => parseFloat(logs?.[d]?.body?.steps)))
  const coutPrev    = mean(prevDays.map(d => parseFloat(mergeWhoopForDate(d, logs?.[d], whoopData)?.body?.caloriesOut)))

  const stepsLine = buildLine(stepsValues, 0, 15000)
  const coutLine  = buildLine(coutValues,  0, 4000)
  const ticks = xAxisTicks(days)

  const sd = stepsAvg != null && stepsPrev != null ? deltaStr(stepsAvg, stepsPrev, { suffix: ' steps' }) : null
  const cd = coutAvg  != null && coutPrev  != null ? deltaStr(coutAvg,  coutPrev,  { suffix: ' kcal' })  : null
  const deltaLine = [sd, cd].filter(Boolean).join(' · ')

  return (
    <div className="chart-card">
      <div className="chart-head">
        <div>
          <div className="label">Steps &amp; calories out</div>
          <div className="value">
            {isFinite(stepsCurr) ? Math.round(stepsCurr) : '—'}
            <span className="unit">steps · {isFinite(coutCurr) ? Math.round(coutCurr) : '—'} kcal</span>
          </div>
        </div>
        <div className="meta-right">
          {deltaLine && <div className="delta-line">{deltaLine}</div>}
          <div className="meta-sub">vs prev period</div>
        </div>
      </div>
      <svg viewBox="0 0 560 170" preserveAspectRatio="none" style={{ overflow: 'visible', width: '100%', height: 'auto' }}>
        <defs>
          <linearGradient id="cadStepsFade" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" style={{ stopColor: 'var(--moss)', stopOpacity: 0.18 }} />
            <stop offset="100%" style={{ stopColor: 'var(--moss)', stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <GridLines />
        <YAxisLeft  labels={['15k','10k','5k']} />
        <YAxisRight labels={['4k','3k','2k']} />
        {stepsLine.fillPath && <path className="draw-fill trend" d={stepsLine.fillPath} fill="url(#cadStepsFade)" />}
        {stepsLine.linePath && <path className="draw-line trend" pathLength="1" d={stepsLine.linePath} style={{ stroke: 'var(--moss)',  fill: 'none' }} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />}
        {coutLine.linePath  && <path className="draw-line trend" pathLength="1" d={coutLine.linePath}  style={{ stroke: 'var(--slate)', fill: 'none' }} strokeWidth="1.5"  strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 3" />}
        <XAxisLabels ticks={ticks} />
      </svg>
      <div className="legend">
        <span className="item"><span className="swatch moss"  />Steps · count</span>
        <span className="item"><span className="swatch slate" />Calories out · kcal</span>
      </div>
    </div>
  )
}

// ─── Chart: Weekly running · km ─────────────────────────────────────
function WeeklyKmChart({ logs, activities, settings }) {
  // Build last 6 weeks of km (current week is the 6th, in-progress).
  const stravaKm = kmByDateMap(activities)
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const currentMonday = startOfWeek(now)
  const weeks = []
  for (let i = 5; i >= 0; i--) {
    const monday = new Date(currentMonday); monday.setDate(currentMonday.getDate() - 7 * i)
    const days = Array.from({ length: 7 }, (_, j) => {
      const d = new Date(monday); d.setDate(monday.getDate() + j)
      return localIso(d)
    })
    const km = days.reduce((s, d) => s + getKmForDate(d, logs, stravaKm), 0)
    weeks.push({ monday, days, km, isCurrent: i === 0 })
  }
  const target = parseFloat(settings?.weeklyKm?.value) || null
  const thisWeekKm = weeks[5].km
  const prev4 = weeks.slice(1, 5)
  const prev4avg = prev4.length ? prev4.reduce((s, w) => s + w.km, 0) / prev4.length : null
  const delta = prev4avg != null ? Math.round(thisWeekKm - prev4avg) : null

  // Scale: 0..max where max = max(target, weekly max) * 1.05
  const dataMax = Math.max(...weeks.map(w => w.km), target || 0)
  const yTop = Math.max(120, Math.ceil((dataMax * 1.05) / 20) * 20)
  const yMid = Math.round(yTop * 2 / 3)
  const yLow = Math.round(yTop / 3)
  const valueToY = (v) => BOT - (Math.min(Math.max(v, 0), yTop) / yTop) * H
  const targetY = target ? valueToY(target) : null

  const barWidth = 50
  const slotWidth = W / weeks.length
  const xFor = (i) => i * slotWidth + (slotWidth - barWidth) / 2

  return (
    <div className="chart-card">
      <div className="chart-head">
        <div>
          <div className="label">Weekly running · km</div>
          <div className="value">
            {Math.round(thisWeekKm) || '—'}
            <span className="unit">km · this week</span>
          </div>
        </div>
        <div className="meta-right">
          {delta != null && (
            <div className={`delta-line${delta < 0 ? ' down' : ''}`}>
              {delta > 0 ? '▲' : delta < 0 ? '▼' : '●'} {Math.abs(delta)} km
            </div>
          )}
          <div className="meta-sub">vs prev 4w avg</div>
        </div>
      </div>
      <svg viewBox="0 0 560 170" preserveAspectRatio="none" style={{ overflow: 'visible', width: '100%', height: 'auto' }}>
        <GridLines />
        <YAxisLeft labels={[String(yTop), String(yMid), String(yLow)]} />
        {targetY != null && (
          <>
            <line x1="0" y1={targetY} x2="560" y2={targetY} style={{ stroke: 'var(--slate)' }} strokeWidth="1" strokeDasharray="6 4" opacity="0.65" />
            <text x="556" y={targetY - 5} textAnchor="end" fontFamily="JetBrains Mono" fontSize="9" style={{ fill: 'var(--chart-axis-slate)' }}>target · {Math.round(target)}km</text>
          </>
        )}
        {weeks.map((w, i) => {
          const y = valueToY(w.km)
          const height = BOT - y
          if (w.isCurrent) {
            // In-progress: filled bar + dashed planned outline if target exists
            const plannedTop = targetY != null ? targetY : valueToY(yTop * 0.66)
            const plannedHeight = BOT - plannedTop
            return (
              <g key={i}>
                <rect x={xFor(i)} y={y} width={barWidth} height={height} style={{ fill: 'var(--moss)' }} rx="2" opacity="0.85" className="draw-bar" />
                <rect x={xFor(i)} y={plannedTop} width={barWidth} height={plannedHeight} fill="none" style={{ stroke: 'var(--chart-highlight)' }} strokeWidth="1" strokeDasharray="3 3" rx="2" />
                <text x={xFor(i) + barWidth / 2} y={y - 6} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="9" style={{ fill: 'var(--chart-highlight)' }}>{Math.round(w.km)}·prog</text>
              </g>
            )
          }
          return (
            <g key={i}>
              <rect x={xFor(i)} y={y} width={barWidth} height={height} style={{ fill: 'var(--moss)' }} rx="2" className="draw-bar" />
              <text x={xFor(i) + barWidth / 2} y={y - 6} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="9" style={{ fill: 'var(--chart-highlight)' }}>{Math.round(w.km)}</text>
            </g>
          )
        })}
        {weeks.map((w, i) => {
          const label = w.monday.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()
          return (
            <text key={i} x={xFor(i)} y="168" fontFamily="JetBrains Mono" fontSize="9" style={{ fill: 'var(--chart-axis)' }}>{label}</text>
          )
        })}
      </svg>
      <div className="legend">
        <span className="item"><span className="swatch moss" />Completed km</span>
        {target != null && <span className="item"><span className="swatch slate" />{Math.round(target)}km target</span>}
      </div>
    </div>
  )
}

// ─── Chart: Sleep & recovery scores ─────────────────────────────────
function SleepRecoveryChart({ logs, whoopData, days, prevDays }) {
  const sleepValues = days.map(d => parseFloat(mergeWhoopForDate(d, logs?.[d], whoopData)?.sleep?.sleepScore))
  const recoveryValues = days.map(d => parseFloat(mergeWhoopForDate(d, logs?.[d], whoopData)?.sleep?.recoveryScore))
  const sleepCurr = sleepValues[sleepValues.length - 1]
  const recoveryCurr = recoveryValues[recoveryValues.length - 1]
  const sleepAvg = mean(sleepValues)
  const recoveryAvg = mean(recoveryValues)
  const sleepPrev = mean(prevDays.map(d => parseFloat(mergeWhoopForDate(d, logs?.[d], whoopData)?.sleep?.sleepScore)))
  const recoveryPrev = mean(prevDays.map(d => parseFloat(mergeWhoopForDate(d, logs?.[d], whoopData)?.sleep?.recoveryScore)))

  const sleepLine = buildLine(sleepValues, 0, 100)
  const recoveryLine = buildLine(recoveryValues, 0, 100)
  const ticks = xAxisTicks(days)
  const sd = sleepAvg != null && sleepPrev != null ? deltaStr(sleepAvg, sleepPrev) : null
  const rd = recoveryAvg != null && recoveryPrev != null ? deltaStr(recoveryAvg, recoveryPrev) : null
  const deltaLine = [sd, rd].filter(Boolean).join(' · ')

  return (
    <div className="chart-card">
      <div className="chart-head">
        <div>
          <div className="label">Sleep &amp; recovery scores</div>
          <div className="value">
            {isFinite(sleepCurr) ? Math.round(sleepCurr) : '—'}
            <span className="unit">sleep · {isFinite(recoveryCurr) ? Math.round(recoveryCurr) : '—'} recovery</span>
          </div>
        </div>
        <div className="meta-right">
          {deltaLine && <div className="delta-line">{deltaLine}</div>}
          <div className="meta-sub">vs prev period</div>
        </div>
      </div>
      <svg viewBox="0 0 560 170" preserveAspectRatio="none" style={{ overflow: 'visible', width: '100%', height: 'auto' }}>
        <defs>
          <linearGradient id="cadSleepFade" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" style={{ stopColor: 'var(--moss)', stopOpacity: 0.18 }} />
            <stop offset="100%" style={{ stopColor: 'var(--moss)', stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <GridLines />
        <YAxisLeft labels={['100','66','33']} />
        {sleepLine.fillPath && <path className="draw-fill trend-2" d={sleepLine.fillPath} fill="url(#cadSleepFade)" />}
        {sleepLine.linePath && <path className="draw-line trend-2" pathLength="1" d={sleepLine.linePath} style={{ stroke: 'var(--moss)', fill: 'none' }} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />}
        {recoveryLine.linePath && <path className="draw-line trend-2" pathLength="1" d={recoveryLine.linePath} style={{ stroke: 'var(--clay)', fill: 'none' }} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}
        <XAxisLabels ticks={ticks} />
      </svg>
      <div className="legend">
        <span className="item"><span className="swatch moss" />Sleep · /100</span>
        <span className="item"><span className="swatch clay" />Recovery · /100</span>
      </div>
    </div>
  )
}

// ─── Chart: Calories · daily balance + weight ───────────────────────
function CaloriesWeightChart({ logs, activities, days, prevDays, settings }) {
  const calsIn = days.map(d => parseFloat(logs?.[d]?.nutrition?.calories))
  const calsOut = days.map(d => {
    const acts = (activities || []).filter(a => (a.start_date || '').split('T')[0] === d)
    const total = acts.reduce((s, a) => s + (parseFloat(a.data?.calories) || 0), 0)
    return total > 0 ? total : null
  })

  // Weight with fill-forward
  let lastKnown = null
  const weights = days.map(d => {
    const w = parseFloat(logs?.[d]?.body?.weight)
    if (isFinite(w)) lastKnown = w
    return lastKnown
  })

  // Y-axis: calories (left) and weight (right)
  // Build dynamic ranges
  const allCals = [...calsIn.filter(v => isFinite(v)), ...calsOut.filter(v => v !== null)]
  const calMin = allCals.length ? Math.min(1500, ...allCals) : 1500
  const calMax = allCals.length ? Math.max(3500, ...allCals) : 3500
  const wValid = weights.filter(v => v !== null)
  const wMin = wValid.length ? Math.min(...wValid) - 1 : 74
  const wMax = wValid.length ? Math.max(...wValid) + 1 : 76
  const wMid = wValid.length ? (wMin + wMax) / 2 : 75

  const inLine = buildLine(calsIn, calMin, calMax)
  const outLine = buildLine(calsOut, calMin, calMax)
  const weightLine = buildLine(weights, wMin, wMax)

  // Deficit = mean(in - out)
  const deficits = days.map((d, i) => {
    const ci = isFinite(calsIn[i]) ? calsIn[i] : null
    const co = calsOut[i]
    if (ci == null) return null
    return ci - (co || 0)
  })
  const avgDeficit = mean(deficits)
  const wCurr = weights[weights.length - 1]
  const wPrev = parseFloat(logs?.[days[0]]?.body?.weight)
  const wPrior = parseFloat(logs?.[prevDays[0]]?.body?.weight)
  const wDelta = isFinite(wCurr) && (isFinite(wPrev) || isFinite(wPrior))
    ? wCurr - (isFinite(wPrev) ? wPrev : wPrior)
    : null

  const ticks = xAxisTicks(days)
  const calMode = getCalorieTargetMode(settings)
  const calResult = calMode ? evaluateDelta(avgDeficit, calMode) : null
  const showCalPill = calResult && calResult.status !== 'no_data' && calResult.status !== 'no_mode'

  return (
    <div className="chart-card">
      <div className="chart-head">
        <div>
          <div className="label">Calories · daily balance + weight</div>
          <div className="value">
            {avgDeficit != null
              ? <>{avgDeficit < 0 ? '−' : '+'}{Math.abs(Math.round(avgDeficit)).toLocaleString()}</>
              : '—'}
            <span className="unit">avg deficit</span>
          </div>
          {showCalPill && (
            <span className={`cal-pill${calResult.status === 'off_target' ? ' off' : ''}`}>
              {calResult.status === 'on_target' ? 'on target' : 'off target'}
            </span>
          )}
        </div>
        <div className="meta-right">
          {wDelta != null && (
            <div className={`delta-line${wDelta > 0 ? ' down' : ''}`}>
              {wDelta > 0 ? '▲' : wDelta < 0 ? '▼' : '●'} {Math.abs(wDelta).toFixed(1)} kg
            </div>
          )}
          <div className="meta-sub">weight · period</div>
        </div>
      </div>
      <svg viewBox="0 0 560 170" preserveAspectRatio="none" style={{ overflow: 'visible', width: '100%', height: 'auto' }}>
        <defs>
          <linearGradient id="cadInFade" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" style={{ stopColor: 'var(--moss)', stopOpacity: 0.20 }} />
            <stop offset="100%" style={{ stopColor: 'var(--moss)', stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <GridLines />
        <YAxisLeft labels={[`${(calMax/1000).toFixed(1)}k`, `${((calMin+calMax)/2000).toFixed(1)}k`, `${(calMin/1000).toFixed(1)}k`]} />
        <YAxisRight labels={[wMax.toFixed(0), wMid.toFixed(0), wMin.toFixed(0)]} />
        {inLine.fillPath && <path className="draw-fill trend-3" d={inLine.fillPath} fill="url(#cadInFade)" />}
        {inLine.linePath && <path className="draw-line trend-3" pathLength="1" d={inLine.linePath} style={{ stroke: 'var(--moss)', fill: 'none' }} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />}
        {outLine.linePath && <path className="draw-line trend-3" pathLength="1" d={outLine.linePath} style={{ stroke: 'var(--clay)', fill: 'none' }} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}
        {weightLine.linePath && <path className="draw-line trend-3" pathLength="1" d={weightLine.linePath} style={{ stroke: 'var(--slate)', fill: 'none' }} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 3" />}
        <XAxisLabels ticks={ticks} />
      </svg>
      <div className="legend">
        <span className="item"><span className="swatch moss" />Calories in</span>
        <span className="item"><span className="swatch clay" />Calories out</span>
        <span className="item"><span className="swatch slate" />Body weight · kg</span>
      </div>
    </div>
  )
}

// ─── Chart: Workout adherence · weekly ──────────────────────────────
function AdherenceChart({ plan, activities }) {
  // 6 weeks ending current. For each week: planned = count of non-rest plan days,
  // completed = count of days within that week that have ≥1 activity.
  const stravaActivityDays = new Set((activities || []).map(a => (a.start_date || '').split('T')[0]).filter(Boolean))
  const plannedPerDow = (getCurrentWeek(plan, new Date()) || []).map(d => (d?.sessions?.[0]?.type === 'rest') ? 0 : 1)
  const plannedPerWeek = plannedPerDow.reduce((s, v) => s + v, 0) || 7

  const now = new Date(); now.setHours(0, 0, 0, 0)
  const currentMonday = startOfWeek(now)
  const todayIdx = (now.getDay() === 0 ? 6 : now.getDay() - 1)

  const weeks = []
  for (let i = 5; i >= 0; i--) {
    const monday = new Date(currentMonday); monday.setDate(currentMonday.getDate() - 7 * i)
    const days = Array.from({ length: 7 }, (_, j) => {
      const d = new Date(monday); d.setDate(monday.getDate() + j)
      return { date: localIso(d), dow: j }
    })
    const isCurrent = i === 0
    let completed = 0
    days.forEach(({ date, dow }) => {
      if (isCurrent && dow > todayIdx) return
      if (plannedPerDow[dow] === 0) return
      if (stravaActivityDays.has(date)) completed++
    })
    const denom = isCurrent
      ? plannedPerDow.slice(0, todayIdx + 1).reduce((s, v) => s + v, 0) || 1
      : plannedPerWeek
    const pct = Math.min(100, Math.round((completed / denom) * 100))
    weeks.push({ monday, completed, pct, isCurrent })
  }

  const prev5 = weeks.slice(0, 5)
  const prev5avg = prev5.length ? prev5.reduce((s, w) => s + w.pct, 0) / prev5.length : null
  const thisPct = weeks[5].pct
  const delta = prev5avg != null ? Math.round(thisPct - prev5avg) : null
  const avgPct = Math.round(mean(weeks.map(w => w.pct)) || 0)

  const barWidth = 55
  const slotWidth = W / weeks.length
  const xFor = (i) => i * slotWidth + (slotWidth - barWidth) / 2
  const fullTop = 25
  const fullBot = 150
  const fullHeight = fullBot - fullTop
  const completedY = (pct) => fullBot - (pct / 100) * fullHeight

  return (
    <div className="chart-card">
      <div className="chart-head">
        <div>
          <div className="label">Workout adherence · weekly</div>
          <div className="value">
            {avgPct || '—'}
            <span className="unit">% completed</span>
          </div>
        </div>
        <div className="meta-right">
          {delta != null && (
            <div className={`delta-line${delta < 0 ? ' down' : ''}`}>
              {delta > 0 ? '▲' : delta < 0 ? '▼' : '●'} {Math.abs(delta)} pts
            </div>
          )}
          <div className="meta-sub">vs prev 5w</div>
        </div>
      </div>
      <svg viewBox="0 0 560 170" preserveAspectRatio="none" style={{ overflow: 'visible', width: '100%', height: 'auto' }}>
        <GridLines />
        <YAxisLeft labels={['100%','66%','33%']} />
        {weeks.map((w, i) => {
          const compY = completedY(w.pct)
          const compHeight = fullBot - compY
          return (
            <g key={i}>
              <rect x={xFor(i)} y={fullTop} width={barWidth} height={fullHeight} style={{ fill: 'var(--moss-soft)' }} rx="2" opacity={w.isCurrent ? 0.5 : 1} className="draw-bar" />
              <rect x={xFor(i)} y={compY} width={barWidth} height={compHeight} style={{ fill: 'var(--moss)' }} rx="2" opacity={w.isCurrent ? 0.85 : 1} className="draw-bar" />
              {w.isCurrent && (
                <rect x={xFor(i)} y={fullTop} width={barWidth} height={fullHeight} fill="none" style={{ stroke: 'var(--chart-highlight)' }} strokeWidth="1" strokeDasharray="3 3" rx="2" />
              )}
              <text x={xFor(i) + barWidth / 2} y={14} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="9" style={{ fill: 'var(--chart-highlight)' }}>{w.isCurrent ? 'in prog' : `${w.pct}%`}</text>
            </g>
          )
        })}
        {weeks.map((w, i) => {
          // ISO-ish week number: weeks since Jan 1
          const start = new Date(w.monday.getFullYear(), 0, 1)
          const week = Math.ceil((((w.monday - start) / 86400000) + start.getDay() + 1) / 7)
          return (
            <text key={i} x={xFor(i)} y="168" fontFamily="JetBrains Mono" fontSize="9" style={{ fill: 'var(--chart-axis)' }}>W{week}</text>
          )
        })}
      </svg>
      <div className="legend">
        <span className="item"><span className="swatch moss" />Completed</span>
        <span className="item"><span className="swatch moss-soft" />Planned · not yet done</span>
      </div>
    </div>
  )
}

// ─── Chart: Daily nutrition · macros ────────────────────────────────
function NutritionChart({ logs, days }) {
  const cals = days.map(d => parseFloat(logs?.[d]?.nutrition?.calories))
  const protein = days.map(d => parseFloat(logs?.[d]?.nutrition?.protein))
  const carbs = days.map(d => parseFloat(logs?.[d]?.nutrition?.carbs))

  const avgCal = mean(cals)
  const avgP = mean(protein)
  const avgC = mean(carbs)

  // Left axis: macro grams (0..400). Right axis: calories (0..3500).
  const gMin = 0, gMax = 400
  const cMin = 0, cMax = 3500

  // Calories are scaled to the macro range so the three series share the visual height.
  const calsScaled = cals.map(v => isFinite(v) ? (v / cMax) * gMax : null)

  const calLine = buildLine(calsScaled, gMin, gMax)
  const proteinLine = buildLine(protein, gMin, gMax)
  const carbsLine = buildLine(carbs, gMin, gMax)
  const ticks = xAxisTicks(days)

  return (
    <div className="chart-card">
      <div className="chart-head">
        <div>
          <div className="label">Daily nutrition · macros</div>
          <div className="value">
            {avgCal != null ? Math.round(avgCal).toLocaleString() : '—'}
            <span className="unit">kcal/day avg</span>
          </div>
        </div>
        <div className="meta-right">
          {(avgP != null || avgC != null) && (
            <div className="delta-line">P {avgP != null ? Math.round(avgP) : '—'} · C {avgC != null ? Math.round(avgC) : '—'}</div>
          )}
          <div className="meta-sub">avg g/day</div>
        </div>
      </div>
      <svg viewBox="0 0 560 170" preserveAspectRatio="none" style={{ overflow: 'visible', width: '100%', height: 'auto' }}>
        <defs>
          <linearGradient id="cadCalFade" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" style={{ stopColor: 'var(--moss)', stopOpacity: 0.18 }} />
            <stop offset="100%" style={{ stopColor: 'var(--moss)', stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <GridLines />
        <YAxisLeft labels={['400g','250g','100g']} />
        <YAxisRight labels={['3.5k','2.8k','2.1k']} color="var(--moss)" />
        {calLine.fillPath && <path className="draw-fill trend-5" d={calLine.fillPath} fill="url(#cadCalFade)" />}
        {calLine.linePath && <path className="draw-line trend-5" pathLength="1" d={calLine.linePath} style={{ stroke: 'var(--moss)', fill: 'none' }} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />}
        {proteinLine.linePath && <path className="draw-line trend-5" pathLength="1" d={proteinLine.linePath} style={{ stroke: 'var(--clay)', fill: 'none' }} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}
        {carbsLine.linePath && <path className="draw-line trend-5" pathLength="1" d={carbsLine.linePath} style={{ stroke: 'var(--slate)', fill: 'none' }} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 3" />}
        <XAxisLabels ticks={ticks} />
      </svg>
      <div className="legend">
        <span className="item"><span className="swatch moss" />Calories · kcal</span>
        <span className="item"><span className="swatch clay" />Protein · g</span>
        <span className="item"><span className="swatch slate" />Carbs · g</span>
      </div>
    </div>
  )
}

// ─── Chart: Lifts volume ─────────────────────────────────────────────
// Weekly weight×reps sum across all loaded exercises. Bodyweight lifts
// (weight === 0) are excluded. 6-week window, clay bars.
function LiftsVolumeChart({ logs }) {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const currentMonday = startOfWeek(now)
  const weeks = []
  for (let i = 5; i >= 0; i--) {
    const monday = new Date(currentMonday); monday.setDate(currentMonday.getDate() - 7 * i)
    const days = Array.from({ length: 7 }, (_, j) => {
      const d = new Date(monday); d.setDate(monday.getDate() + j)
      return localIso(d)
    })
    const vol = days.reduce((s, d) => {
      const lifts = Array.isArray(logs?.[d]?.lifts) ? logs[d].lifts : []
      return s + lifts.reduce((ls, lift) => {
        const w = parseFloat(lift.weight)
        const r = parseInt(lift.reps, 10) || 0
        return ls + (isFinite(w) && w > 0 ? w * r : 0)
      }, 0)
    }, 0)
    weeks.push({ monday, days, vol, isCurrent: i === 0 })
  }

  const thisWeekVol = weeks[5].vol
  const prev4Vols = weeks.slice(1, 5).filter(w => w.vol > 0)
  const prev4avg  = prev4Vols.length
    ? prev4Vols.reduce((s, w) => s + w.vol, 0) / prev4Vols.length
    : null
  const delta = prev4avg != null && thisWeekVol > 0 ? Math.round(thisWeekVol - prev4avg) : null

  const dataMax = Math.max(...weeks.map(w => w.vol), 0)
  const yTop = dataMax > 0 ? Math.max(1000, Math.ceil((dataMax * 1.1) / 500) * 500) : 5000
  const yMid = Math.round(yTop * 2 / 3)
  const yLow = Math.round(yTop / 3)
  const fmtY = v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
  const valueToY = (v) => BOT - (Math.min(Math.max(v, 0), yTop) / yTop) * H

  const barWidth  = 50
  const slotWidth = W / weeks.length
  const xFor      = (i) => i * slotWidth + (slotWidth - barWidth) / 2
  const hasAny    = weeks.some(w => w.vol > 0)

  return (
    <div className="chart-card">
      <div className="chart-head">
        <div>
          <div className="label">Lifts · weekly volume</div>
          <div className="value">
            {thisWeekVol > 0 ? Math.round(thisWeekVol).toLocaleString('en-GB') : '—'}
            <span className="unit">kg · this week</span>
          </div>
        </div>
        <div className="meta-right">
          {delta != null && (
            <div className={`delta-line${delta < 0 ? ' down' : ''}`}>
              {delta > 0 ? '▲' : delta < 0 ? '▼' : '●'} {Math.abs(delta).toLocaleString('en-GB')} kg
            </div>
          )}
          <div className="meta-sub">vs prev 4w avg</div>
        </div>
      </div>
      <svg viewBox="0 0 560 170" preserveAspectRatio="none" style={{ overflow: 'visible', width: '100%', height: 'auto' }}>
        <GridLines />
        <YAxisLeft labels={[fmtY(yTop), fmtY(yMid), fmtY(yLow)]} />
        {!hasAny && (
          <text x="280" y="90" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="9" style={{ fill: 'var(--chart-axis)' }}>No lifts logged yet</text>
        )}
        {weeks.map((w, i) => {
          if (w.vol <= 0) return null
          const y = valueToY(w.vol)
          const height = BOT - y
          if (height <= 0) return null
          return (
            <g key={i}>
              <rect
                x={xFor(i)} y={y} width={barWidth} height={height}
                style={{ fill: 'var(--clay)' }} rx="2"
                className="draw-bar"
                opacity={w.isCurrent ? 0.85 : 1}
              />
              <text x={xFor(i) + barWidth / 2} y={y - 6} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="9" style={{ fill: 'var(--chart-highlight)' }}>
                {w.vol >= 1000 ? `${(w.vol / 1000).toFixed(1)}k` : Math.round(w.vol)}
              </text>
            </g>
          )
        })}
        {weeks.map((w, i) => (
          <text key={i} x={xFor(i)} y="168" fontFamily="JetBrains Mono" fontSize="9" style={{ fill: 'var(--chart-axis)' }}>
            {w.monday.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()}
          </text>
        ))}
      </svg>
      <div className="legend">
        <span className="item"><span className="swatch clay" />Volume · kg (weighted only)</span>
      </div>
    </div>
  )
}

// ─── Section wrapper ────────────────────────────────────────────────
export default function Trends({ logs, whoopData, activities, settings, plan }) {
  const [period, setPeriod] = useState('30D')
  const n = periodDays(period)
  const days = daysWindow(n)
  const prevEndDate = new Date(); prevEndDate.setDate(prevEndDate.getDate() - n)
  const prevDays = daysWindow(n, prevEndDate)

  return (
    <section className="section r r-9">
      <div className="section-head">
        <h2>Trends</h2>
        <div className="right">
          <div className="toggle">
            {['7D','30D','6M','1Y','YTD'].map(p => (
              <button
                key={p}
                type="button"
                className={period === p ? 'active' : ''}
                onClick={() => setPeriod(p)}
              >
                {p}
              </button>
            ))}
          </div>
          <button type="button" className="link">All charts →</button>
        </div>
      </div>

      <div className="charts-grid">
        <HrvRhrChart            logs={logs} whoopData={whoopData} days={days} prevDays={prevDays} />
        <WeeklyKmChart          logs={logs} activities={activities} settings={settings} />
        <SleepRecoveryChart     logs={logs} whoopData={whoopData} days={days} prevDays={prevDays} />
        <CaloriesWeightChart    logs={logs} activities={activities} days={days} prevDays={prevDays} settings={settings} />
        <AdherenceChart         plan={plan} activities={activities} />
        <NutritionChart         logs={logs} days={days} />
        <StepsCaloriesOutChart  logs={logs} whoopData={whoopData} days={days} prevDays={prevDays} />
        <LiftsVolumeChart       logs={logs} />
      </div>
    </section>
  )
}
