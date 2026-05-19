'use client'

import { useMemo } from 'react'

const MOOD_WORDS = { 1: 'Rough', 2: 'Flat', 3: 'Okay', 4: 'Good', 5: 'Strong' }

function localIso(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function fmtJournalDate(isoDate) {
  const today = localIso()
  const d = new Date(isoDate + 'T00:00:00')
  const day = d.getDate()
  const mon = d.toLocaleDateString('en-GB', { month: 'short' })
  const year = d.getFullYear()
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

export default function Journal({ logs = {}, setView }) {
  const entries = useMemo(() => {
    return Object.entries(logs)
      .filter(([, log]) => hasContent(log?.data?.feelings))
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, log]) => ({ date, feelings: log.data.feelings }))
  }, [logs])

  return (
    <div className="journal-page">
      <header className="journal-header r r-1">
        <h2 className="journal-title">Journal</h2>
      </header>

      {entries.length === 0 ? (
        <div className="journal-empty r r-2">
          <p className="journal-empty-text">Nothing logged yet.</p>
          <button type="button" className="btn btn-ghost" onClick={() => setView('log')}>
            Open Daily data →
          </button>
        </div>
      ) : (
        <div className="journal-list">
          {entries.map((entry, index) => (
            <div key={entry.date} className="journal-entry">
              <div className="journal-date-label">{fmtJournalDate(entry.date)}</div>
              <EntryCard feelings={entry.feelings} index={index} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
