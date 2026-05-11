'use client'

import { useState } from 'react'
import PageHeader from './settings/PageHeader'
import InfoBanner from './settings/InfoBanner'
import StravaCard from './settings/StravaCard'

/**
 * Cadence — Settings page.
 *
 * Mockup: design/mockups/cadence-settings.html
 * Page header, info banner, and Strava card are wired.
 * Target sections, target_updated audit writes, Whoop upload,
 * and the activity log arrive in subsequent commits.
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

  // Save / Reset are wired against the local copy. Target rows in commit 4
  // make this copy diverge from `settings`; commit 4.5 will diff the two
  // and write target_updated audit rows on save.
  const handleSave = async () => {
    await saveSettings(local)
  }
  const handleReset = () => {
    setLocal(JSON.parse(JSON.stringify(settings)))
  }

  const handleDisconnect = async () => {
    await fetch('/api/strava/disconnect', { method: 'POST' })
    await onStravaConnectionChange?.()
  }

  return (
    <div className="settings-page">

      <PageHeader onReset={handleReset} onSave={handleSave} />

      <InfoBanner />

      <StravaCard stravaConnection={stravaConnection} onDisconnect={handleDisconnect} />

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
