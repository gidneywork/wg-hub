'use client'

import { useState } from 'react'
import SaveStatus from './daily/SaveStatus'
import DateNav from './daily/DateNav'
import { todayIso } from './daily/dailyHelpers'

/**
 * Cadence — Daily Data page.
 *
 * Mockup: design/mockups/cadence-daily-data.html
 * Page head, save-status pill, and date nav are wired.
 * Synced tiles, body + nutrition with auto-save, and the
 * Phase 2 stubs for lifts and how-it-landed arrive next.
 */
export default function Daily({
  logs,
  saveLog,
  settings,
  whoopData,
  activities,
}) {
  const [date, setDate] = useState(todayIso())

  // Auto-save state — wired into the input flow in commit 5. For
  // commit 3 the pill renders at idle with the page-load timestamp so
  // the pulse animation runs and the layout is visible end-to-end.
  const [saveState, setSaveState] = useState('idle')
  const [savedAt, setSavedAt] = useState(() => new Date())

  return (
    <div className="daily-page">

      {/* ===== Page head — title + save-status pill ===== */}
      <header className="page-head r r-1">
        <div>
          <div className="eyebrow">Entry</div>
          <h1>Daily data<span style={{ color: 'var(--moss)' }}>.</span></h1>
          <p className="sub">Body, nutrition, lifts, and how it landed.</p>
        </div>
        <SaveStatus state={saveState} savedAt={savedAt} />
      </header>

      {/* ===== Date nav ===== */}
      <DateNav date={date} setDate={setDate} logs={logs} />

      {/* ===== Synced — read-only Whoop + Strava tiles ===== */}
      <section className="section r r-3">
        <div className="section-head">
          <span className="title">Synced</span>
          <span className="meta">From Whoop · Strava · — · ↻ Sync now</span>
        </div>
        <div className="synced-grid">
          {/* 5 tiles wired in commit 4 */}
        </div>
      </section>

      {/* ===== Body — manual entry with targets ===== */}
      <section className="section r r-4">
        <div className="section-head">
          <span className="title">Body</span>
          <span className="meta">3 fields · manual entry</span>
        </div>
        <div className="field-grid">
          {/* Weight + Steps + Calories burnt — wired in commit 5 */}
        </div>
      </section>

      {/* ===== Nutrition — manual entry with targets ===== */}
      <section className="section r r-5">
        <div className="section-head">
          <span className="title">Nutrition</span>
          <span className="meta">Manual entry · target shown on each</span>
        </div>
        <div className="field-grid">
          {/* Calories + Protein + Carbs — wired in commit 5 */}
        </div>
      </section>

      {/* ===== Lifts — Phase 2 stub ===== */}
      <section className="section r r-6">
        <div className="section-head">
          <span className="title">Lifts</span>
          <span className="meta">Optional</span>
        </div>
        <div className="lifts-card">
          <div className="lift-empty">Lifts section scaffold — wired in commit 6.</div>
        </div>
      </section>

      {/* ===== How it landed — Phase 2 stub ===== */}
      <section className="section r r-7">
        <div className="section-head">
          <span className="title">How it landed</span>
          <span className="meta">Optional</span>
        </div>
        <div className="feelings-card">
          {/* Mood pips + journal — wired in commit 6 */}
        </div>
      </section>

      {/* ===== Day footer — keyboard hints + entry count ===== */}
      <div className="day-footer r r-8">
        <div className="keyhint">Footer wired in commit 7.</div>
        <div>—</div>
      </div>
    </div>
  )
}
