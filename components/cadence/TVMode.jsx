'use client'

import { useState, useEffect, useMemo } from 'react'
import './tv-mode.css'
import {
  mergeWhoopForDate,
  sparklinePath,
  formatHoursColon,
} from './helpers'

// ─── Constants ────────────────────────────────────────────────────────────────

const RANGES = ['7D', '30D', '6M', '1Y', 'YTD']
const DAYS_LABEL = {
  '7D':  'avg · 7 days',
  '30D': 'avg · 30 days',
  '6M':  'avg · 6 months',
  '1Y':  'avg · last 12 months',
  'YTD': 'avg · year to date',
}

// ─── Period helpers ───────────────────────────────────────────────────────────

function periodDays(rangeKey) {
  const now = new Date()
  let n
  if      (rangeKey === '7D')  n = 7
  else if (rangeKey === '30D') n = 30
  else if (rangeKey === '6M')  n = 180
  else if (rangeKey === '1Y')  n = 365
  else {
    // YTD: days elapsed since 1 Jan of the current year
    n = Math.ceil((now - new Date(now.getFullYear(), 0, 1)) / 86400000) + 1
  }
  return Array.from({ length: n }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (n - 1 - i))
    return d.toISOString().split('T')[0]
  })
}

function priorPeriodDays(rangeKey) {
  const curr = periodDays(rangeKey)
  const n = curr.length
  return Array.from({ length: n }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (2 * n - 1 - i))
    return d.toISOString().split('T')[0]
  })
}

// ─── Data helpers ─────────────────────────────────────────────────────────────

function avgOf(days, accessor, logs, whoopData) {
  const vals = days.map(d => {
    const v = parseFloat(accessor(mergeWhoopForDate(d, logs?.[d], whoopData)))
    return isFinite(v) && v > 0 ? v : null
  }).filter(v => v !== null)
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
}

function valsFor(days, accessor, logs, whoopData) {
  return days.map(d => {
    const v = parseFloat(accessor(mergeWhoopForDate(d, logs?.[d], whoopData)))
    return isFinite(v) && v > 0 ? v : null
  })
}

function pctOfTarget(avg, targetStr) {
  const t = parseFloat(targetStr)
  if (!isFinite(t) || t <= 0 || avg == null) return null
  return Math.round((avg / t) * 100)
}

function arrow(delta) {
  if (delta == null || delta === 0) return '●'
  return delta > 0 ? '▲' : '▼'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MiniSpark({ values }) {
  const path = sparklinePath(values, 60, 20, 3)
  if (!path) return null
  return (
    <svg className="spark cycleable" width="60" height="20" viewBox="0 0 60 20">
      <path
        d={path}
        style={{ stroke: 'var(--moss)', fill: 'none' }}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// StatTile — one of the 6 metric tiles across the top grid.
// `value` is null when there's no data for the period (renders "—" in italic).
// `statusClass` is one of: '' (moss/positive), 'down' (clay), 'flat' (muted), 'no-data' (faint).
function StatTile({ label, sub, value, unit, status, statusClass, sparkValues, revealClass }) {
  const hasData = value != null
  return (
    <div className={`stat-tile r ${revealClass}`}>
      <div>
        <div className="label">{label}</div>
        <div className="sub cycleable">{sub}</div>
      </div>
      <div className={`value cycleable${!hasData ? ' empty' : ''}`}>
        {hasData ? <>{value}<span className="unit">{unit}</span></> : '—'}
      </div>
      <div className="footer">
        <span className={`status cycleable${statusClass ? ` ${statusClass}` : ''}`}>
          {status}
        </span>
        {hasData && <MiniSpark values={sparkValues} />}
      </div>
    </div>
  )
}

// NutRow — one nutrition metric in the bottom nutrition panel.
function NutRow({ label, fillClass, fillPct, targetPct, targetLabel, total, unit, dailyAvg }) {
  const noData = total == null
  return (
    <div className="nut-row">
      <div className="nut-label">{label}</div>
      <div className="nut-bar">
        <div className="track">
          <div className={`fill ${fillClass}`} style={{ width: noData ? '0%' : `${Math.min(fillPct, 100)}%` }} />
        </div>
        <div className="bar-foot">
          {noData ? (
            <span className="target-pct no-data">no data</span>
          ) : (
            <>
              <span><span className="target-pct cycleable">{targetPct}%</span> of target</span>
              <span className="dot" />
              <span className="cycleable">{targetLabel}</span>
            </>
          )}
        </div>
      </div>
      <div className="nut-val cycleable">
        {noData ? (
          <>—<span className="unit">{unit}</span><span className="daily">&nbsp;</span></>
        ) : (
          <>
            {total}<span className="unit">{unit}</span>
            <span className="daily">{dailyAvg}/{unit === 'kcal' ? 'day avg' : 'day avg'}</span>
          </>
        )}
      </div>
    </div>
  )
}

// TrainingPill — one session row in the Today panel.
function TrainingPill({ name, meta, pipClass, isPrimary }) {
  return (
    <div className={`training-pill${isPrimary ? ' primary' : ''}`}>
      <span className={`pip ${pipClass}`} />
      <span className="name">{name}</span>
      {meta && <span className="meta">{meta}</span>}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TVMode({ logs, settings, plan, activities, whoopData, setView }) {
  const [range, setRange]               = useState('7D')
  const [progressKey, setProgressKey]   = useState(0)
  const [dataChanging, setDataChanging] = useState(false)
  const [clockTime, setClockTime]       = useState('')
  const [clockDate, setClockDate]       = useState('')

  // ── Dark theme override (non-persisting) ────────────────────────────────────
  // Saves the current DOM attr, forces dark on mount, restores on unmount.
  // localStorage is never touched — user's stored preference survives TV mode.
  useEffect(() => {
    const saved = document.documentElement.getAttribute('data-theme')
    document.documentElement.setAttribute('data-theme', 'dark')
    return () => document.documentElement.setAttribute('data-theme', saved || 'light')
  }, [])

  // ── Live clock (updates every 30s) ──────────────────────────────────────────
  useEffect(() => {
    const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    function update() {
      const now = new Date()
      const hh  = String(now.getHours()).padStart(2, '0')
      const mm  = String(now.getMinutes()).padStart(2, '0')
      setClockTime(`${hh}:${mm}`)
      setClockDate(`${DAYS[now.getDay()]} · ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`)
    }
    update()
    const id = setInterval(update, 30000)
    return () => clearInterval(id)
  }, [])

  // ── ESC key → exit ──────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setView('dashboard') }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [setView])

  // ── Theme toggle — transient (DOM only, no localStorage) ────────────────────
  function handleThemeToggle() {
    const current = document.documentElement.getAttribute('data-theme')
    document.documentElement.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark')
  }

  // ── Range change ─────────────────────────────────────────────────────────────
  // progressKey forces the active button to remount → CSS ::after animation restarts.
  // dataChanging triggers the .cycleable breathing transition (opacity dip + translateY).
  // Auto-advance timer added in TV: 7.
  function changeRange(r) {
    if (r === range) return
    setProgressKey(k => k + 1)
    setDataChanging(true)
    setTimeout(() => {
      setRange(r)
      setDataChanging(false)
    }, 280)
  }

  // ── Period day arrays ────────────────────────────────────────────────────────
  const days      = useMemo(() => periodDays(range), [range])
  const priorDays = useMemo(() => priorPeriodDays(range), [range])

  // ── Stat tile: Weight ────────────────────────────────────────────────────────
  const { avgW, deltaW, sparkW } = useMemo(() => {
    const acc = m => m?.body?.weight
    const avgW   = avgOf(days, acc, logs, whoopData)
    const priorW = avgOf(priorDays, acc, logs, whoopData)
    return {
      avgW,
      deltaW: avgW != null && priorW != null ? avgW - priorW : null,
      sparkW: valsFor(days, acc, logs, whoopData),
    }
  }, [days, priorDays, logs, whoopData])

  const wStatus = (() => {
    if (avgW == null) return { text: 'no data', cls: 'no-data' }
    const d = deltaW != null
      ? `${arrow(deltaW)} ${Math.abs(deltaW).toFixed(1)} kg · target`
      : '—'
    return { text: d, cls: 'down' }
  })()

  // ── Stat tile: HRV ───────────────────────────────────────────────────────────
  const { avgHrv, deltaHrv, sparkHrv } = useMemo(() => {
    const acc = m => m?.body?.hrv
    const avgHrv   = avgOf(days, acc, logs, whoopData)
    const priorHrv = avgOf(priorDays, acc, logs, whoopData)
    return {
      avgHrv,
      deltaHrv: avgHrv != null && priorHrv != null ? avgHrv - priorHrv : null,
      sparkHrv: valsFor(days, acc, logs, whoopData),
    }
  }, [days, priorDays, logs, whoopData])

  const hrvStatus = (() => {
    if (avgHrv == null) return { text: 'no data', cls: 'no-data' }
    const pct    = pctOfTarget(avgHrv, settings?.hrv?.value)
    const pctStr = pct != null ? ` · ${pct}% target` : ''
    if (deltaHrv == null) return { text: pct != null ? `● ${pct}% target` : '—', cls: 'flat' }
    return {
      text: `${arrow(deltaHrv)} ${Math.abs(Math.round(deltaHrv))}${pctStr}`,
      cls:  deltaHrv < 0 ? 'down' : '',
    }
  })()

  // ── Stat tile: Resting HR ────────────────────────────────────────────────────
  const { avgRhr, deltaRhr, sparkRhr } = useMemo(() => {
    const acc = m => m?.body?.rhr
    const avgRhr   = avgOf(days, acc, logs, whoopData)
    const priorRhr = avgOf(priorDays, acc, logs, whoopData)
    return {
      avgRhr,
      deltaRhr: avgRhr != null && priorRhr != null ? avgRhr - priorRhr : null,
      sparkRhr: valsFor(days, acc, logs, whoopData),
    }
  }, [days, priorDays, logs, whoopData])

  const rhrStatus = (() => {
    if (avgRhr == null) return { text: 'no data', cls: 'no-data' }
    const target   = parseFloat(settings?.rhr?.value)
    const onTarget = isFinite(target) && avgRhr <= target
    const ref      = isFinite(target) ? (onTarget ? ' · on target' : ' · above target') : ''
    if (deltaRhr == null) return { text: `●${ref}`, cls: onTarget ? '' : 'down' }
    return {
      text: `${arrow(deltaRhr)} ${Math.abs(Math.round(deltaRhr))}${ref}`,
      cls:  deltaRhr < 0 ? '' : 'down',
    }
  })()

  // ── Stat tile: Sleep score ───────────────────────────────────────────────────
  const { avgSleep, sparkSleep } = useMemo(() => {
    const acc = m => m?.sleep?.sleepScore
    return {
      avgSleep:  avgOf(days, acc, logs, whoopData),
      sparkSleep: valsFor(days, acc, logs, whoopData),
    }
  }, [days, logs, whoopData])

  const sleepStatus = (() => {
    if (avgSleep == null) return { text: 'no data', cls: 'no-data' }
    const pct = pctOfTarget(avgSleep, settings?.sleepScore?.value)
    return { text: pct != null ? `● ${pct}% target` : '—', cls: 'flat' }
  })()

  // ── Stat tile: Recovery ──────────────────────────────────────────────────────
  const { avgRec, deltaRec, sparkRec } = useMemo(() => {
    const acc = m => m?.sleep?.recoveryScore
    const avgRec   = avgOf(days, acc, logs, whoopData)
    const priorRec = avgOf(priorDays, acc, logs, whoopData)
    return {
      avgRec,
      deltaRec: avgRec != null && priorRec != null ? avgRec - priorRec : null,
      sparkRec: valsFor(days, acc, logs, whoopData),
    }
  }, [days, priorDays, logs, whoopData])

  const recStatus = (() => {
    if (avgRec == null) return { text: 'no data', cls: 'no-data' }
    const pct    = pctOfTarget(avgRec, settings?.recoveryScore?.value)
    const pctStr = pct != null ? ` · ${pct}% target` : ''
    if (deltaRec == null) return { text: pct != null ? `● ${pct}% target` : '—', cls: 'flat' }
    return {
      text: `${arrow(deltaRec)} ${Math.abs(Math.round(deltaRec))}${pctStr}`,
      cls:  deltaRec < 0 ? 'down' : '',
    }
  })()

  // ── Stat tile: Hours slept ───────────────────────────────────────────────────
  const { avgHours, sparkHours } = useMemo(() => {
    const acc = m => m?.sleep?.hoursSlept
    return {
      avgHours:  avgOf(days, acc, logs, whoopData),
      sparkHours: valsFor(days, acc, logs, whoopData),
    }
  }, [days, logs, whoopData])

  const hoursStatus = (() => {
    if (avgHours == null) return { text: 'no data', cls: 'no-data' }
    const pct = pctOfTarget(avgHours, settings?.hoursSlept?.value)
    return { text: pct != null ? `● ${pct}% target` : '—', cls: 'flat' }
  })()

  // ── Bottom grid data — wired in TV: 4–6 ─────────────────────────────────────

  const periodLabel = DAYS_LABEL[range]

  return (
    <div className={`tv-page${dataChanging ? ' data-changing' : ''}`}>
      <div className="tv-shell">

        <header className="top">

          <div className="brand r r-1">
            <div className="wordmark">cadence<span className="dot" /></div>
            <div className="tagline">
              <span className="pulse" />
              Performance display · auto-refreshes every 30s
            </div>
          </div>

          <div className="tv-range r r-1" role="tablist">
            {RANGES.map(r => (
              <button
                key={r === range ? `${r}-${progressKey}` : r}
                data-range={r}
                className={r === range ? 'active' : ''}
                role="tab"
                aria-selected={r === range}
                onClick={() => changeRange(r)}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="clock-area r r-2">
            <div className="clock">
              <div className="time">{clockTime}</div>
              <div className="date">{clockDate}</div>
            </div>
            <button
              className="theme-toggle"
              onClick={handleThemeToggle}
              aria-label="Toggle theme"
              title="Toggle light/dark"
            >
              <svg className="t-icon t-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4"/>
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
              </svg>
              <svg className="t-icon t-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            </button>
          </div>

        </header>

        <section className="stat-grid">
          <StatTile
            label="Weight"     sub={periodLabel}
            value={avgW   != null ? avgW.toFixed(1)         : null} unit="kg"
            status={wStatus.text}     statusClass={wStatus.cls}
            sparkValues={sparkW}      revealClass="r-3"
          />
          <StatTile
            label="HRV"        sub={periodLabel}
            value={avgHrv  != null ? Math.round(avgHrv)    : null} unit="ms"
            status={hrvStatus.text}   statusClass={hrvStatus.cls}
            sparkValues={sparkHrv}    revealClass="r-4"
          />
          <StatTile
            label="Resting HR" sub={periodLabel}
            value={avgRhr  != null ? Math.round(avgRhr)    : null} unit="bpm"
            status={rhrStatus.text}   statusClass={rhrStatus.cls}
            sparkValues={sparkRhr}    revealClass="r-5"
          />
          <StatTile
            label="Sleep score" sub={periodLabel}
            value={avgSleep != null ? Math.round(avgSleep) : null} unit="/100"
            status={sleepStatus.text} statusClass={sleepStatus.cls}
            sparkValues={sparkSleep}  revealClass="r-6"
          />
          <StatTile
            label="Recovery"   sub={periodLabel}
            value={avgRec  != null ? Math.round(avgRec)   : null} unit="/100"
            status={recStatus.text}   statusClass={recStatus.cls}
            sparkValues={sparkRec}    revealClass="r-7"
          />
          <StatTile
            label="Hours slept" sub={periodLabel}
            value={avgHours != null ? formatHoursColon(avgHours) : null} unit="h"
            status={hoursStatus.text} statusClass={hoursStatus.cls}
            sparkValues={sparkHours}  revealClass="r-8"
          />
        </section>

        {/* Bottom grid — wired in TV: 4–6 */}
        <section className="bottom-grid" />

      </div>

      <button className="tv-exit-hint" onClick={() => setView('dashboard')}>
        <kbd>ESC</kbd>Exit TV mode
      </button>
    </div>
  )
}
