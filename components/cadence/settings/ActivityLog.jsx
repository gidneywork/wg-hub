'use client'

import { useEffect, useMemo, useState } from 'react'
import { db } from '../../../lib/db'

// Display label per event_type. Falls through to sentence-case-from-snake
// for any future event types we haven't mapped yet.
const TYPE_LABELS = {
  whoop_upload:   'Whoop upload',
  strava_sync:    'Strava sync',
  target_updated: 'Target updated',
  activity_sync:  'Activity sync',
  pb_set:         'Personal best',
}
function labelForType(t) {
  if (TYPE_LABELS[t]) return TYPE_LABELS[t]
  if (!t) return 'Event'
  const s = t.replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const FILTER_OPTIONS = [
  { val: 'all',            label: 'All events' },
  { val: 'whoop_upload',   label: 'Whoop upload' },
  { val: 'strava_sync',    label: 'Strava sync' },
  { val: 'target_updated', label: 'Target updated' },
]

// Relative time formatter per brief: "Nm ago" / "Nh ago" / "Yesterday"
// / "DD Mon" within this year / "DD Mon YY" older.
function fmtTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now - d
  const mins = Math.floor(diffMs / 60000)
  const hours = Math.floor(mins / 60)

  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`

  // Same calendar day check guards against the "Yesterday" lookup
  // accidentally returning today across DST boundaries.
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0)
  const startOfThat  = new Date(d);   startOfThat.setHours(0, 0, 0, 0)
  const dayDiff = Math.round((startOfToday - startOfThat) / 86400000)
  if (dayDiff === 1) return 'Yesterday'

  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  }
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

export default function ActivityLog({ auditVersion = 0 }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // 250ms debounce on the search input — keeps Supabase calls modest.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(id)
  }, [search])

  // Refetch when the filter, debounced search, or audit-version bump
  // change. The auditVersion bump fires from Settings.jsx after any
  // write to audit_log (target save, Whoop upload) so the panel
  // refreshes without a manual reload.
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      const rows = await db.loadAuditLog({
        type:   typeFilter === 'all' ? undefined : typeFilter,
        search: debouncedSearch || undefined,
        limit:  200,
      })
      if (!cancelled) {
        setEntries(rows || [])
        setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [typeFilter, debouncedSearch, auditVersion])

  const countLabel = useMemo(() => {
    const n = entries.length
    if (loading) return 'Loading…'
    return `${n} ${n === 1 ? 'entry' : 'entries'}`
  }, [entries.length, loading])

  return (
    <section className="settings-section r r-10">
      <div className="section-head">
        <span className="section-label">Activity log</span>
      </div>

      <div className="log-controls">
        <input
          type="text"
          className="log-search"
          placeholder="Search logs…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="log-filter"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
        >
          {FILTER_OPTIONS.map(opt => (
            <option key={opt.val} value={opt.val}>{opt.label}</option>
          ))}
        </select>
        <span className="log-count">{countLabel}</span>
      </div>

      {entries.length === 0 && !loading ? (
        <div className="log-empty">
          <span className="no-data">No matching activity</span>
        </div>
      ) : (
        entries.map(e => (
          <div className="log-entry" key={e.id}>
            <div className="log-time">{fmtTime(e.created_at)}</div>
            <div className="log-type">{labelForType(e.event_type)}</div>
            <div className="log-message">
              {e.title}
              {e.detail ? <span className="meta">{e.detail}</span> : null}
            </div>
          </div>
        ))
      )}
    </section>
  )
}
