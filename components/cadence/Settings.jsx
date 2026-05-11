'use client'

import { useState } from 'react'

/**
 * Cadence — Settings page.
 *
 * Mockup: design/mockups/cadence-settings.html
 * Scaffold only. Subsequent commits add CSS, the page header,
 * the info banner, the Strava card, target sections, the
 * target_updated audit writes, the Whoop upload section, and
 * the activity log.
 */
export default function Settings({
  settings,
  saveSettings,
  stravaConnection,
  onStravaConnectionChange,
  logs,
  whoopData,
  activities,
}) {
  const [local, setLocal] = useState(() => JSON.parse(JSON.stringify(settings)))

  return (
    <div className="settings-page">

      {/* ===== Page header ===== */}
      <header className="page-header r r-1">
        <div>
          <h1 className="page-title">Goals &amp; <em>targets.</em></h1>
          <div className="page-sub">The numbers Cadence measures everything else against</div>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-ghost">Reset defaults</button>
          <button type="button" className="btn btn-primary">Save</button>
        </div>
      </header>

      {/* ===== Info banner ===== */}
      <div className="info-banner r r-2">
        <div className="info-banner-eyebrow">How targets work</div>
        <div className="info-banner-body">
          Cadence measures every metric — dashboard, charts, daily log — against the targets you set here. Bars show where you currently stand.
          <span className="info-states">
            <span className="item"><span className="pip moss" />On target</span>
            <span className="item"><span className="pip sand" />Approaching</span>
            <span className="item"><span className="pip clay" />Off target</span>
          </span>
        </div>
      </div>

      {/* ===== Strava integration ===== */}
      <section className="settings-section r r-3">
        <div className="section-head">
          <span className="section-label">Strava</span>
          <span className="status-badge">—</span>
        </div>
        <div className="section-body">Strava card scaffold — wired in commit 3.</div>
      </section>

      {/* ===== Running ===== */}
      <section className="settings-section r r-4">
        <div className="section-head"><span className="section-label">Running</span></div>
        <div className="section-body">Target rows wired in commit 4.</div>
      </section>

      {/* ===== Body metrics ===== */}
      <section className="settings-section r r-5">
        <div className="section-head"><span className="section-label">Body metrics</span></div>
        <div className="section-body">Target rows wired in commit 4.</div>
      </section>

      {/* ===== Sleep & recovery ===== */}
      <section className="settings-section r r-6">
        <div className="section-head"><span className="section-label">Sleep &amp; recovery</span></div>
        <div className="section-body">Target rows wired in commit 4.</div>
      </section>

      {/* ===== Nutrition ===== */}
      <section className="settings-section r r-7">
        <div className="section-head"><span className="section-label">Nutrition</span></div>
        <div className="section-body">Target rows wired in commit 4.</div>
      </section>

      {/* ===== Save row ===== */}
      <div className="save-row r r-8">
        <button type="button" className="btn btn-primary btn-lg">Save targets</button>
      </div>

      {/* ===== Whoop data import ===== */}
      <section className="settings-section r r-9">
        <div className="section-head">
          <span className="section-label">Whoop data import</span>
          <span className="section-sub">—</span>
        </div>
        <div className="section-body">Upload grid wired in commit 5.</div>
      </section>

      {/* ===== Activity log ===== */}
      <section className="settings-section r r-10">
        <div className="section-head"><span className="section-label">Activity log</span></div>
        <div className="section-body">Audit log wired in commit 6.</div>
      </section>
    </div>
  )
}
