'use client'

import { useMemo, useState, useEffect } from 'react'
import { db } from '../../lib/db'
import { apiFetch } from '../../lib/api'
import { dlog } from './CadenceDialog'
import PageHeader from './settings/PageHeader'
import InfoBanner from './settings/InfoBanner'
import AboutYouSection from './settings/AboutYouSection'
import StravaCard from './settings/StravaCard'
import WhoopConnectCard from './settings/WhoopConnectCard'
import ConnectionsSection from './settings/ConnectionsSection'
import TargetSection from './settings/TargetSection'
import CalorieModeSection from './settings/CalorieModeSection'
import WhoopUpload from './settings/WhoopUpload'
import ActivityLog from './settings/ActivityLog'
import {
  currentValues,
  SECTION_LAYOUT,
  diffTargets,
  fmtAuditDetail,
} from './settings/settingsHelpers'

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
  userProfile,
  saveUserProfile,
}) {
  const [local, setLocal] = useState(() => JSON.parse(JSON.stringify(settings)))

  dlog('Settings render')
  useEffect(() => { dlog('Settings MOUNT'); return () => dlog('Settings UNMOUNT') }, [])

  // Audit-log version bump — any action that writes to audit_log
  // (target save, Whoop upload) increments this so the activity log
  // panel in commit 6 refetches without a manual reload.
  const [auditVersion, setAuditVersion] = useState(0)
  const bumpAudit = () => setAuditVersion(v => v + 1)

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

  // Save persists the local copy and writes one target_updated audit
  // row per changed target. Multiple changes in one save = multiple
  // rows. If save fails we don't write audits.
  const handleSave = async () => {
    const changes = diffTargets(settings, local)
    await saveSettings(local)
    for (const change of changes) {
      await db.writeAuditLog(
        'target_updated',
        change.label,
        fmtAuditDetail(change),
        {
          setting_key: change.key,
          old_value:   change.oldValue,
          new_value:   change.newValue,
          unit:        change.unit,
        }
      )
    }
    if (changes.length > 0) bumpAudit()
  }

  const handleDisconnect = async () => {
    await apiFetch('/api/strava/disconnect', { method: 'POST' })
    await onStravaConnectionChange?.()
  }

  // After a manual Strava sync: refresh the stored connection (so the
  // last_synced_at / activity_count stats update on the card) and bump
  // the audit version so the activity log refetches its new strava_sync
  // row without a page reload.
  const handleSynced = async () => {
    await onStravaConnectionChange?.()
    bumpAudit()
  }

  return (
    <div className="settings-page">

      <PageHeader onReset={handleReset} onSave={handleSave} />

      <InfoBanner />

      <AboutYouSection userProfile={userProfile} saveUserProfile={saveUserProfile} />

      <StravaCard
        stravaConnection={stravaConnection}
        shownCount={activities?.length ?? 0}
        hiddenCount={Math.max(0, (stravaConnection?.activity_count ?? 0) - (activities?.length ?? 0))}
        onDisconnect={handleDisconnect}
        onSynced={handleSynced}
      />

      <WhoopConnectCard />

      <ConnectionsSection />

      {(() => {
        // Thread an absolute row index across sections so the bar
        // animation stagger reads as one cascade, not four restarts.
        let runningIndex = 0
        const nodes = []
        for (const section of SECTION_LAYOUT) {
          nodes.push(
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
          if (section.label === 'Activity') {
            nodes.push(
              <CalorieModeSection
                key="calorie-mode"
                mode={local.calorieTargetMode ?? null}
                onChange={m => setLocal(prev => ({ ...prev, calorieTargetMode: m }))}
                logs={logs}
                activities={activities}
              />
            )
          }
        }
        return nodes
      })()}

      <div className="save-row r r-8">
        <button type="button" className="btn btn-primary btn-lg" onClick={handleSave}>Save targets</button>
      </div>

      <WhoopUpload onAuditWritten={bumpAudit} />

      <ActivityLog auditVersion={auditVersion} />

      <section className="settings-section r r-9">
        <div className="section-head">
          <span className="section-label">Display</span>
        </div>
        <div className="section-body">
          <div className="ay-field">
            <div className="ay-label">Auto theme</div>
            <label className="ac-toggle-label">
              <input
                type="checkbox"
                className="ac-toggle-input"
                checked={!!local.autoTheme}
                onChange={e => setLocal(prev => ({ ...prev, autoTheme: e.target.checked }))}
              />
              <span className="ac-toggle-track"><span className="ac-toggle-thumb" /></span>
              <span className="ac-toggle-text">{local.autoTheme ? 'Enabled' : 'Disabled'}</span>
            </label>
            {local.autoTheme && (
              <div className="ay-helper">Light from 06:00 · Dark from 21:00</div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
