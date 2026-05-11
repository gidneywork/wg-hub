'use client'

import { useState } from 'react'
import SummaryStrip from './history/SummaryStrip'
import Filters from './history/Filters'
import { fmtLastSync } from './history/historyHelpers'

/**
 * Cadence — History page.
 *
 * Mockup: design/mockups/cadence-history.html
 * Page head, summary strip and filters bar are wired.
 * Grouping, PB heuristic, load-more, footer count and empty state
 * arrive in the next commit.
 */
export default function History({ activities = [], stravaConnection = null }) {
  const [range, setRange] = useState('this-month')
  const [rangeOpen, setRangeOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')

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
      <Filters
        search={search} setSearch={setSearch}
        typeFilter={typeFilter} setTypeFilter={setTypeFilter}
        sourceFilter={sourceFilter} setSourceFilter={setSourceFilter}
        range={range} setRange={setRange}
        rangeOpen={rangeOpen} setRangeOpen={setRangeOpen}
      />

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
