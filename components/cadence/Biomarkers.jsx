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

const PILL_LABELS = {
  in_range:     'In range',
  out_of_range: 'Out of range',
  due:          'Due',
}

const PROVIDER_LABELS = {
  thriva:      'Thriva',
  medichecks:  'Medichecks',
  randox:      'Randox',
  nhs:         'NHS',
  other:       'Other',
}

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

const ADD_BLANK = { key: null, subKey: '', date: '', value: '', valueText: '', notes: '', docId: '', saving: false, error: null }

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
  const [addForm,   setAddForm  ] = useState(ADD_BLANK)
  const [fastState, setFastState] = useState({})

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

  function getFast(key) {
    return fastState[key] ?? { value: '', saving: false, error: null }
  }

  function handleMoreClick(key) {
    setExpanded(p => ({ ...p, [key]: true }))
    setAddForm({ ...ADD_BLANK, key, date: todayIso() })
  }

  async function handleFastSave(key) {
    const raw = getFast(key).value.trim()
    if (!raw) return
    const num = Number(raw)
    if (isNaN(num)) {
      setFastState(p => ({ ...p, [key]: { ...getFast(key), error: 'Value must be a number.' } }))
      return
    }
    setFastState(p => ({ ...p, [key]: { ...getFast(key), saving: true, error: null } }))
    try {
      await db.insertBiomarkerResult({
        biomarker_key:      key,
        sub_marker_key:     null,
        measured_date:      todayIso(),
        value:              num,
        value_text:         null,
        notes:              null,
        source_document_id: null,
      })
      const r = await db.loadBiomarkerResults()
      setResults(r)
      setFastState(p => ({ ...p, [key]: { value: '', saving: false, error: null } }))
    } catch (e) {
      setFastState(p => ({ ...p, [key]: { ...getFast(key), saving: false, error: e?.message || 'Save failed — please try again.' } }))
    }
  }

  async function handleSaveResult() {
    setAddForm(p => ({ ...p, saving: true, error: null }))
    try {
      const formDef    = defs.find(d => d.key === addForm.key) ?? null
      const formSubMap = formDef ? (SUB_MARKERS[formDef.key] ?? null) : null
      const formQual   = formDef?.target_direction === 'qualitative'
      await db.insertBiomarkerResult({
        biomarker_key:      addForm.key,
        sub_marker_key:     addForm.subKey  || null,
        measured_date:      addForm.date,
        value:              !(formQual && !formSubMap) && addForm.value !== '' ? addForm.value : null,
        value_text:         formQual && !formSubMap ? addForm.valueText : null,
        notes:              addForm.notes   || null,
        source_document_id: addForm.docId   || null,
      })
      const r = await db.loadBiomarkerResults()
      setResults(r)
      setAddForm(ADD_BLANK)
    } catch (e) {
      setAddForm(p => ({ ...p, saving: false, error: e?.message || 'Save failed — please try again.' }))
    }
  }

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
                const keyResults    = resultsByKey[def.key] || []
                const latestResult  = keyResults[0] || null
                const status        = getStatus(def, latestResult)
                const nextDue       = getNextDue(def, latestResult)
                const isOpen        = !!expanded[def.key]
                const isQualitative = def.target_direction === 'qualitative'
                const isFormOpen    = addForm.key === def.key
                const formSubMap    = SUB_MARKERS[def.key] ?? null
                const fastDisabled  = !!formSubMap || isQualitative
                const fastPlaceholder = formSubMap
                  ? 'Choose sub-marker via More…'
                  : isQualitative ? 'Use More… to enter a text result'
                  : ''
                const formValueReady = isQualitative && !formSubMap
                  ? addForm.valueText.trim() !== ''
                  : addForm.value.trim() !== ''
                const saveDisabled = !addForm.date || !formValueReady || (!!formSubMap && !addForm.subKey)

                function handleToggle() {
                  if (expanded[def.key] && addForm.key === def.key) setAddForm(ADD_BLANK)
                  setExpanded(p => ({ ...p, [def.key]: !p[def.key] }))
                }

                return (
                  <div key={def.key} className={`bm-row${isOpen ? ' bm-row--open' : ''}`}>
                    <div
                      className="bm-row-header"
                      role="button"
                      tabIndex={0}
                      onClick={handleToggle}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggle() } }}
                      aria-expanded={isOpen}
                    >
                      <span className="bm-name">{def.name}</span>

                      {section.key === 'quarterly' && (
                        <div
                          className="bm-fast-controls"
                          onClick={e => e.stopPropagation()}
                          onKeyDown={e => e.stopPropagation()}
                        >
                          <input
                            className={`bm-fast-input${fastDisabled ? ' bm-fast-input--disabled' : ''}`}
                            type="number"
                            step="any"
                            disabled={fastDisabled}
                            placeholder={fastPlaceholder}
                            value={getFast(def.key).value}
                            onChange={e => setFastState(p => ({ ...p, [def.key]: { ...getFast(def.key), value: e.target.value } }))}
                            onKeyDown={e => { if (e.key === 'Enter' && !fastDisabled) handleFastSave(def.key) }}
                          />
                          {!fastDisabled && <span className="bm-fast-unit">{def.unit}</span>}
                          {!fastDisabled && (
                            <button
                              type="button"
                              className="bm-fast-save"
                              disabled={!getFast(def.key).value.trim() || getFast(def.key).saving}
                              onClick={() => handleFastSave(def.key)}
                            >
                              {getFast(def.key).saving ? 'Saving…' : 'Save'}
                            </button>
                          )}
                          <button
                            type="button"
                            className="bm-more-link"
                            onClick={() => handleMoreClick(def.key)}
                          >
                            More…
                          </button>
                        </div>
                      )}

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
                    </div>

                    {getFast(def.key).error && (
                      <p className="bm-fast-error">{getFast(def.key).error}</p>
                    )}

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

                        {isFormOpen ? (
                          <div className="bm-inline-form">
                            <div className="bm-add-form">
                              {formSubMap && (
                                <div className="form-row">
                                  <label>Marker</label>
                                  <select
                                    value={addForm.subKey}
                                    onChange={e => setAddForm(p => ({ ...p, subKey: e.target.value, value: '' }))}
                                  >
                                    <option value="">— select —</option>
                                    {Object.entries(formSubMap).map(([k, sub]) => (
                                      <option key={k} value={k}>{sub.name} ({sub.unit})</option>
                                    ))}
                                  </select>
                                </div>
                              )}
                              <div className="form-row">
                                <label>Date</label>
                                <input
                                  type="date"
                                  value={addForm.date}
                                  onChange={e => setAddForm(p => ({ ...p, date: e.target.value }))}
                                />
                              </div>
                              {isQualitative && !formSubMap ? (
                                <div className="form-row">
                                  <label>Result summary</label>
                                  <textarea
                                    rows={2}
                                    value={addForm.valueText}
                                    onChange={e => setAddForm(p => ({ ...p, valueText: e.target.value }))}
                                  />
                                </div>
                              ) : (
                                <div className="form-row">
                                  <label>
                                    Value
                                    {formSubMap && addForm.subKey && formSubMap[addForm.subKey]
                                      ? ` (${formSubMap[addForm.subKey].unit})`
                                      : def.unit ? ` (${def.unit})` : ''}
                                  </label>
                                  <input
                                    type="number"
                                    step="any"
                                    value={addForm.value}
                                    onChange={e => setAddForm(p => ({ ...p, value: e.target.value }))}
                                  />
                                </div>
                              )}
                              <div className="form-row">
                                <label>Notes <span className="form-optional">(optional)</span></label>
                                <textarea
                                  rows={2}
                                  value={addForm.notes}
                                  onChange={e => setAddForm(p => ({ ...p, notes: e.target.value }))}
                                />
                              </div>
                              {documents.length > 0 && (
                                <div className="form-row">
                                  <label>Source document <span className="form-optional">(optional)</span></label>
                                  <select
                                    value={addForm.docId}
                                    onChange={e => setAddForm(p => ({ ...p, docId: e.target.value }))}
                                  >
                                    <option value="">No document</option>
                                    {documents.map(doc => (
                                      <option key={doc.id} value={doc.id}>
                                        {doc.file_name} · {doc.measured_date}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>
                            {addForm.error && <p className="bm-inline-form-error">{addForm.error}</p>}
                            <div className="bm-inline-form-actions">
                              <button type="button" className="btn btn-ghost" onClick={() => setAddForm(ADD_BLANK)}>Cancel</button>
                              <button
                                type="button"
                                className="btn btn-primary"
                                disabled={saveDisabled || addForm.saving}
                                onClick={handleSaveResult}
                              >
                                {addForm.saving ? 'Saving…' : 'Save result'}
                              </button>
                            </div>
                          </div>
                        ) : section.key !== 'quarterly' ? (
                          <button
                            type="button"
                            className="bm-add-btn"
                            onClick={() => handleMoreClick(def.key)}
                          >
                            + Add result
                          </button>
                        ) : null}
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
