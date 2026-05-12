'use client'

import { useEffect, useMemo, useState } from 'react'
import SummaryStrip from './history/SummaryStrip'
import Filters from './history/Filters'
import ActivityList from './history/ActivityList'
import CadenceDialog from './CadenceDialog'
import { db } from '../../lib/db'
import {
  fmtLastSync,
  filterByRange,
  applyFilters,
  computePBIds,
  groupByWeek,
  groupWeeksByMonth,
  groupMonthsByYear,
} from './history/historyHelpers'

const INITIAL_WEEKS = 4

/**
 * Cadence — History page.
 * Mockup: design/mockups/cadence-history.html
 */
export default function History({ activities = [], stravaConnection = null }) {
  const [range, setRange] = useState('this-month')
  const [rangeOpen, setRangeOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [weeksVisible, setWeeksVisible] = useState(INITIAL_WEEKS)

  // ── Edit modal state ─────────────────────────────────────────────────────────
  const [editingActivity, setEditingActivity] = useState(null)
  const [editDraft,       setEditDraft      ] = useState({ customName: '', customType: '', notes: '' })
  const [editSaving,      setEditSaving     ] = useState(false)

  const onEditActivity = (activity) => {
    setEditDraft({
      customName: activity.custom_name || '',
      customType: activity.custom_type || '',
      notes:      activity.notes       || '',
    })
    setEditingActivity(activity)
  }

  const handleEditSave = async () => {
    if (!editingActivity) return
    setEditSaving(true)
    try {
      await db.updateActivity(editingActivity.id, {
        custom_name: editDraft.customName.trim() || null,
        custom_type: editDraft.customType       || null,
        notes:       editDraft.notes.trim()     || null,
      })
      setEditingActivity(null)
    } finally {
      setEditSaving(false)
    }
  }

  const handleEditReset = async () => {
    if (!editingActivity) return
    await db.updateActivity(editingActivity.id, { custom_name: null, custom_type: null, notes: null })
    setEditingActivity(null)
  }

  const isDraftUnchanged = editingActivity != null && (
    (editDraft.customName.trim() || null) === (editingActivity.custom_name || null) &&
    (editDraft.customType       || null) === (editingActivity.custom_type  || null) &&
    (editDraft.notes.trim()     || null) === (editingActivity.notes        || null)
  )

  const hasCustomizations = !!(
    editingActivity?.custom_name ||
    editingActivity?.custom_type ||
    editingActivity?.notes
  )

  // Reset load-more when the user changes any filter — otherwise a tight
  // result set could carry stale "Load earlier weeks" state.
  useEffect(() => { setWeeksVisible(INITIAL_WEEKS) }, [range, typeFilter, sourceFilter, search])

  const totalSessions = activities.length
  const lastSync = fmtLastSync(stravaConnection?.last_synced_at)

  // PBs are computed across the full history so the tag is stable as
  // filters change.
  const pbIds = useMemo(() => computePBIds(activities), [activities])

  const derived = useMemo(() => {
    const inRange = filterByRange(activities, range)
    const filtered = applyFilters(inRange, { typeFilter, sourceFilter, search })
    const allWeeks = groupByWeek(filtered)
    const visibleWeeks = allWeeks.slice(0, weeksVisible)
    const renderedCount = visibleWeeks.reduce((s, w) => s + w.activities.length, 0)
    const months = groupWeeksByMonth(visibleWeeks)
    const years = groupMonthsByYear(months)

    const archiveActivities = allWeeks.slice(weeksVisible).flatMap(w => w.activities)
    const archiveCount = archiveActivities.length
    let archiveYear = null
    let archiveFromLabel = null
    if (archiveCount > 0) {
      const newestInArchive = archiveActivities[0]
      const oldestInArchive = archiveActivities[archiveActivities.length - 1]
      if (newestInArchive?.start_date) {
        archiveYear = new Date(newestInArchive.start_date).getFullYear()
      }
      if (oldestInArchive?.start_date) {
        const d = new Date(oldestInArchive.start_date)
        archiveFromLabel = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
      }
    }

    return {
      hasResults: filtered.length > 0,
      renderedCount,
      years,
      moreWeeksAvailable: weeksVisible < allWeeks.length,
      archive: { count: archiveCount, year: archiveYear, fromLabel: archiveFromLabel },
    }
  }, [activities, range, typeFilter, sourceFilter, search, weeksVisible])

  return (
    <div className="history" data-range={range}>

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

      <SummaryStrip activities={activities} />

      <Filters
        search={search} setSearch={setSearch}
        typeFilter={typeFilter} setTypeFilter={setTypeFilter}
        sourceFilter={sourceFilter} setSourceFilter={setSourceFilter}
        range={range} setRange={setRange}
        rangeOpen={rangeOpen} setRangeOpen={setRangeOpen}
      />

      <CadenceDialog
        open={editingActivity != null}
        title="Edit activity"
        confirmLabel="Save"
        confirmClass="btn-primary"
        cancelLabel="Cancel"
        confirmDisabled={editSaving || isDraftUnchanged}
        footerExtra={
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleEditReset}
            disabled={!hasCustomizations || editSaving}
          >
            Reset to defaults
          </button>
        }
        onConfirm={handleEditSave}
        onCancel={() => setEditingActivity(null)}
        body={editingActivity && (
          <div className="edit-form">
            <div>
              <label className="edit-label">Display name</label>
              <input
                type="text"
                className="edit-input"
                value={editDraft.customName}
                placeholder={editingActivity.data?.name || 'Activity'}
                onChange={e => setEditDraft(d => ({ ...d, customName: e.target.value }))}
              />
            </div>
            <div>
              <label className="edit-label">Workout type</label>
              <select
                className="edit-select"
                value={editDraft.customType}
                onChange={e => setEditDraft(d => ({ ...d, customType: e.target.value }))}
              >
                <option value="">Default (from Strava)</option>
                <option value="run">Running</option>
                <option value="strength">Strength</option>
                <option value="functional">Functional</option>
                <option value="yoga">Yoga</option>
                <option value="bike">Cycling</option>
                <option value="swim">Swimming</option>
              </select>
            </div>
            <div>
              <label className="edit-label">Notes</label>
              <textarea
                className="edit-textarea"
                value={editDraft.notes}
                placeholder="Anything worth noting about this session."
                rows={3}
                onChange={e => setEditDraft(d => ({ ...d, notes: e.target.value }))}
              />
            </div>
          </div>
        )}
      />

      {derived.hasResults ? (
        <>
          <ActivityList
            years={derived.years}
            pbIds={pbIds}
            archive={derived.archive}
            moreWeeksAvailable={derived.moreWeeksAvailable}
            onLoadMore={() => setWeeksVisible(weeksVisible + 1)}
            onEditActivity={onEditActivity}
          />

          <div className="footer-count r r-9">
            <span>Showing {derived.renderedCount} of {totalSessions} sessions</span>
            <span>Synced from Strava, Whoop, manual entries</span>
          </div>
        </>
      ) : (
        <div className="empty-state show">
          Nothing matches. Try a wider date range or clear your filters.
        </div>
      )}
    </div>
  )
}
