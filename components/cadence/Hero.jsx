'use client'

import { useEffect, useState } from 'react'
import {
  todayStr,
  daysWindow,
  mergeWhoopForDate,
  mean,
  formatHoursMinutes,
  sparklinePath,
  heroContext,
} from './helpers'

function CountUpNumber({ target, unit, durationMs = 1400, delayMs = 400 }) {
  const [value, setValue] = useState(0)
  const [ready, setReady] = useState(false)
  const safeTarget = (typeof target === 'number' && isFinite(target)) ? target : null

  useEffect(() => {
    if (safeTarget === null) {
      setReady(true)
      setValue(0)
      return
    }
    let raf
    const start = setTimeout(() => {
      setReady(true)
      let startTime = null
      function frame(now) {
        if (!startTime) startTime = now
        const elapsed = now - startTime
        const progress = Math.min(elapsed / durationMs, 1)
        const eased = 1 - Math.pow(1 - progress, 3)
        setValue(Math.round(safeTarget * eased))
        if (progress < 1) raf = requestAnimationFrame(frame)
      }
      raf = requestAnimationFrame(frame)
    }, delayMs)
    return () => {
      clearTimeout(start)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [safeTarget, durationMs, delayMs])

  return (
    <div className={`hero-number count-up${ready ? ' ready' : ''}`}>
      {safeTarget === null ? '—' : value}
      {unit && <span className="unit">{unit}</span>}
    </div>
  )
}

function HeroSparkline({ values, highlightLast = true }) {
  // Mockup: viewBox 0 0 500 120, three horizontal grid lines at y=20/60/100,
  // axis labels at -6, day labels at y=118. Path occupies y=20..100.
  const width = 500
  const top = 20
  const bottom = 100
  const height = bottom - top
  const labels = ['MON','TUE','WED','THU','FRI','SAT','SUN']

  const clean = values.map(v => {
    const n = typeof v === 'number' ? v : parseFloat(v)
    return isFinite(n) ? n : null
  })
  const non = clean.filter(v => v !== null)
  // Recovery score is 0–100. Plot against a fixed 30–90 range for context.
  const yMin = 30, yMax = 90
  const span = clean.length - 1 || 1
  const xy = clean.map((v, i) => {
    if (v === null) return null
    const x = (i / span) * width
    const yClamped = Math.min(Math.max(v, yMin), yMax)
    const y = bottom - ((yClamped - yMin) / (yMax - yMin)) * height
    return [x, y]
  })

  const linePoints = xy.filter(p => p !== null)
  const linePath = linePoints.length >= 2
    ? linePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
    : null
  const fillPath = linePath
    ? `${linePath} L ${linePoints[linePoints.length - 1][0].toFixed(1)} ${bottom} L ${linePoints[0][0].toFixed(1)} ${bottom} Z`
    : null
  const last = linePoints[linePoints.length - 1]

  return (
    <svg className="hero-chart" viewBox="0 0 500 120" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="cadenceHeroFade" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" style={{ stopColor: 'var(--moss)', stopOpacity: 0.22 }} />
          <stop offset="100%" style={{ stopColor: 'var(--moss)', stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <line x1="0" y1="20" x2="500" y2="20" style={{ stroke: 'var(--chart-grid)' }} strokeWidth="1" strokeDasharray="2 4" />
      <line x1="0" y1="60" x2="500" y2="60" style={{ stroke: 'var(--chart-grid)' }} strokeWidth="1" strokeDasharray="2 4" />
      <line x1="0" y1="100" x2="500" y2="100" style={{ stroke: 'var(--chart-baseline)' }} strokeWidth="1" />
      <text x="-6" y="24" textAnchor="end" fontFamily="JetBrains Mono" fontSize="9" style={{ fill: 'var(--chart-axis)' }}>90</text>
      <text x="-6" y="64" textAnchor="end" fontFamily="JetBrains Mono" fontSize="9" style={{ fill: 'var(--chart-axis)' }}>60</text>
      <text x="-6" y="104" textAnchor="end" fontFamily="JetBrains Mono" fontSize="9" style={{ fill: 'var(--chart-axis)' }}>30</text>
      {fillPath && (
        <path className="draw-fill hero-fill" d={fillPath} fill="url(#cadenceHeroFade)" />
      )}
      {linePath && (
        <path className="draw-line hero-line" pathLength="1" d={linePath} style={{ stroke: 'var(--moss)', fill: 'none' }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {highlightLast && last && (
        <>
          <circle cx={last[0]} cy={last[1]} r="7" fill="none" style={{ stroke: 'var(--chart-highlight)' }} strokeWidth="1" opacity="0.18" />
          <circle cx={last[0]} cy={last[1]} r="3" style={{ fill: 'var(--chart-highlight)' }} />
        </>
      )}
      {labels.map((label, i) => {
        const x = (i / 6) * width
        return (
          <text
            key={label}
            x={x}
            y="118"
            fontFamily="JetBrains Mono"
            fontSize="9"
            style={{ fill: 'var(--chart-axis)' }}
            textAnchor={i === 0 ? 'start' : i === 6 ? 'end' : 'middle'}
          >
            {label}
          </text>
        )
      })}
    </svg>
  )
}

export default function Hero({ logs, whoopData }) {
  const today = todayStr()
  const merged = mergeWhoopForDate(today, logs?.[today], whoopData)
  const recovery = parseFloat(merged?.sleep?.recoveryScore)
  const recoveryNum = isFinite(recovery) ? Math.round(recovery) : null

  const last7 = daysWindow(7)
  const last7Recovery = last7.map(d => {
    const m = mergeWhoopForDate(d, logs?.[d], whoopData)
    const v = parseFloat(m?.sleep?.recoveryScore)
    return isFinite(v) ? v : null
  })
  const prior7 = last7Recovery.slice(0, -1).filter(v => v !== null)
  const avgPrior7 = prior7.length ? prior7.reduce((a, b) => a + b, 0) / prior7.length : null
  const delta = (recoveryNum != null && avgPrior7 != null) ? Math.round(recoveryNum - avgPrior7) : null

  const hrv = parseFloat(merged?.body?.hrv)
  const hrvNum = isFinite(hrv) ? Math.round(hrv) : null
  const hours = parseFloat(merged?.sleep?.hoursSlept)
  const sleepStr = formatHoursMinutes(merged?.sleep?.hoursSlept)

  // HRV delta vs 7-day mean (for context sentence)
  const last7Hrv = last7.map(d => {
    const m = mergeWhoopForDate(d, logs?.[d], whoopData)
    const v = parseFloat(m?.body?.hrv)
    return isFinite(v) ? v : null
  })
  const priorHrv = last7Hrv.slice(0, -1).filter(v => v !== null)
  const avgPriorHrv = priorHrv.length ? priorHrv.reduce((a, b) => a + b, 0) / priorHrv.length : null
  const hrvDelta7d = (hrvNum != null && avgPriorHrv != null) ? hrvNum - avgPriorHrv : null

  const context = heroContext({
    recovery: recoveryNum,
    hrvDelta7d,
    hoursSlept: isFinite(hours) ? hours : null,
  })

  const deltaParts = []
  if (delta != null) {
    const sign = delta > 0 ? '+' : delta < 0 ? '−' : ''
    deltaParts.push(`${sign}${Math.abs(delta)} vs 7-day avg`)
  }
  if (hrvNum != null) deltaParts.push(`HRV ${hrvNum}ms`)
  if (sleepStr) deltaParts.push(`Sleep ${sleepStr}`)

  return (
    <section className="hero">
      <div className="r r-2">
        <div className="hero-label">Recovery · today</div>
        <CountUpNumber target={recoveryNum} unit="%" />
        {deltaParts.length > 0 && (
          <div className="hero-delta">
            {delta != null && delta >= 0 && <span className="ticker" />}
            {deltaParts.join(' · ')}
          </div>
        )}
        <div className="hero-context">{context}</div>
      </div>
      <div className="r r-3">
        <HeroSparkline values={last7Recovery} />
      </div>
    </section>
  )
}
