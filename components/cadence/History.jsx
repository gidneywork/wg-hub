'use client'

import { useEffect, useMemo, useState } from 'react'
import SummaryStrip from './history/SummaryStrip'
import Filters from './history/Filters'
import ActivityList from './history/ActivityList'
import MuscleVolumePanel from './history/MuscleVolumePanel'
import { localIso, startOfWeek } from './helpers'
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
export default function History({ activities = [], stravaConnection = null, logs = {} }) {
  const [range, setRange] = useState('this-month')
  const [rangeOpen, setRangeOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [weeksVisible, setWeeksVisible] = useState(INITIAL_WEEKS)

  // Reset load-more when the user changes any filter — otherwise a tight
  // result set could carry stale "Load earlier weeks" state.
  useEffect(() => { setWeeksVisible(INITIAL_WEEKS) }, [range, typeFilter, sourceFilter, search])

  const currentWeekStart = localIso(startOfWeek())

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

      <MuscleVolumePanel logs={logs} currentWeekStart={currentWeekStart} />

      <Filters
        search={search} setSearch={setSearch}
        typeFilter={typeFilter} setTypeFilter={setTypeFilter}
        sourceFilter={sourceFilter} setSourceFilter={setSourceFilter}
        range={range} setRange={setRange}
        rangeOpen={rangeOpen} setRangeOpen={setRangeOpen}
      />

      {derived.hasResults ? (
        <>
          <ActivityList
            years={derived.years}
            pbIds={pbIds}
            archive={derived.archive}
            moreWeeksAvailable={derived.moreWeeksAvailable}
            onLoadMore={() => setWeeksVisible(weeksVisible + 1)}
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
