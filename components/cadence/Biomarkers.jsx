'use client'

import { useState, useEffect, useMemo } from 'react'
import { db } from '../../lib/db'
import { SUB_MARKERS, getStatus, getNextDue, fmtDue } from '../../lib/biomarkers'

const SECTIONS = [
  { key: 'quarterly', label: 'Quarterly' },
  { key: 'annual',    label: 'Annual'    },
  { key: 'one_time',  label: 'One-time'  },
]

const PILL_LABELS = {
  in_range:     'In range',
  out_of_range: 'Out of range',
  due:          'Due',
}

function StatusPill({ status }) {
  if (status === 'logged' || status === 'no_data' || status === 'due') return null
  return <span className={`bm-pill bm-pill--${status}`}>{PILL_LABELS[status]}</span>
}

function DuePill({ status }) {
  if (status !== 'due') return null
  return <span className="bm-pill bm-pill--due">Due</span>
}

function NoDataBadge() {
  return <span className="bm-pill bm-pill--no_data">No data</span>
}

function LatestValue({ def, latestResult }) {
  if (!latestResult) return null
  if (def.target_direction === 'qualitative') {
    if (!latestResult.value_text) return null
    return <span className="bm-latest-value">{latestResult.value_text}</span>
  }
  if (latestResult.value == null) return null
  const unit = def.unit ? ` ${def.unit}` : ''
  return (
    <span className="bm-latest-value">
      {Number(latestResult.value).toLocaleString('en-GB', { maximumFractionDigits: 2 })}{unit}
    </span>
  )
}

function fmtDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function ResultsTable({ def, results }) {
  const subMarkerMap = SUB_MARKERS[def.key]

  if (subMarkerMap) {
    const latest = {}
    results.forEach(r => {
      if (r.sub_marker_key && !latest[r.sub_marker_key]) latest[r.sub_marker_key] = r
    })
    const subKeys = Object.keys(subMarkerMap)
    if (subKeys.every(k => !latest[k])) return null
    return (
      <table className="bm-results-table">
        <thead>
          <tr>
            <th>Marker</th>
            <th>Value</th>
            <th>Unit</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {subKeys.map(k => {
            const sub = subMarkerMap[k]
            const r   = latest[k]
            return (
              <tr key={k}>
                <td>{sub.name}</td>
                <td>{r ? (r.value_text || (r.value != null ? r.value : '—')) : '—'}</td>
                <td>{sub.unit}</td>
                <td>{r ? fmtDate(r.measured_date) : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }

  const hasNotes = results.some(r => r.notes)
  return (
    <table className="bm-results-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Value</th>
          {def.unit && <th>Unit</th>}
          {hasNotes && <th>Notes</th>}
        </tr>
      </thead>
      <tbody>
        {results.map(r => (
          <tr key={r.id}>
            <td>{fmtDate(r.measured_date)}</td>
            <td>
              {r.value_text ||
                (r.value != null
                  ? Number(r.value).toLocaleString('en-GB', { maximumFractionDigits: 2 })
                  : '—')}
            </td>
            {def.unit && <td>{def.unit}</td>}
            {hasNotes && <td>{r.notes || ''}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function CadenceBiomarkers() {
  const [defs,    setDefs   ] = useState([])
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})

  useEffect(() => {
    ;(async () => {
      const [d, r] = await Promise.all([
        db.loadBiomarkerDefinitions(),
        db.loadBiomarkerResults(),
      ])
      setDefs(d)
      setResults(r)
      setLoading(false)
    })()
  }, [])

  const resultsByKey = useMemo(() => {
    const map = {}
    results.forEach(r => {
      if (!map[r.biomarker_key]) map[r.biomarker_key] = []
      map[r.biomarker_key].push(r)
    })
    return map
  }, [results])

  const defsBySection = useMemo(() => {
    const map = {}
    SECTIONS.forEach(s => { map[s.key] = [] })
    defs.forEach(d => { if (map[d.section]) map[d.section].push(d) })
    return map
  }, [defs])

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
  })

  if (loading) {
    return (
      <main>
        <div className="bm-loading">Loading…</div>
      </main>
    )
  }

  return (
    <main>
      <header className="header r r-1">
        <h1 className="greeting">Biomarkers</h1>
        <span className="stamp">{today}</span>
      </header>

      {SECTIONS.map((section, si) => {
        const sectionDefs = defsBySection[section.key] || []
        if (sectionDefs.length === 0) return null
        return (
          <div key={section.key} className={`bm-section r r-${si + 2}`}>
            <div className="bm-section-eyebrow">{section.label}</div>
            <div className="bm-list">
              {sectionDefs.map(def => {
                const keyResults   = resultsByKey[def.key] || []
                const latestResult = keyResults[0] || null
                const status       = getStatus(def, latestResult)
                const nextDue      = getNextDue(def, latestResult)
                const isOpen       = !!expanded[def.key]
                const isQualitative = def.target_direction === 'qualitative'

                return (
                  <div key={def.key} className={`bm-row${isOpen ? ' bm-row--open' : ''}`}>
                    <button
                      type="button"
                      className="bm-row-header"
                      onClick={() => setExpanded(p => ({ ...p, [def.key]: !p[def.key] }))}
                      aria-expanded={isOpen}
                    >
                      <span className="bm-name">{def.name}</span>
                      <span className="bm-row-meta">
                        <LatestValue def={def} latestResult={latestResult} />
                        {status === 'no_data' ? (
                          <NoDataBadge />
                        ) : isQualitative ? null : (
                          <>
                            <StatusPill status={status} />
                            <DuePill status={status} />
                          </>
                        )}
                        {nextDue && status !== 'no_data' && !isQualitative && (
                          <span className={`bm-due${status === 'due' ? ' bm-due--overdue' : ''}`}>
                            {fmtDue(nextDue)}
                          </span>
                        )}
                      </span>
                      <svg
                        className={`bm-chevron${isOpen ? ' bm-chevron--open' : ''}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>

                    {isOpen && (
                      <div className="bm-row-body">
                        {def.explanation && (
                          <p className="bm-explanation">{def.explanation}</p>
                        )}
                        {isQualitative && latestResult && (
                          <p className="bm-logged-note">Status: logged</p>
                        )}
                        {def.protocol_notes && (
                          <div className="bm-protocol">
                            <span className="bm-protocol-label">Protocol</span>
                            {def.protocol_notes}
                          </div>
                        )}
                        {keyResults.length > 0 && (
                          <ResultsTable def={def} results={keyResults.slice(0, 3)} />
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </main>
  )
}
