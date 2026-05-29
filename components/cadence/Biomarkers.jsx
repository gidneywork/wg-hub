'use client'

import { useState, useEffect, useMemo } from 'react'
import { db } from '../../lib/db'
import { supabase } from '../../lib/supabase'
import { SUB_MARKERS, getStatus, getNextDue, fmtDue } from '../../lib/biomarkers'

const SECTIONS = [
  { key: 'quarterly', label: 'Quarterly' },
  { key: 'annual',    label: 'Annual'    },
  { key: 'one_time',  label: 'One-time'  },
]

const PROVIDER_LABELS = {
  thriva:      'Thriva',
  medichecks:  'Medichecks',
  randox:      'Randox',
  nhs:         'NHS',
  other:       'Other',
}

function fmtCalendarStatus(status, nextDue, isQualitative) {
  if (isQualitative) return null
  if (status === 'no_data') return 'No data'
  if (!nextDue) return null
  return fmtDue(nextDue)
}

function LatestValue({ def, latestResult, isOutOfRange }) {
  if (!latestResult) return null
  if (def.target_direction === 'qualitative') {
    if (!latestResult.value_text) return null
    return <span className="bm-latest-value">{latestResult.value_text}</span>
  }
  if (latestResult.value == null) return null
  const unit = def.unit ? ` ${def.unit}` : ''
  return (
    <span className={`bm-latest-value${isOutOfRange ? ' bm-latest-value--out' : ''}`}>
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

function CadenceToggle({ def, latestResult, onToggle }) {
  if (!def.default_cadence_months || !latestResult) return null
  const effective = latestResult.cadence_override_months ?? def.default_cadence_months
  return (
    <div className="bm-cadence-toggle">
      <span className="bm-cadence-label">Cadence</span>
      <button
        type="button"
        className={`bm-cadence-chip${effective === 3 ? ' active' : ''}`}
        onClick={() => onToggle(null)}
      >3 mo</button>
      <button
        type="button"
        className={`bm-cadence-chip${effective === 6 ? ' active' : ''}`}
        onClick={() => onToggle(6)}
      >6 mo</button>
    </div>
  )
}

export default function CadenceBiomarkers() {
  const [defs,      setDefs     ] = useState([])
  const [results,   setResults  ] = useState([])
  const [documents, setDocuments] = useState([])
  const [loading,   setLoading  ] = useState(true)
  const [expanded,  setExpanded ] = useState({})

  useEffect(() => {
    ;(async () => {
      const [d, r, docs] = await Promise.all([
        db.loadBiomarkerDefinitions(),
        db.loadBiomarkerResults(),
        db.loadBiomarkerDocuments(),
      ])
      setDefs(d)
      setResults(r)
      setDocuments(docs)
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

  async function handleCadenceToggle(latestResult, months) {
    try {
      await db.updateBiomarkerResultCadence(latestResult.id, months)
      const r = await db.loadBiomarkerResults()
      setResults(r)
    } catch {
      // error already logged by db helper
    }
  }

  async function openDocument(doc) {
    const { data, error } = await supabase.storage
      .from('biomarker-documents')
      .createSignedUrl(doc.file_url, 3600)
    if (!error && data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener')
  }

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
                const keyResults     = resultsByKey[def.key] || []
                const latestResult   = keyResults[0] || null
                const status         = getStatus(def, latestResult)
                const nextDue        = getNextDue(def, latestResult)
                const isOpen         = !!expanded[def.key]
                const isQualitative  = def.target_direction === 'qualitative'
                const subMarkerMap   = SUB_MARKERS[def.key] ?? null
                const calendarStatus = fmtCalendarStatus(status, nextDue, isQualitative)

                const subSummary = subMarkerMap
                  ? Object.entries(subMarkerMap).map(([k, sub]) => {
                      const r = keyResults.find(x => x.sub_marker_key === k)
                      const val = r && r.value != null
                        ? `${Number(r.value).toLocaleString('en-GB', { maximumFractionDigits: 2 })} ${sub.unit}`
                        : '(no data)'
                      return `${sub.name}: ${val}`
                    }).join(' · ')
                  : null

                return (
                  <div key={def.key} className={`bm-row${isOpen ? ' bm-row--open' : ''}`}>
                    <div
                      className="bm-row-header"
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpanded(p => ({ ...p, [def.key]: !p[def.key] }))}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(p => ({ ...p, [def.key]: !p[def.key] })) } }}
                      aria-expanded={isOpen}
                    >
                      <div className="bm-row-left">
                        <span className="bm-name">{def.name}</span>
                        {calendarStatus && (
                          <span className={`bm-calendar-pill${status === 'due' ? ' bm-calendar-pill--overdue' : ''}`}>
                            {calendarStatus}
                          </span>
                        )}
                      </div>

                      {!subMarkerMap && (
                        <LatestValue
                          def={def}
                          latestResult={latestResult}
                          isOutOfRange={status === 'out_of_range'}
                        />
                      )}

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
                    </div>

                    {subSummary && <p className="bm-sub-summary">{subSummary}</p>}

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
                        <CadenceToggle
                          def={def}
                          latestResult={latestResult}
                          onToggle={months => handleCadenceToggle(latestResult, months)}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <div className="bm-section r r-5">
        <div className="bm-section-eyebrow">Reports</div>
        <div className="bm-docs-list">
          {documents.length === 0 ? (
            <p className="bm-docs-empty">No reports uploaded yet.</p>
          ) : (
            documents.map(doc => {
              const providerLabel = doc.provider === 'other'
                ? (doc.provider_other_text || 'Other')
                : (PROVIDER_LABELS[doc.provider] || doc.provider)
              return (
                <div key={doc.id} className="bm-doc-row">
                  <div className="bm-doc-meta">
                    <span className="bm-doc-provider">{providerLabel}</span>
                    <span className="bm-doc-date">{fmtDate(doc.measured_date)}</span>
                  </div>
                  <button
                    type="button"
                    className="bm-doc-file"
                    onClick={() => openDocument(doc)}
                  >
                    {doc.file_name}
                  </button>
                  {doc.notes && <p className="bm-doc-notes">{doc.notes}</p>}
                </div>
              )
            })
          )}
        </div>
      </div>
    </main>
  )
}
