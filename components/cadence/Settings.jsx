'use client'

import { useMemo, useState } from 'react'
import PageHeader from './settings/PageHeader'
import InfoBanner from './settings/InfoBanner'
import StravaCard from './settings/StravaCard'
import TargetSection from './settings/TargetSection'
import { currentValues, SECTION_LAYOUT } from './settings/settingsHelpers'

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
  defaultSettings,
  saveSettings,
  stravaConnection,
  onStravaConnectionChange,
  logs,
  whoopData,
  activities,
}) {
  const [local, setLocal] = useState(() => JSON.parse(JSON.stringify(settings)))

  // Live values for each target row — sums + rolling means over the same
  // data the dashboard reads. Recomputed when any source changes.
  const currents = useMemo(
    () => currentValues({ logs, whoopData, activities }),
    [logs, whoopData, activities]
  )

  const setTarget = (key, v) => {
    setLocal(prev => ({ ...prev, [key]: { ...prev[key], value: v } }))
  }

  // Reset reverts the local copy to the canonical defaults — the shipped
  // DEFAULT_SETTINGS from WGHub. The user must hit Save to persist.
  const handleReset = () => {
    if (defaultSettings) {
      setLocal(JSON.parse(JSON.stringify(defaultSettings)))
    } else {
      setLocal(JSON.parse(JSON.stringify(settings)))
    }
  }

  // Audit writes for changed targets land in commit 4.5; for now the
  // save simply persists the local copy.
  const handleSave = async () => {
    await saveSettings(local)
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

      {(() => {
        // Thread an absolute row index across sections so the bar
        // animation stagger reads as one cascade, not four restarts.
        let runningIndex = 0
        return SECTION_LAYOUT.map(section => {
          const node = (
            <TargetSection
              key={section.label}
              label={section.label}
              rN={section.rN}
              keys={section.keys}
              local={local}
              currents={currents}
              setTarget={setTarget}
              baseRowIndex={runningIndex}
            />
          )
          runningIndex += section.keys.length
          return node
        })
      })()}

      <div className="save-row r r-8">
        <button type="button" className="btn btn-primary btn-lg" onClick={handleSave}>Save targets</button>
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
