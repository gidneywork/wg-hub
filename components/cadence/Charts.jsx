'use client'

import { useState, useMemo } from 'react'
import {
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

// ─── RANGE LABEL FOR HERO SUBTITLE ───────────────────────────────────────────
// period-averaged metrics: "{N}M average"
function rangeLabel(range) {
  if (range === '1m')  return '1M average'
  if (range === '3m')  return '3M average'
  if (range === '6m')  return '6M average'
  if (range === '1y')  return '1Y average'
  return 'All-time average'
}

// ─── METRIC CONFIG ────────────────────────────────────────────────────────────
// subtitle: 'fixed-last30' | 'fixed-latest' | 'ranged-avg'
// heroType: what unit/label the hero shows
const METRIC_META = {
  running:  { eyebrow: 'Running distance · km per week',        subtitle: 'fixed-last30',  unit: 'km',  unitAfter: 'last 30 days' },
  hrv:      { eyebrow: 'Heart rate variability · ms',           subtitle: 'fixed-latest',  unit: 'ms',  unitAfter: 'latest reading' },
  rhr:      { eyebrow: 'Resting heart rate · bpm',             subtitle: 'fixed-latest',  unit: 'bpm', unitAfter: 'latest reading' },
  weight:   { eyebrow: 'Body weight · kg',                     subtitle: 'fixed-latest',  unit: 'kg',  unitAfter: 'latest reading' },
  sleep:    { eyebrow: 'Sleep score · out of 100',             subtitle: 'ranged-avg',    unit: '/100',unitAfter: null },
  recovery: { eyebrow: 'Recovery score · out of 100',          subtitle: 'ranged-avg',    unit: '/100',unitAfter: null },
  strain:   { eyebrow: 'Whoop strain · daily score',           subtitle: 'fixed-latest',  unit: '',    unitAfter: 'latest reading' },
  calories: { eyebrow: 'Calories balance · kcal per day',      subtitle: 'ranged-avg',    unit: 'kcal',unitAfter: null },
  squat:    { eyebrow: 'Back squat · personal best',           subtitle: 'fixed-latest',  unit: 'kg',  unitAfter: 'latest reading' },
  pullup:   { eyebrow: 'Pull-up · personal best',              subtitle: 'fixed-latest',  unit: 'reps',unitAfter: 'latest reading' },
}

// ─── WEEK BUCKETS FOR RUNNING KM ─────────────────────────────────────────────
function buildWeekBuckets(days, logs, stravaKmMap) {
  const byWeek = {}
  days.forEach(d => {
    const wk = startOfWeek(new Date(d + 'T00:00:00')).toISOString().split('T')[0]
    const km = getKmForDate(d, logs, stravaKmMap)
    byWeek[wk] = (byWeek[wk] || 0) + km
  })
  return byWeek
}

// ─── RUNNING KM HERO NUMBERS ─────────────────────────────────────────────────
function runningHero(logs, stravaKmMap, range) {
  const n = RANGE_DAYS[range] ?? 730
  const days = daysWindow(n)

  // last-30 cumulative
  const last30Days = daysWindow(30)
  const last30km   = last30Days.reduce((s, d) => s + getKmForDate(d, logs, stravaKmMap), 0)

  // weekly stats across range
  const byWeek   = buildWeekBuckets(days, logs, stravaKmMap)
  const weekVals = Object.values(byWeek)
  const bestWeekKm = weekVals.length ? Math.max(...weekVals) : 0
  const bestWeekKey = weekVals.length
    ? Object.keys(byWeek).find(k => byWeek[k] === bestWeekKm) || ''
    : ''
  const avgWeekKm = weekVals.length ? mean(weekVals) : null

  // longest run in range
  let longestKm = 0, longestDate = ''
  days.forEach(d => {
    const km = getKmForDate(d, logs, stravaKmMap)
    if (km > longestKm) { longestKm = km; longestDate = d }
  })

  // total in range
  const totalKm = days.reduce((s, d) => s + getKmForDate(d, logs, stravaKmMap), 0)

  // delta vs prior period
  const prevDays = daysWindow(n, (() => { const e = new Date(); e.setDate(e.getDate() - n); return e })())
  const prevLast30 = prevDays.slice(-30).reduce((s, d) => s + getKmForDate(d, logs, stravaKmMap), 0)
  let delta = null, deltaDir = null
  if (prevLast30 > 0) {
    const pct = ((last30km - prevLast30) / prevLast30) * 100
    delta    = Math.abs(pct).toFixed(0) + '%'
    deltaDir = pct >= 0 ? 'up' : 'down'
  }

  // best week label
  const bestWeekLabel = bestWeekKey
    ? new Date(bestWeekKey + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : ''

  // longest run label
  const longestLabel = longestDate
    ? new Date(longestDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : ''

  return {
    hero: last30km > 0 ? last30km.toFixed(1) : '—',
    delta,
    deltaDir,
    prevLabel: prevLast30 > 0 ? `vs prev 30 days · ${prevLast30.toFixed(0)} km` : 'vs prev 30 days',
    bestWeekKm:   bestWeekKm  > 0 ? bestWeekKm.toFixed(1)  : '—',
    bestWeekLabel,
    avgWeekKm:    avgWeekKm != null ? avgWeekKm.toFixed(1) : '—',
    avgWeekCount: weekVals.length,
    longestKm:    longestKm  > 0 ? longestKm.toFixed(1)   : '—',
    longestLabel,
    totalKm:      totalKm    > 0 ? totalKm.toFixed(0)     : '—',
    rangeWeeks:   weekVals.length,
  }
}

// ─── FORMAT HELPERS ──────────────────────────────────────────────────────────
function fmtRange(range, days) {
  if (!days) return 'All data'
  const end   = new Date()
  const start = new Date(); start.setDate(start.getDate() - (days - 1))
  const fmt   = d => d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
  return `${fmt(start)} → ${fmt(end)}`
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────
export default function Charts({ logs = {}, settings = {}, activities = [], whoopData = {} }) {
  const [activeTab,  setActiveTab ] = useState('running')
  const [range,      setRange     ] = useState('6m')
  const [compare,    setCompare   ] = useState('target')
  const [smoothing,  setSmoothing ] = useState('raw')

  const stravaKmMap = useMemo(() => kmByDateMap(activities), [activities])
  const rangeDays   = RANGE_DAYS[range]

  // ── Running km data ──────────────────────────────────────────────
  const runKm = useMemo(
    () => runningHero(logs, stravaKmMap, range),
    [logs, stravaKmMap, range]
  )

  const isLift = activeTab === 'squat' || activeTab === 'pullup'
  const meta   = METRIC_META[activeTab]

  // ── Hero subtitle text ───────────────────────────────────────────
  function heroSubtitle() {
    if (meta.subtitle === 'fixed-last30')  return 'last 30 days'
    if (meta.subtitle === 'fixed-latest')  return 'latest reading'
    return rangeLabel(range)
  }

  // ── Range window label for page head ────────────────────────────
  const rangeWindowLabel = useMemo(
    () => fmtRange(range, rangeDays),
    [range, rangeDays]
  )

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
      {isLift ? (
        <section className="hero-chart-card r r-3">
          <div className="lift-empty">
            Lift PBs coming with Phase 2.
          </div>
        </section>
      ) : (
        <section className="hero-chart-card r r-3">

          <div className="chart-head">
            <div className="left">
              <div className="eyebrow">{meta.eyebrow}</div>

              {/* Hero number — Running km wired; others show dash */}
              <div className="hero-num">
                {activeTab === 'running' ? (
                  <>
                    {runKm.hero}
                    <span className="unit">
                      km · {heroSubtitle()}
                    </span>
                  </>
                ) : (
                  <>
                    —
                    <span className="unit">{meta.unit} · {heroSubtitle()}</span>
                  </>
                )}
              </div>

              {/* Hero meta / delta */}
              <div className="hero-meta">
                {activeTab === 'running' && runKm.delta ? (
                  <>
                    <span className={`delta ${runKm.deltaDir}`}>
                      {runKm.deltaDir === 'up' ? '▲' : '▼'} {runKm.delta}
                    </span>
                    <span>{runKm.prevLabel}</span>
                  </>
                ) : (
                  <span>No data yet</span>
                )}
              </div>
            </div>

            <div className="right">
              {/* Range control */}
              <div className="control-group">
                <span className="gl">Range</span>
                {['1m','3m','6m','1y','all'].map(r => (
                  <button
                    key={r}
                    className={`filter-pill${range === r ? ' active' : ''}`}
                    onClick={() => setRange(r)}
                  >
                    {r === 'all' ? 'All' : r.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Compare control */}
              <div className="control-group">
                <span className="gl">Compare</span>
                {[
                  { val: 'off',    label: 'Off'       },
                  { val: 'target', label: 'vs Target'  },
                  { val: 'prev',   label: 'vs Prev'    },
                ].map(c => (
                  <button
                    key={c.val}
                    className={`filter-pill${compare === c.val ? ' active' : ''}`}
                    onClick={() => setCompare(c.val)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Chart canvas — placeholder until Session 9 */}
          <div className="chart-canvas">
            <div className="chart-canvas--placeholder">
              <span className="chart-placeholder-note">
                Chart rendering coming in Session 9.
              </span>
            </div>
          </div>

          {/* Bottom controls */}
          <div className="chart-controls-row">
            <div className="left">
              <div className="control-group">
                <span className="gl">Smooth</span>
                {[
                  { val: 'raw', label: 'Raw'      },
                  { val: '4w',  label: '4-wk avg' },
                  { val: '12w', label: '12-wk avg'},
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
              <span className="chart-foot-meta">
                Hover any bar for week details · click an annotation marker to open
              </span>
            </div>
          </div>

        </section>
      )}

      {/* Stat tiles — Running km wired; lift tabs get no tiles */}
      {!isLift && (
        <section className="stats-grid r r-4">
          {activeTab === 'running' ? (
            <>
              <div className="stat-tile">
                <div className="label">Best week</div>
                <div className="value">
                  {runKm.bestWeekKm}
                  {runKm.bestWeekKm !== '—' && <span className="unit">km</span>}
                </div>
                <div className="ctx">{runKm.bestWeekLabel ? `Week of ${runKm.bestWeekLabel}` : 'No data'}</div>
              </div>
              <div className="stat-tile">
                <div className="label">Average week</div>
                <div className="value">
                  {runKm.avgWeekKm}
                  {runKm.avgWeekKm !== '—' && <span className="unit">km</span>}
                </div>
                <div className="ctx">Across {runKm.avgWeekCount} week{runKm.avgWeekCount !== 1 ? 's' : ''}</div>
              </div>
              <div className="stat-tile">
                <div className="label">Longest run</div>
                <div className="value">
                  {runKm.longestKm}
                  {runKm.longestKm !== '—' && <span className="unit">km</span>}
                </div>
                <div className="ctx">{runKm.longestLabel || 'No data'}</div>
              </div>
              <div className="stat-tile">
                <div className="label">Total in view</div>
                <div className="value">
                  {runKm.totalKm}
                  {runKm.totalKm !== '—' && <span className="unit">km</span>}
                </div>
                <div className="ctx">{runKm.rangeWeeks} week{runKm.rangeWeeks !== 1 ? 's' : ''} of data</div>
              </div>
            </>
          ) : (
            // Other tabs: stub tiles
            ['Best', 'Average', 'Peak', 'Total'].map(label => (
              <div className="stat-tile" key={label}>
                <div className="label">{label}</div>
                <div className="value">—</div>
                <div className="ctx">No data yet</div>
              </div>
            ))
          )}
        </section>
      )}

      {/* Annotations — always visible (wired in Charts: 5) */}
      <section className="annot-section r r-5">
        <div className="annot-head">
          <span className="title">Annotations · this view</span>
          <span className="meta">Pulled from Cadence + manual notes</span>
        </div>
        <div className="annot-list">
          <div className="annot-empty">
            <span>Nothing logged yet — PBs detected from runs, other types come later.</span>
          </div>
          <button className="add-annot" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Add annotation
          </button>
        </div>
      </section>

    </div>
  )
}
