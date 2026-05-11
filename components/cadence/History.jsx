'use client'

import { useState } from 'react'
import SummaryStrip from './history/SummaryStrip'
import { fmtLastSync } from './history/historyHelpers'

/**
 * Cadence — History page.
 *
 * Mockup: design/mockups/cadence-history.html
 * Page head + summary strip are wired to real activity data here.
 * Filters, grouping, PB heuristic and load-more arrive in later commits.
 */
export default function History({ activities = [], stravaConnection = null }) {
  const [range, setRange] = useState('this-month')

  const lastSync = fmtLastSync(stravaConnection?.last_synced_at)
  const totalSessions = activities.length

  return (
    <div className="history" data-range={range}>

      {/* ===== Page head ===== */}
      <header className="page-head r r-1">
        <div>
          <div className="eyebrow">Analyse</div>
          <h1>History<span style={{ color: 'var(--moss)' }}>.</span></h1>
          <p className="sub">Every session, every source, sortable from this morning back to the beginning.</p>
        </div>
        <div className="meta">
          <span className="dot" />
          <span>{totalSessions} total · {lastSync}</span>
        </div>
      </header>

      {/* ===== Summary strip — density tile + 3 stat tiles ===== */}
      <SummaryStrip activities={activities} />

      {/* ===== Filters ===== */}
      <section className="filters r r-3">
        <div className="search-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input className="search-input" type="text" placeholder="Search by name, type, or note…" disabled />
        </div>

        <div className="filter-group" data-filter="type">
          <span className="gl">Type</span>
          <button type="button" className="filter-pill active">All</button>
          <button type="button" className="filter-pill"><span className="pip run" />Run</button>
          <button type="button" className="filter-pill"><span className="pip strength" />Strength</button>
          <button type="button" className="filter-pill"><span className="pip recovery" />Recovery</button>
        </div>

        <div className="filter-group" data-filter="source">
          <span className="gl">Source</span>
          <button type="button" className="filter-pill active">All</button>
          <button type="button" className="filter-pill">Strava</button>
          <button type="button" className="filter-pill">Whoop</button>
          <button type="button" className="filter-pill">Manual</button>
        </div>

        <div className="range-picker">
          <button type="button" className="range-btn">
            <span>This month</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
          </button>
        </div>
      </section>

      {/* ===== Empty state (hidden by default) ===== */}
      <div className="empty-state">
        Nothing matches. Try a wider date range or clear your filters.
      </div>

      {/* ===== Activity list — year banners, month dividers, weeks ===== */}
      {/* Placeholder until commit 5 wires real grouping. */}
      <div className="year-banner">
        <span className="num">—</span>
        <span className="line" />
        <span className="scope">—</span>
      </div>

      <div className="month-divider">
        <span className="name">—</span>
        <span className="totals"><span>—</span></span>
      </div>

      <section className="week r r-4">
        <div className="week-head">
          <span className="title">Week of —</span>
          <span className="totals"><span>Activity list scaffold — wired in commit 5.</span></span>
        </div>
        <div className="activity-list" />
      </section>

      {/* ===== Archive stub (visible only at all-time) ===== */}
      <div className="archive-stub">
        <div className="year">— ↓</div>
        <div className="text">Archive coming in commit 5.</div>
        <div className="meta">Use search or narrow the date range to find a specific session</div>
      </div>

      <button type="button" className="load-more r r-8">Load earlier weeks</button>

      <div className="footer-count r r-9">
        <span>Showing — of {activities.length} sessions</span>
        <span>Synced from Strava, Whoop, manual entries</span>
      </div>
    </div>
  )
}
