'use client'

import { useMemo, useState } from 'react'
import { rangeBounds } from './history/historyHelpers'

const MOOD_WORDS = { 1: 'Rough', 2: 'Flat', 3: 'Okay', 4: 'Good', 5: 'Strong' }

const RANGE_OPTIONS = [
  { value: 'this-week',  label: 'This week' },
  { value: 'this-month', label: 'This month' },
  { value: '3-months',   label: 'Last 3 months' },
  { value: 'this-year',  label: 'This year' },
  { value: 'all-time',   label: 'All time' },
]

const SUBSECTION_OPTIONS = [
  { value: 'all',          label: 'All sections' },
  { value: 'mood',         label: 'Mood' },
  { value: 'notes',        label: 'Notes' },
  { value: 'productivity', label: 'Productivity' },
  { value: 'gratitude',    label: 'Gratitude' },
  { value: 'injuries',     label: 'Injuries' },
]

const SUBSECTION_LABELS = {
  all: 'entries', notes: 'Notes', mood: 'Mood',
  productivity: 'Productivity', gratitude: 'Gratitude', injuries: 'Injuries',
}

function localIso(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function isoFromDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function inRange(isoDate, start, end) {
  if (!start && !end) return true
  const s = start ? isoFromDate(start) : null
  const e = end   ? isoFromDate(end)   : null
  if (s && isoDate < s) return false
  if (e && isoDate > e) return false
  return true
}

function fmtJournalDate(isoDate) {
  const today = localIso()
  const d = new Date(isoDate + 'T00:00:00')
  const day   = d.getDate()
  const mon   = d.toLocaleDateString('en-GB', { month: 'short' })
  const year  = d.getFullYear()
  const shortWd = d.toLocaleDateString('en-GB', { weekday: 'short' })
  const longWd  = d.toLocaleDateString('en-GB', { weekday: 'long' })
  if (isoDate === today) return `Today · ${shortWd} ${day} ${mon} ${year}`
  const next = new Date(isoDate + 'T00:00:00')
  next.setDate(next.getDate() + 1)
  if (localIso(next) === today) return `Yesterday · ${shortWd} ${day} ${mon} ${year}`
  return `${longWd} ${day} ${mon} ${year}`
}

function hasContent(feelings) {
  if (!feelings) return false
  return !!(
    feelings.mood ||
    feelings.moodNote?.trim() ||
    feelings.journal?.trim() ||
    feelings.productivity?.trim() ||
    feelings.gratitude?.trim() ||
    feelings.injuries?.trim()
  )
}

function hasSubsection(feelings, sub) {
  if (sub === 'all')          return true
  if (sub === 'mood')         return feelings.mood != null || !!feelings.moodNote?.trim()
  if (sub === 'notes')        return !!feelings.journal?.trim()
  if (sub === 'productivity') return !!feelings.productivity?.trim()
  if (sub === 'gratitude')    return !!feelings.gratitude?.trim()
  if (sub === 'injuries')     return !!feelings.injuries?.trim()
  return false
}

function EntryCard({ feelings, index }) {
  const { mood, moodNote, journal, productivity, gratitude, injuries } = feelings
  const cls = index < 10
    ? `journal-card r r-${Math.min(index + 2, 10)}`
    : 'journal-card'

  return (
    <article className={cls}>
      <span className="jc-eyebrow">Entry</span>

      {(mood != null || moodNote?.trim()) && (
        <div className="jc-section">
          <span className="jc-label">Mood</span>
          <div className="jc-mood">
            {mood != null && (
              <>
                <span className="jc-mood-pip" aria-hidden="true" />
                <span className="jc-mood-word">{MOOD_WORDS[mood] ?? mood}</span>
              </>
            )}
            {moodNote?.trim() && (
              <span className="jc-mood-note">{moodNote.trim()}</span>
            )}
          </div>
        </div>
      )}

      {journal?.trim() && (
        <div className="jc-section">
          <span className="jc-label">Notes</span>
          <p className="jc-text">{journal.trim()}</p>
        </div>
      )}

      {productivity?.trim() && (
        <div className="jc-section">
          <span className="jc-label">Productivity</span>
          <p className="jc-text">{productivity.trim()}</p>
        </div>
      )}

      {gratitude?.trim() && (
        <div className="jc-section">
          <span className="jc-label">Gratitude</span>
          <p className="jc-text">{gratitude.trim()}</p>
        </div>
      )}

      {injuries?.trim() && (
        <div className="jc-section">
          <span className="jc-label">Injuries</span>
          <p className="jc-text">{injuries.trim()}</p>
        </div>
      )}
    </article>
  )
}

export default function Journal({ logs = {}, setView, onOpenDate }) {
  const [range, setRange]         = useState('this-month')
  const [subsection, setSubsection] = useState('all')

  const allEntries = useMemo(() => {
    return Object.entries(logs)
      .filter(([, log]) => hasContent(log?.data?.feelings))
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, log]) => ({ date, feelings: log.data.feelings }))
  }, [logs])

  const { start, end } = useMemo(() => rangeBounds(range), [range])

  const rangeFiltered = useMemo(
    () => allEntries.filter(e => inRange(e.date, start, end)),
    [allEntries, start, end]
  )

  const displayed = useMemo(
    () => rangeFiltered.filter(e => hasSubsection(e.feelings, subsection)),
    [rangeFiltered, subsection]
  )

  let emptyContent = null
  if (allEntries.length === 0) {
    emptyContent = (
      <div className="journal-empty r r-2">
        <p className="journal-empty-text">Nothing logged yet.</p>
        <button type="button" className="btn btn-ghost" onClick={() => setView('log')}>
          Open Daily data →
        </button>
      </div>
    )
  } else if (rangeFiltered.length === 0) {
    emptyContent = (
      <div className="journal-empty r r-2">
        <p className="journal-empty-text">No entries in this period.</p>
      </div>
    )
  } else if (displayed.length === 0) {
    const label = SUBSECTION_LABELS[subsection] ?? subsection
    emptyContent = (
      <div className="journal-empty r r-2">
        <p className="journal-empty-text">No {label} entries in this period.</p>
      </div>
    )
  }

  return (
    <div className="journal-page">
      <header className="journal-header r r-1">
        <h2 className="journal-title">Journal</h2>
        <div className="journal-filters">
          <select
            className="journal-filter-select"
            value={range}
            onChange={e => setRange(e.target.value)}
          >
            {RANGE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            className="journal-filter-select"
            value={subsection}
            onChange={e => setSubsection(e.target.value)}
          >
            {SUBSECTION_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </header>

      {emptyContent ?? (
        <div className="journal-list">
          {displayed.map((entry, index) => (
            <div key={entry.date} className="journal-entry">
              <div
                className={`journal-date-label${onOpenDate ? ' journal-date-link' : ''}`}
                onClick={onOpenDate ? () => onOpenDate(entry.date) : undefined}
                role={onOpenDate ? 'button' : undefined}
                tabIndex={onOpenDate ? 0 : undefined}
                onKeyDown={onOpenDate ? e => (e.key === 'Enter' || e.key === ' ') && onOpenDate(entry.date) : undefined}
              >
                {fmtJournalDate(entry.date)}
              </div>
              <EntryCard feelings={entry.feelings} index={index} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
