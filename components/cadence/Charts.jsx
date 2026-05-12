'use client'

import { useState, useMemo, useRef } from 'react'
import {
  localIso,
  daysWindow,
  startOfWeek,
  mergeWhoopForDate,
  kmByDateMap,
  getKmForDate,
  mean,
} from './helpers'
import './charts-page.css'

// ─── TABS ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'running',  label: 'Running km',       pip: 'body'  },
  { id: 'hrv',      label: 'HRV',              pip: 'body'  },
  { id: 'rhr',      label: 'Resting HR',       pip: 'body'  },
  { id: 'weight',   label: 'Weight',           pip: 'body'  },
  { id: 'sleep',    label: 'Sleep score',      pip: 'sleep' },
  { id: 'recovery', label: 'Recovery',         pip: 'sleep' },
  { id: 'strain',   label: 'Strain',           pip: 'body'  },
  { id: 'calories', label: 'Calories balance', pip: 'intake'},
  { id: 'squat',    label: 'Back squat PB',    pip: 'lift'  },
  { id: 'pullup',   label: 'Pull-up PB',       pip: 'lift'  },
]

// ─── RANGE DAYS ───────────────────────────────────────────────────────────────
const RANGE_DAYS = { '1m': 30, '3m': 91, '6m': 182, '1y': 365, 'all': null }

// ─── SVG CHART CONSTANTS ──────────────────────────────────────────────────────
const SVG_W   = 1100  // viewBox width
const SVG_H   = 340   // viewBox height
const CL      = 50    // chart left x — y-axis label margin
const CR      = 1050  // chart right x — 50px right for target label overflow
const CT      = 22    // chart top y
const CB      = 300   // chart bottom y / baseline for non-balance charts
const LABEL_Y = 320   // x-axis label row y

function rangeLabel(range) {
  if (range === '1m') return '1M average'
  if (range === '3m') return '3M average'
  if (range === '6m') return '6M average'
  if (range === '1y') return '1Y average'
  return 'All-time average'
}

// ─── TILE DATE FORMAT ─────────────────────────────────────────────────────────
function fmtTileDate(d) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

// ─── RANGE WINDOW LABEL ───────────────────────────────────────────────────────
function fmtRangeWindow(range, days) {
  if (!days) return 'All data'
  const end   = new Date()
  const start = new Date(); start.setDate(start.getDate() - (days - 1))
  const fmt   = d => d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
  return `${fmt(start)} → ${fmt(end)}`
}

// ─── CHART HELPERS ────────────────────────────────────────────────────────────

function niceNum(v) {
  if (!v || v <= 0) return 10
  const exp = Math.pow(10, Math.floor(Math.log10(v)))
  const f   = v / exp
  if (f <= 1.5) return 1.5 * exp
  if (f <= 3)   return 3   * exp
  if (f <= 6)   return 6   * exp
  return 10 * exp
}

// Computes Y-axis scale from bars data.
// isBalance: chart has signed values (calories balance).
function computeYScale(bars, isBalance) {
  const vals = bars.map(b => b.value).filter(v => v !== null && isFinite(v))
  const make = (yTop, yBot) => {
    const span       = yTop - yBot
    const gridLevels = [yBot, yBot + span / 3, yBot + span * 2 / 3, yTop]
    const toY        = v => CB - ((v - yBot) / span) * (CB - CT)
    return { yTop, yBot, gridLevels, toY }
  }
  if (!vals.length) return make(isBalance ? 100 : 100, isBalance ? -100 : 0)
  if (isBalance) {
    const ext = Math.max(Math.abs(Math.max(...vals)), Math.abs(Math.min(...vals)))
    const yTop = Math.max(niceNum(ext * 1.2), 100)
    return make(yTop, -yTop)
  }
  return make(Math.max(niceNum(Math.max(...vals) * 1.15), 1), 0)
}

function fmtGridLabel(v) {
  if (v === 0) return '0'
  const sign = v < 0 ? '−' : ''
  const abs  = Math.abs(v)
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`
  return `${sign}${Math.round(abs)}`
}

// Buckets allMetrics.X.vals (per-day { date, value }) into Monday-anchored
// weeks. allDays establishes ordering — weeks with no data get value: null.
function buildChartBars(metricVals, allDays) {
  const byWeek    = {}
  const weekOrder = []
  allDays.forEach(d => {
    const wk = localIso(startOfWeek(new Date(d + 'T00:00:00')))
    if (!byWeek[wk]) { byWeek[wk] = []; weekOrder.push(wk) }
  })
  ;(metricVals || []).forEach(({ date, value }) => {
    const wk = localIso(startOfWeek(new Date(date + 'T00:00:00')))
    if (byWeek[wk]) byWeek[wk].push(value)
  })
  const currentWk = localIso(startOfWeek(new Date()))
  return weekOrder.map(wk => {
    const vals  = byWeek[wk]
    const value = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
    const d     = new Date(wk + 'T00:00:00')
    const weekLabel = 'WEEK OF ' + d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase()
    return { weekKey: wk, weekLabel, value, isCurrent: wk === currentWk }
  })
}

// Trailing rolling mean. Partial windows (first N-1 bars) are averaged
// over available data and flagged smoothPartial for faded rendering.
function smoothBars(bars, window) {
  if (window <= 1) return bars
  return bars.map((bar, i) => {
    const slice = bars.slice(Math.max(0, i - window + 1), i + 1)
    const valid = slice.filter(b => b.value !== null && isFinite(b.value))
    if (!valid.length) return { ...bar, value: null, smoothPartial: false }
    const avg = valid.reduce((s, b) => s + b.value, 0) / valid.length
    return { ...bar, value: avg, smoothPartial: valid.length < window }
  })
}

// ─── METRIC BUILDER ───────────────────────────────────────────────────────────
// accessor(mergedLog, whoopDay, dateStr) → number | null | ''
function buildMetric(days, priorDays, accessor, logs, whoopData) {
  const vals = days.map(d => {
    const merged = mergeWhoopForDate(d, logs[d], whoopData)
    const raw    = accessor(merged, whoopData[d], d)
    const v      = raw !== null && raw !== undefined && raw !== ''
      ? parseFloat(raw) : NaN
    return { date: d, value: isNaN(v) ? null : v }
  }).filter(x => x.value !== null)

  const values = vals.map(x => x.value)
  const latest      = vals.length ? vals[vals.length - 1].value : null
  const latestDate  = vals.length ? vals[vals.length - 1].date  : null
  const avg  = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
  const peak = values.length ? Math.max(...values) : null
  const low  = values.length ? Math.min(...values) : null

  const subAvg = (n) => {
    const sv = days.slice(-n).map(d => {
      const m = mergeWhoopForDate(d, logs[d], whoopData)
      const r = accessor(m, whoopData[d], d)
      const v = r !== null && r !== undefined && r !== '' ? parseFloat(r) : NaN
      return isNaN(v) ? null : v
    }).filter(v => v !== null)
    return sv.length ? sv.reduce((a, b) => a + b, 0) / sv.length : null
  }

  const priorVals = priorDays.map(d => {
    const m = mergeWhoopForDate(d, logs[d], whoopData)
    const r = accessor(m, whoopData[d], d)
    const v = r !== null && r !== undefined && r !== '' ? parseFloat(r) : NaN
    return isNaN(v) ? null : v
  }).filter(v => v !== null)
  const priorAvg = priorVals.length ? priorVals.reduce((a, b) => a + b, 0) / priorVals.length : null

  return { latest, latestDate, avg, peak, low, avg7: subAvg(7), avg30: subAvg(30), priorAvg, count: values.length, vals }
}

// ─── DELTA HELPER ─────────────────────────────────────────────────────────────
function calcDelta(current, prior, { lowerIsBetter = false, mode = 'pct' } = {}) {
  if (current == null || prior == null) return null
  if (mode === 'pct') {
    if (prior === 0) return null
    const pct = ((current - prior) / prior) * 100
    const dir = lowerIsBetter ? (pct <= 0 ? 'up' : 'down') : (pct >= 0 ? 'up' : 'down')
    return { label: `${Math.abs(pct).toFixed(0)}%`, dir }
  }
  // abs mode — no colour direction
  const diff = current - prior
  return { label: `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}`, dir: null }
}

// ─── FORMAT VALUE ─────────────────────────────────────────────────────────────
const fmtInt = v => v != null ? Math.round(v).toString() : '—'
const fmtDp1 = v => v != null ? v.toFixed(1) : '—'
const hasVal = v => v !== '—'

// "today" / "yesterday" / "N days ago" / "N weeks ago" — for lift tile
function fmtLastLogged(isoDate) {
  if (!isoDate) return '—'
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(isoDate + 'T00:00:00')
  const diffDays = Math.round((today - d) / 86400000)
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 14)  return `${diffDays} days ago`
  const weeks = Math.round(diffDays / 7)
  return `${weeks} week${weeks !== 1 ? 's' : ''} ago`
}

// ─── ANNOTATION DATE FORMAT ("08 MAY 2026") ───────────────────────────────────
function formatAnnotDate(d) {
  return new Date(d + 'T00:00:00')
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase()
}

// ─── RUNNING PB DETECTOR ─────────────────────────────────────────────────────
// Scans all historical data for new-longest-run and new-best-week records.
// Returns annotations sorted newest-first; caller filters to the view range.
function detectRunningPBs(logs, stravaKmMap) {
  // Build date → km map across all logs + Strava
  const allDates = new Set([
    ...Object.keys(logs),
    ...Object.keys(stravaKmMap),
  ])
  const dailyKm = {}
  allDates.forEach(d => {
    const km = getKmForDate(d, logs, stravaKmMap)
    if (km > 0) dailyKm[d] = km
  })
  const sorted = Object.keys(dailyKm).sort()

  // Longest single-run PBs
  const longestPBs = []
  let maxRun = 0
  sorted.forEach(d => {
    const km = dailyKm[d]
    if (km > maxRun) {
      longestPBs.push({
        date: d,
        kind: 'pb',
        title: `Longest run · ${km.toFixed(1)} km`,
        note: maxRun > 0 ? `Prior best: ${maxRun.toFixed(1)} km.` : 'First recorded long run.',
      })
      maxRun = km
    }
  })

  // Best-week PBs
  const weeklyKm = {}
  sorted.forEach(d => {
    const wk = localIso(startOfWeek(new Date(d + 'T00:00:00')))
    weeklyKm[wk] = (weeklyKm[wk] || 0) + dailyKm[d]
  })
  const weeksSorted = Object.keys(weeklyKm).sort()
  const bestWeekPBs = []
  let maxWeek = 0
  weeksSorted.forEach(wk => {
    const km = weeklyKm[wk]
    if (km > maxWeek) {
      bestWeekPBs.push({
        date: wk,
        kind: 'pb',
        title: `Best week · ${km.toFixed(1)} km`,
        note: maxWeek > 0 ? `Prior weekly best: ${maxWeek.toFixed(1)} km.` : 'First weekly distance record.',
      })
      maxWeek = km
    }
  })

  return [...longestPBs, ...bestWeekPBs].sort((a, b) => b.date.localeCompare(a.date))
}

// ─── WEEK BUCKETS FOR RUNNING KM ─────────────────────────────────────────────
function buildWeekBuckets(days, logs, stravaKmMap) {
  const byWeek = {}
  days.forEach(d => {
    const wk = localIso(startOfWeek(new Date(d + 'T00:00:00')))
    const km = getKmForDate(d, logs, stravaKmMap)
    byWeek[wk] = (byWeek[wk] || 0) + km
  })
  return byWeek
}

// ─── RUNNING HERO DATA ────────────────────────────────────────────────────────
function runningHero(logs, stravaKmMap, range) {
  const n    = RANGE_DAYS[range] ?? 730
  const days = daysWindow(n)

  const last30km = daysWindow(30).reduce((s, d) => s + getKmForDate(d, logs, stravaKmMap), 0)

  const byWeek   = buildWeekBuckets(days, logs, stravaKmMap)
  const weekVals = Object.values(byWeek)
  const bestWeekKm  = weekVals.length ? Math.max(...weekVals) : 0
  const bestWeekKey = weekVals.length ? Object.keys(byWeek).find(k => byWeek[k] === bestWeekKm) || '' : ''
  const avgWeekKm   = weekVals.length ? mean(weekVals) : null

  let longestKm = 0, longestDate = ''
  days.forEach(d => {
    const km = getKmForDate(d, logs, stravaKmMap)
    if (km > longestKm) { longestKm = km; longestDate = d }
  })
  const totalKm = days.reduce((s, d) => s + getKmForDate(d, logs, stravaKmMap), 0)

  const priorEnd = new Date(); priorEnd.setDate(priorEnd.getDate() - n)
  const prevLast30 = daysWindow(30, priorEnd).reduce((s, d) => s + getKmForDate(d, logs, stravaKmMap), 0)

  const delta = prevLast30 > 0
    ? calcDelta(last30km, prevLast30)
    : null

  return {
    hero: last30km > 0 ? last30km.toFixed(1) : '—',
    delta,
    prevLabel: prevLast30 > 0 ? `vs prev 30 days · ${prevLast30.toFixed(0)} km` : 'vs prev 30 days',
    bestWeekKm:    bestWeekKm  > 0 ? bestWeekKm.toFixed(1)  : '—',
    bestWeekLabel: bestWeekKey ? new Date(bestWeekKey + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '',
    avgWeekKm:     avgWeekKm != null ? avgWeekKm.toFixed(1) : '—',
    avgWeekCount:  weekVals.length,
    longestKm:     longestKm  > 0 ? longestKm.toFixed(1)   : '—',
    longestLabel:  longestDate ? new Date(longestDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '',
    totalKm:       totalKm    > 0 ? totalKm.toFixed(0)     : '—',
    rangeWeeks:    weekVals.length,
  }
}

// ─── METRIC META — tooltip unit, direction, value formatter ──────────────────
const METRIC_META = {
  running:  { unit: 'km',   lowerIsBetter: false, fmt: v => v.toFixed(1)                                    },
  hrv:      { unit: 'ms',   lowerIsBetter: false, fmt: v => Math.round(v).toString()                        },
  rhr:      { unit: 'bpm',  lowerIsBetter: true,  fmt: v => Math.round(v).toString()                        },
  squat:    { unit: 'kg',   lowerIsBetter: false, fmt: v => v.toFixed(1)                                    },
  pullup:   { unit: 'kg',   lowerIsBetter: false, fmt: v => v.toFixed(1)                                    },
  weight:   { unit: 'kg',   lowerIsBetter: false, fmt: v => v.toFixed(1)                                    },
  sleep:    { unit: '/100', lowerIsBetter: false, fmt: v => Math.round(v).toString()                        },
  recovery: { unit: '/100', lowerIsBetter: false, fmt: v => Math.round(v).toString()                        },
  strain:   { unit: '',     lowerIsBetter: false, fmt: v => v.toFixed(1)                                    },
  calories: { unit: 'kcal', lowerIsBetter: false, fmt: v => (v >= 0 ? '+' : '') + Math.round(v).toString() },
}
const METRIC_META_FALLBACK = { unit: '', lowerIsBetter: false, fmt: v => Math.round(v).toString() }

// ─── CHART SVG ────────────────────────────────────────────────────────────────
function ChartSVG({ bars = [], barColor = 'var(--moss)', animKey = '', isBalance = false, targetValue = null, prevBars = [], annotations = [], metricMeta = METRIC_META_FALLBACK }) {
  // Hooks first — Rules of Hooks require unconditional ordering
  const [tooltip,     setTooltip    ] = useState(null)
  const [showTooltip, setShowTooltip] = useState(false)
  const svgRef    = useRef(null)
  const leaveTimer = useRef(null)

  const hasData = bars.some(b => b.value !== null && isFinite(b.value))
  if (!hasData) {
    return (
      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} preserveAspectRatio="none">
        <text className="chart-empty" x={SVG_W / 2} y={SVG_H / 2}>Awaiting data</text>
      </svg>
    )
  }

  const n      = bars.length
  const SLOT_W = (CR - CL) / n
  const BAR_W  = Math.max(2, Math.min(30, SLOT_W * 0.72))
  const barX   = i => CL + i * SLOT_W + (SLOT_W - BAR_W) / 2
  const barMid = i => barX(i) + BAR_W / 2
  const delay  = Math.min(40, 800 / Math.max(n, 1))
  const { gridLevels, toY } = computeYScale(bars, isBalance)
  const baselineY = toY(0)
  const gridLineVals = isBalance ? gridLevels : gridLevels.slice(1)
  const yLabelVals = isBalance
    ? [...new Set([...gridLevels, 0])].sort((a, b) => b - a)
    : gridLevels
  const xLabels = []
  const seenMos = new Set()
  bars.forEach((bar, i) => {
    if (!bar.weekKey) return
    const mo = bar.weekKey.slice(0, 7)
    if (!seenMos.has(mo)) {
      seenMos.add(mo)
      const d = new Date(bar.weekKey + 'T00:00:00')
      xLabels.push({ x: barMid(i), label: d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase() })
    }
  })
  const step       = Math.ceil(xLabels.length / 12)
  const visXLabels = xLabels.filter((_, i) => i % step === 0)

  // Target line
  const targetLineY = (targetValue !== null && isFinite(targetValue)) ? toY(targetValue) : null
  const showTarget  = targetLineY !== null && targetLineY >= CT && targetLineY <= CB

  // Prev-period path — M commands at gap edges, no interpolation
  let prevPathD = ''
  if (prevBars.length > 0) {
    let inLine = false
    const count = Math.min(prevBars.length, n)
    for (let i = 0; i < count; i++) {
      const bar = prevBars[i]
      if (bar.value === null || !isFinite(bar.value)) { inLine = false; continue }
      const x = barMid(i)
      const y = toY(bar.value)
      prevPathD += inLine ? `L ${x} ${y} ` : `M ${x} ${y} `
      inLine = true
    }
    prevPathD = prevPathD.trim()
  }

  // Annotation markers — map annotation dates to their week bucket
  const weekAnnots = new Map()
  annotations.forEach(a => {
    const wk = localIso(startOfWeek(new Date(a.date + 'T00:00:00')))
    if (!weekAnnots.has(wk)) weekAnnots.set(wk, [])
    weekAnnots.get(wk).push(a)
  })

  // Bar hover handlers
  const handleBarEnter = (bar, prevBar, i) => {
    if (leaveTimer.current) { clearTimeout(leaveTimer.current); leaveTimer.current = null }
    const svg = svgRef.current
    if (!svg) return
    const { width, height } = svg.getBoundingClientRect()
    const scaleX  = width  / SVG_W
    const scaleY  = height / SVG_H
    const cx      = barMid(i)
    const bty     = isBalance && bar.value < 0 ? baselineY : toY(bar.value)
    const barHt   = isBalance ? Math.abs(toY(bar.value) - baselineY) : baselineY - bty
    const nearTop = bty < CT + 60
    const domX    = cx * scaleX
    const domY    = nearTop ? (bty + barHt) * scaleY + 10 : bty * scaleY
    const txPct   = cx > 900 ? '-90%' : cx < 150 ? '-10%' : '-50%'
    const transformStr = nearTop
      ? `translate(${txPct}, 10px)`
      : `translate(${txPct}, calc(-100% - 10px))`
    setTooltip({ domX, domY, transformStr, bar, prevBar })
    requestAnimationFrame(() => setShowTooltip(true))
  }

  const handleBarLeave = () => {
    setShowTooltip(false)
    leaveTimer.current = setTimeout(() => {
      setTooltip(null)
      leaveTimer.current = null
    }, 110)
  }

  // Tooltip delta
  const ttDeltaInfo = (() => {
    if (!tooltip || tooltip.prevBar?.value == null || tooltip.bar?.value == null) return null
    const delta    = tooltip.bar.value - tooltip.prevBar.value
    const isUp     = metricMeta.lowerIsBetter ? delta < 0 : delta > 0
    const absDelta = Math.abs(delta)
    return {
      arrow:    isUp ? '▲' : '▼',
      color:    isUp ? 'var(--moss)' : 'var(--clay)',
      fmtDelta: absDelta < 1 ? absDelta.toFixed(1) : String(Math.round(absDelta)),
    }
  })()

  return (
    <>
      <svg ref={svgRef} viewBox={`0 0 ${SVG_W} ${SVG_H}`} preserveAspectRatio="none">
        {gridLineVals.map((v, i) => (
          <line key={`g${i}`} className="grid-line" x1={CL} y1={toY(v)} x2={CR} y2={toY(v)} />
        ))}
        <line className="baseline" x1={CL} y1={baselineY} x2={CR} y2={baselineY} />
        {yLabelVals.map((v, i) => (
          <text key={`y${i}`} className="axis-label y" x={CL - 8} y={toY(v) + 4}>{fmtGridLabel(v)}</text>
        ))}
        {bars.map((bar, i) => {
          if (bar.value === null || !isFinite(bar.value)) return null
          const v  = bar.value
          const py = isBalance && v < 0 ? baselineY : toY(v)
          const ht = isBalance ? Math.abs(toY(v) - baselineY) : baselineY - toY(v)
          if (ht <= 0) return null
          return (
            <rect
              key={`${animKey}-${i}`}
              className={`bar${bar.isCurrent ? ' current' : ''}`}
              x={barX(i)} y={py} width={BAR_W} height={ht}
              style={{
                fill: barColor,
                animationDelay: `${Math.round(200 + i * delay)}ms`,
                ...(isBalance && v < 0 ? { transformOrigin: 'top' } : {}),
                ...(bar.smoothPartial ? { opacity: 0.35 } : {}),
              }}
              onMouseEnter={() => handleBarEnter(bar, bars[i - 1] ?? null, i)}
              onMouseLeave={handleBarLeave}
            />
          )
        })}
        {visXLabels.map((l, i) => (
          <text key={`x${i}`} className="axis-label x" x={l.x} y={LABEL_Y}>{l.label}</text>
        ))}
        {showTarget && (
          <>
            <line className="target-line" x1={CL} y1={targetLineY} x2={CR} y2={targetLineY} />
            <text className="target-label" x={CR - 4} y={targetLineY - 3}>
              TARGET {fmtGridLabel(targetValue)}
            </text>
          </>
        )}
        {prevPathD && <path className="prev-line" d={prevPathD} />}
        {weekAnnots.size > 0 && bars.map((bar, i) => {
          if (bar.value === null || !isFinite(bar.value) || !bar.weekKey) return null
          const wkAnnots = weekAnnots.get(bar.weekKey)
          if (!wkAnnots) return null
          const cx  = barMid(i)
          const bty = toY(bar.value)
          return wkAnnots.map((a, k) => {
            const apexY   = bty - 8  - k * 16
            const stemY1  = bty - 14 - k * 16
            const triTopY = apexY - 8
            const triPath = `M ${cx - 6} ${triTopY} L ${cx + 6} ${triTopY} L ${cx} ${apexY} Z`
            return (
              <g key={`am-${i}-${k}`} className={`annot annot-marker ${a.kind}`}>
                <line className="annot-line" x1={cx} y1={stemY1} x2={cx} y2={apexY} />
                <path d={triPath} />
              </g>
            )
          })
        })}
      </svg>
      {tooltip && (
        <div
          className="chart-tooltip"
          data-visible={showTooltip ? 'true' : undefined}
          style={{
            left:      `${tooltip.domX}px`,
            top:       `${tooltip.domY}px`,
            transform: tooltip.transformStr,
          }}
        >
          <div className="tt-value">
            {metricMeta.fmt(tooltip.bar.value)}
            {metricMeta.unit && <span className="tt-unit">{metricMeta.unit}</span>}
          </div>
          <div className="tt-week">{tooltip.bar.weekLabel}</div>
          {ttDeltaInfo && (
            <div className="tt-delta" style={{ color: ttDeltaInfo.color }}>
              {ttDeltaInfo.arrow} {ttDeltaInfo.fmtDelta}{metricMeta.unit ? ` ${metricMeta.unit}` : ''}
            </div>
          )}
        </div>
      )}
    </>
  )
}

// ─── STAT TILE ────────────────────────────────────────────────────────────────
function StatTile({ label, val, unit, ctx }) {
  return (
    <div className="stat-tile">
      <div className="label">{label}</div>
      <div className="value">
        {val}
        {hasVal(String(val)) && unit ? <span className="unit">{unit}</span> : null}
      </div>
      <div className="ctx">{ctx}</div>
    </div>
  )
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────
export default function Charts({ logs = {}, settings = {}, activities = [], whoopData = {} }) {
  const [activeTab, setActiveTab] = useState('running')
  const [range,     setRange    ] = useState('6m')
  const [compare,   setCompare  ] = useState('target')
  const [smoothing, setSmoothing] = useState('raw')

  const stravaKmMap = useMemo(() => kmByDateMap(activities), [activities])
  const rangeDays   = RANGE_DAYS[range]

  const runKm = useMemo(
    () => runningHero(logs, stravaKmMap, range),
    [logs, stravaKmMap, range]
  )

  // ── All metric data ──────────────────────────────────────────────
  const allMetrics = useMemo(() => {
    const n    = rangeDays ?? 730
    const days = daysWindow(n)
    const priorEnd = new Date(); priorEnd.setDate(priorEnd.getDate() - n)
    const priorDays = daysWindow(n, priorEnd)
    const bm = (acc) => buildMetric(days, priorDays, acc, logs, whoopData)

    return {
      hrv:      bm((m)      => m?.body?.hrv),
      rhr:      bm((m)      => m?.body?.rhr),
      weight:   bm((m)      => m?.body?.weight),
      sleep:    bm((m)      => m?.sleep?.sleepScore),
      recovery: bm((m)      => m?.sleep?.recoveryScore),
      strain:   bm((_, w)   => w?.day_strain),
      hoursSlept: bm((m)    => m?.sleep?.hoursSlept),
      calsIn:   bm((_, __, d) => {
        const v = logs[d]?.nutrition?.calories
        return v !== '' && v != null ? parseFloat(v) : null
      }),
      calsBurned: bm((_, w) => w?.energy_burned ?? null),
      calsBalance: bm((_, w, d) => {
        const intake  = logs[d]?.nutrition?.calories
        if (intake === '' || intake == null) return null
        const burned  = w?.energy_burned
        if (burned == null) return null
        return parseFloat(intake) - burned
      }),
    }
  }, [logs, whoopData, rangeDays])

  // ── Lift PB data (squat + pullup tabs) ──────────────────────────
  const liftData = useMemo(() => {
    if (activeTab !== 'squat' && activeTab !== 'pullup') return null

    const matchFn = activeTab === 'squat'
      ? l => l.exercise === 'Back squat'
      : l => typeof l.exercise === 'string' && l.exercise.startsWith('Pull-up') && parseFloat(l.weight) > 0

    // All-time PB — no range filter, scan all log dates
    let allTimePB = null
    let bestSet   = null
    let lastDate  = null

    Object.entries(logs).forEach(([date, log]) => {
      ;(Array.isArray(log?.lifts) ? log.lifts : []).filter(matchFn).forEach(lift => {
        const w   = parseFloat(lift.weight)
        const r   = parseInt(lift.reps, 10)
        if (!isFinite(w) || !isFinite(r) || r < 1 || w <= 0) return
        const orm = w * (1 + r / 30)
        if (allTimePB == null || orm > allTimePB) { allTimePB = orm; bestSet = { weight: w, reps: r } }
        if (!lastDate || date > lastDate) lastDate = date
      })
    })

    // Range-filtered week buckets: max 1RM per week
    const n      = rangeDays ?? 730
    const days   = daysWindow(n)
    const daySet = new Set(days)
    const byWeek = {}
    const weekOrder = []

    days.forEach(d => {
      const wk = localIso(startOfWeek(new Date(d + 'T00:00:00')))
      if (!byWeek[wk]) { byWeek[wk] = null; weekOrder.push(wk) }
    })

    Object.entries(logs).forEach(([date, log]) => {
      if (!daySet.has(date)) return
      const wk = localIso(startOfWeek(new Date(date + 'T00:00:00')))
      if (!(wk in byWeek)) return
      ;(Array.isArray(log?.lifts) ? log.lifts : []).filter(matchFn).forEach(lift => {
        const w   = parseFloat(lift.weight)
        const r   = parseInt(lift.reps, 10)
        if (!isFinite(w) || !isFinite(r) || r < 1 || w <= 0) return
        const orm = w * (1 + r / 30)
        if (byWeek[wk] == null || orm > byWeek[wk]) byWeek[wk] = orm
      })
    })

    const currentWk = localIso(startOfWeek(new Date()))
    const bars = weekOrder.map(wk => ({
      weekKey:   wk,
      weekLabel: 'WEEK OF ' + new Date(wk + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase(),
      value:     byWeek[wk],
      isCurrent: wk === currentWk,
    }))

    return { allTimePB, bestSet, lastDate, bars }
  }, [activeTab, logs, rangeDays])

  // ── Hero config driven by activeTab ─────────────────────────────
  const heroConfig = useMemo(() => {
    const wtTarget = settings?.weightTarget?.value

    if (activeTab === 'running') {
      return {
        eyebrow: 'Running distance · km per week',
        heroStr: runKm.hero,
        unitStr: 'km · last 30 days',
        delta:   runKm.delta,
        metaStr: runKm.prevLabel,
        tiles: [
          { label: 'Best week',     val: runKm.bestWeekKm,  unit: 'km',  ctx: runKm.bestWeekLabel ? `Week of ${runKm.bestWeekLabel}` : 'No data' },
          { label: 'Average week',  val: runKm.avgWeekKm,   unit: 'km',  ctx: `Across ${runKm.avgWeekCount} week${runKm.avgWeekCount !== 1 ? 's' : ''}` },
          { label: 'Longest run',   val: runKm.longestKm,   unit: 'km',  ctx: runKm.longestLabel || 'No data' },
          { label: 'Total in view', val: runKm.totalKm,     unit: 'km',  ctx: `${runKm.rangeWeeks} week${runKm.rangeWeeks !== 1 ? 's' : ''} of data` },
        ],
      }
    }

    if (activeTab === 'hrv') {
      const m = allMetrics.hrv
      const d = calcDelta(m.latest, m.priorAvg)
      return {
        eyebrow: 'Heart rate variability · ms',
        heroStr: fmtInt(m.latest),
        unitStr: 'ms · latest reading',
        delta:   d,
        metaStr: m.priorAvg != null ? `vs prior period avg · ${fmtInt(m.priorAvg)} ms` : 'vs prior period',
        tiles: [
          { label: 'Latest',       val: fmtInt(m.latest), unit: 'ms',  ctx: m.latestDate ? fmtTileDate(m.latestDate) : 'No data' },
          { label: '7-day avg',    val: fmtInt(m.avg7),   unit: 'ms',  ctx: 'Rolling average' },
          { label: '30-day avg',   val: fmtInt(m.avg30),  unit: 'ms',  ctx: 'Rolling average' },
          { label: 'Peak in view', val: fmtInt(m.peak),   unit: 'ms',  ctx: 'Highest recorded' },
        ],
      }
    }

    if (activeTab === 'rhr') {
      const m = allMetrics.rhr
      const d = calcDelta(m.latest, m.priorAvg, { lowerIsBetter: true })
      return {
        eyebrow: 'Resting heart rate · bpm',
        heroStr: fmtInt(m.latest),
        unitStr: 'bpm · latest reading',
        delta:   d,
        metaStr: m.priorAvg != null ? `vs prior period avg · ${fmtInt(m.priorAvg)} bpm` : 'vs prior period',
        tiles: [
          { label: 'Latest',        val: fmtInt(m.latest), unit: 'bpm', ctx: m.latestDate ? fmtTileDate(m.latestDate) : 'No data' },
          { label: '7-day avg',     val: fmtInt(m.avg7),   unit: 'bpm', ctx: 'Rolling average' },
          { label: '30-day avg',    val: fmtInt(m.avg30),  unit: 'bpm', ctx: 'Rolling average' },
          { label: 'Lowest in view',val: fmtInt(m.low),    unit: 'bpm', ctx: 'Best recorded' },
        ],
      }
    }

    if (activeTab === 'weight') {
      const m = allMetrics.weight
      // Delta: absolute kg change (latest vs prior period average)
      const d = m.latest != null && m.priorAvg != null
        ? calcDelta(m.latest, m.priorAvg, { mode: 'abs' })
        : null
      const tgt = wtTarget != null ? `${parseFloat(wtTarget).toFixed(1)}` : '—'
      return {
        eyebrow: 'Body weight · kg',
        heroStr: fmtDp1(m.latest),
        unitStr: 'kg · latest reading',
        delta:   d,
        metaStr: m.priorAvg != null ? `vs prior period avg · ${fmtDp1(m.priorAvg)} kg` : 'vs prior period',
        tiles: [
          { label: 'Latest',         val: fmtDp1(m.latest), unit: 'kg', ctx: m.latestDate ? fmtTileDate(m.latestDate) : 'No data' },
          { label: 'Target',         val: tgt,               unit: tgt !== '—' ? 'kg' : '', ctx: 'Your goal' },
          { label: 'Highest in view',val: fmtDp1(m.peak),   unit: 'kg', ctx: 'In this range' },
          { label: 'Lowest in view', val: fmtDp1(m.low),    unit: 'kg', ctx: 'In this range' },
        ],
      }
    }

    if (activeTab === 'sleep') {
      const m  = allMetrics.sleep
      const mh = allMetrics.hoursSlept
      const d  = calcDelta(m.avg, m.priorAvg)
      return {
        eyebrow: 'Sleep score · out of 100',
        heroStr: fmtInt(m.avg),
        unitStr: `/100 · ${rangeLabel(range)}`,
        delta:   d,
        metaStr: m.priorAvg != null ? `vs prior period avg · ${fmtInt(m.priorAvg)}/100` : 'vs prior period',
        tiles: [
          { label: 'Average',     val: fmtInt(m.avg),    unit: '/100', ctx: `Across ${m.count} night${m.count !== 1 ? 's' : ''}` },
          { label: 'Best night',  val: fmtInt(m.peak),   unit: '/100', ctx: 'Highest score' },
          { label: 'Lowest night',val: fmtInt(m.low),    unit: '/100', ctx: 'Lowest score' },
          { label: 'Avg hours',   val: fmtDp1(mh.avg),   unit: 'h',    ctx: 'Per night' },
        ],
      }
    }

    if (activeTab === 'recovery') {
      const m = allMetrics.recovery
      const d = calcDelta(m.avg, m.priorAvg)
      const greenDays = m.vals.filter(x => x.value >= 70).length
      return {
        eyebrow: 'Recovery score · out of 100',
        heroStr: fmtInt(m.avg),
        unitStr: `/100 · ${rangeLabel(range)}`,
        delta:   d,
        metaStr: m.priorAvg != null ? `vs prior period avg · ${fmtInt(m.priorAvg)}/100` : 'vs prior period',
        tiles: [
          { label: 'Average',    val: fmtInt(m.avg),  unit: '/100', ctx: `Across ${m.count} day${m.count !== 1 ? 's' : ''}` },
          { label: 'Peak day',   val: fmtInt(m.peak), unit: '/100', ctx: 'Best score' },
          { label: 'Lowest day', val: fmtInt(m.low),  unit: '/100', ctx: 'Lowest score' },
          { label: 'Days ≥ 70',  val: m.count > 0 ? greenDays.toString() : '—', unit: '', ctx: 'Green recovery days' },
        ],
      }
    }

    if (activeTab === 'strain') {
      const m = allMetrics.strain
      const d = calcDelta(m.latest, m.priorAvg)
      return {
        eyebrow: 'Whoop strain · daily score',
        heroStr: fmtDp1(m.latest),
        unitStr: '· latest reading',
        delta:   d,
        metaStr: m.priorAvg != null ? `vs prior period avg · ${fmtDp1(m.priorAvg)}` : 'vs prior period',
        tiles: [
          { label: 'Latest',       val: fmtDp1(m.latest), unit: '', ctx: m.latestDate ? fmtTileDate(m.latestDate) : 'No data' },
          { label: '7-day avg',    val: fmtDp1(m.avg7),   unit: '', ctx: 'Rolling average' },
          { label: '30-day avg',   val: fmtDp1(m.avg30),  unit: '', ctx: 'Rolling average' },
          { label: 'Peak in view', val: fmtDp1(m.peak),   unit: '', ctx: 'Highest in range' },
        ],
      }
    }

    if (activeTab === 'calories') {
      const mb = allMetrics.calsBalance
      const mi = allMetrics.calsIn
      const mx = allMetrics.calsBurned
      const d  = mb.avg != null && mb.priorAvg != null
        ? calcDelta(mb.avg, Math.abs(mb.priorAvg), { mode: 'abs' })
        : null
      const surplusDays = mb.vals.filter(x => x.value > 0).length
      const avgBalStr = mb.avg != null
        ? `${mb.avg >= 0 ? '+' : ''}${Math.round(mb.avg)}`
        : '—'
      return {
        eyebrow: 'Calories balance · kcal per day',
        heroStr: avgBalStr,
        unitStr: `kcal · ${rangeLabel(range)}`,
        delta:   d,
        metaStr: mb.count > 0 ? `Across ${mb.count} logged days` : 'No data — log calories + connect Whoop',
        tiles: [
          { label: 'Avg balance', val: avgBalStr,               unit: 'kcal', ctx: 'Intake minus burned' },
          { label: 'Avg intake',  val: fmtInt(mi.avg),          unit: 'kcal', ctx: `${mi.count} logged days` },
          { label: 'Avg burned',  val: fmtInt(mx.avg),          unit: 'kcal', ctx: 'From Whoop' },
          { label: 'Surplus days',val: mb.count > 0 ? surplusDays.toString() : '—', unit: '', ctx: 'Days in calorie surplus' },
        ],
      }
    }

    if (activeTab === 'squat' || activeTab === 'pullup') {
      const label = activeTab === 'squat' ? 'Back squat' : 'Weighted pull-up'
      if (!liftData?.allTimePB) {
        return {
          eyebrow: `${label} · est. 1RM`,
          heroStr: '—',
          unitStr: '',
          delta:   null,
          metaStr: 'No lifts logged yet',
          tiles:   [],
        }
      }
      const { allTimePB, bestSet, lastDate } = liftData
      const bestSetStr = bestSet ? `${bestSet.weight}kg × ${bestSet.reps}` : '—'
      return {
        eyebrow: `${label} · est. 1RM`,
        heroStr: allTimePB.toFixed(1),
        unitStr: 'kg est. 1RM · all time',
        delta:   null,
        metaStr: lastDate ? `Last logged · ${fmtTileDate(lastDate)}` : '',
        tiles: [
          { label: 'All-time PB', val: allTimePB.toFixed(1), unit: 'kg est. 1RM', ctx: 'Epley formula'                              },
          { label: 'Best set',    val: bestSetStr,            unit: '',            ctx: 'Weight × reps'                              },
          { label: 'Last logged', val: fmtLastLogged(lastDate), unit: '',          ctx: lastDate ? fmtTileDate(lastDate) : 'No data' },
        ],
      }
    }

    return { eyebrow: '', heroStr: '—', unitStr: '', delta: null, metaStr: '', tiles: [] }
  }, [activeTab, runKm, allMetrics, range, settings, liftData])

  // ── Annotations for the running tab ─────────────────────────────
  const annotations = useMemo(() => {
    if (activeTab !== 'running') return []
    const allPBs = detectRunningPBs(logs, stravaKmMap)
    if (!rangeDays) return allPBs  // "all" range — show everything
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - rangeDays)
    const cutoffStr = localIso(cutoff)
    return allPBs.filter(a => a.date >= cutoffStr)
  }, [activeTab, logs, stravaKmMap, rangeDays])

  const isLift = activeTab === 'squat' || activeTab === 'pullup'

  const rangeWindowLabel = useMemo(
    () => fmtRangeWindow(range, rangeDays),
    [range, rangeDays]
  )

  const barColor = useMemo(() => {
    const tab = TABS.find(t => t.id === activeTab)
    if (tab?.pip === 'sleep')  return 'var(--slate)'
    if (tab?.pip === 'intake') return 'var(--sand)'
    if (tab?.pip === 'lift')   return 'var(--clay)'
    return 'var(--moss)'
  }, [activeTab])

  const chartBars = useMemo(() => {
    if (activeTab === 'squat' || activeTab === 'pullup') return liftData?.bars ?? []
    const n    = rangeDays ?? 730
    const days = daysWindow(n)
    if (activeTab === 'running') {
      const byWeek    = buildWeekBuckets(days, logs, stravaKmMap)
      const weekOrder = Object.keys(byWeek).sort()
      const currentWk = localIso(startOfWeek(new Date()))
      return weekOrder.map(wk => ({
        weekKey:   wk,
        weekLabel: 'WEEK OF ' + new Date(wk + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase(),
        value:     byWeek[wk] > 0 ? byWeek[wk] : null,
        isCurrent: wk === currentWk,
      }))
    }
    const metricKey = { hrv: 'hrv', rhr: 'rhr', weight: 'weight', sleep: 'sleep', recovery: 'recovery', strain: 'strain', calories: 'calsBalance' }[activeTab]
    const metric = metricKey ? allMetrics[metricKey] : null
    if (!metric) return []
    return buildChartBars(metric.vals, days)
  }, [activeTab, rangeDays, logs, stravaKmMap, allMetrics, liftData])

  const animKey   = `${activeTab}-${range}`
  const metricMeta = METRIC_META[activeTab] ?? METRIC_META_FALLBACK

  const smoothWindow = smoothing === '4w' ? 4 : smoothing === '12w' ? 12 : 1

  const displayBars = useMemo(
    () => smoothBars(chartBars, smoothWindow),
    [chartBars, smoothWindow]
  )

  const tabTarget = useMemo(() => {
    if (activeTab === 'weight') {
      const v = settings?.weightTarget?.value
      return v != null && v !== '' ? parseFloat(v) : null
    }
    return null
  }, [activeTab, settings])

  const prevChartBars = useMemo(() => {
    if (compare !== 'prev' || !rangeDays) return []
    if (activeTab === 'squat' || activeTab === 'pullup') return []
    const n = rangeDays
    const priorEnd = new Date()
    priorEnd.setDate(priorEnd.getDate() - n)
    const priorDays = daysWindow(n, priorEnd)
    if (activeTab === 'running') {
      const byWeek    = buildWeekBuckets(priorDays, logs, stravaKmMap)
      const weekOrder = Object.keys(byWeek).sort()
      return weekOrder.map(wk => ({
        weekKey:   wk,
        weekLabel: 'WEEK OF ' + new Date(wk + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase(),
        value:     byWeek[wk] > 0 ? byWeek[wk] : null,
        isCurrent: false,
      }))
    }
    const accMap = {
      hrv:         (m)       => m?.body?.hrv,
      rhr:         (m)       => m?.body?.rhr,
      weight:      (m)       => m?.body?.weight,
      sleep:       (m)       => m?.sleep?.sleepScore,
      recovery:    (m)       => m?.sleep?.recoveryScore,
      strain:      (m, w)    => w?.day_strain,
      calsBalance: (m, w, d) => {
        const intake = logs[d]?.nutrition?.calories
        if (intake === '' || intake == null) return null
        const burned = w?.energy_burned
        if (burned == null) return null
        return parseFloat(intake) - burned
      },
    }
    const metricKeyMap = { hrv: 'hrv', rhr: 'rhr', weight: 'weight', sleep: 'sleep', recovery: 'recovery', strain: 'strain', calories: 'calsBalance' }
    const metricKey = metricKeyMap[activeTab]
    const acc = metricKey ? accMap[metricKey] : null
    if (!acc) return []
    const metricVals = priorDays.map(d => {
      const merged = mergeWhoopForDate(d, logs[d], whoopData)
      const raw    = acc(merged, whoopData[d], d)
      const v      = raw !== null && raw !== undefined && raw !== '' ? parseFloat(raw) : NaN
      return { date: d, value: isNaN(v) ? null : v }
    }).filter(x => x.value !== null)
    return buildChartBars(metricVals, priorDays)
  }, [compare, rangeDays, activeTab, logs, whoopData, stravaKmMap])

  return (
    <div className="charts-page">

      {/* Page head */}
      <header className="page-head r r-1">
        <div>
          <div className="eyebrow">Analyse</div>
          <h1>Charts<span style={{ color: 'var(--moss)' }}>.</span></h1>
          <p className="sub">Pick a metric, watch it move. Annotations remember why.</p>
        </div>
        <div className="meta">{rangeWindowLabel}</div>
      </header>

      {/* Tab bar */}
      <nav className="chart-tabs r r-2" aria-label="Metric tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`chart-tab${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className={`pip ${tab.pip}`} />
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Hero chart card */}
      {(
        <section className="hero-chart-card r r-3">

          <div className="chart-head">
            <div className="left">
              <div className="eyebrow">{heroConfig.eyebrow}</div>
              <div className="hero-num">
                {heroConfig.heroStr}
                <span className="unit">{heroConfig.unitStr}</span>
              </div>
              <div className="hero-meta">
                {heroConfig.delta ? (
                  <>
                    <span className={`delta${heroConfig.delta.dir ? ` ${heroConfig.delta.dir}` : ''}`}>
                      {heroConfig.delta.dir === 'up'   ? '▲ ' : ''}
                      {heroConfig.delta.dir === 'down'  ? '▼ ' : ''}
                      {heroConfig.delta.label}
                    </span>
                    <span>{heroConfig.metaStr}</span>
                  </>
                ) : (
                  <span className="awaiting">{isLift && heroConfig.metaStr ? heroConfig.metaStr : 'Awaiting data'}</span>
                )}
              </div>
            </div>

            <div className="right">
              <div className="control-group">
                <span className="gl">Range</span>
                {['1m','3m','6m','1y','all'].map(r => (
                  <button
                    key={r}
                    className={`filter-pill${range === r ? ' active' : ''}`}
                    onClick={() => {
                      setRange(r)
                      if (r === 'all' && compare === 'prev') setCompare('off')
                    }}
                  >
                    {r === 'all' ? 'All' : r.toUpperCase()}
                  </button>
                ))}
              </div>
              {!isLift && (
                <div className="control-group">
                  <span className="gl">Compare</span>
                  {[
                    { val: 'off',    label: 'Off'      },
                    { val: 'target', label: 'vs Target' },
                    { val: 'prev',   label: 'vs Prev'   },
                  ].map(c => {
                    const disabled = c.val === 'prev' && range === 'all'
                    return (
                      <button
                        key={c.val}
                        className={`filter-pill${compare === c.val ? ' active' : ''}`}
                        data-disabled={disabled ? 'true' : undefined}
                        onClick={() => { if (!disabled) setCompare(c.val) }}
                      >
                        {c.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Chart canvas */}
          <div className="chart-canvas">
            <ChartSVG
              bars={displayBars}
              barColor={barColor}
              animKey={animKey}
              isBalance={activeTab === 'calories'}
              targetValue={compare === 'target' ? tabTarget : null}
              prevBars={compare === 'prev' ? prevChartBars : []}
              annotations={activeTab === 'running' ? annotations : []}
              metricMeta={metricMeta}
            />
          </div>

          {/* Bottom controls */}
          <div className="chart-controls-row">
            <div className="left">
              <div className="control-group">
                <span className="gl">Smooth</span>
                {[
                  { val: 'raw', label: 'Raw'       },
                  { val: '4w',  label: '4-wk avg'  },
                  { val: '12w', label: '12-wk avg' },
                ].map(s => (
                  <button
                    key={s.val}
                    className={`filter-pill${smoothing === s.val ? ' active' : ''}`}
                    onClick={() => setSmoothing(s.val)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="right">
              <span className="chart-foot-meta">Hover any bar for week details</span>
            </div>
          </div>

        </section>
      )}

      {/* Stat tiles — shown for all tabs including lift */}
      {heroConfig.tiles.length > 0 && (
        <section className="stats-grid r r-4">
          {heroConfig.tiles.map(tile => (
            <StatTile key={tile.label} {...tile} />
          ))}
        </section>
      )}

      {/* Annotations — always visible except on lift tabs */}
      {!isLift && (
        <section className="annot-section r r-5">
          <div className="annot-head">
            <span className="title">Annotations · this view</span>
            <span className="meta">
              {activeTab === 'running' && annotations.length > 0
                ? `${annotations.length} PB${annotations.length !== 1 ? 's' : ''} in this view · auto-detected from runs`
                : 'Pulled from Cadence + manual notes'
              }
            </span>
          </div>
          <div className="annot-list">
            {activeTab === 'running' && annotations.length > 0 ? (
              annotations.map(a => (
                <div className="annot-row" key={a.date + a.title}>
                  <div className="date">{formatAnnotDate(a.date)}</div>
                  <div className={`pip ${a.kind}`} />
                  <div className="body">
                    <div className="title">{a.title}</div>
                    {a.note && <div className="note">{a.note}</div>}
                  </div>
                  <div className={`kind ${a.kind}`}>PB</div>
                </div>
              ))
            ) : (
              <div className="annot-empty">
                <span>Nothing logged yet — PBs detected from runs, other types come later.</span>
              </div>
            )}
            <button className="add-annot" type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              Add annotation
            </button>
          </div>
        </section>
      )}

    </div>
  )
}
