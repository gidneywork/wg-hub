'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { localIso, startOfWeek } from './helpers'
import { listExercises, getExerciseByName } from '../../lib/exercises'
import { db } from '../../lib/db'
import { filterTodosForDate } from '../../lib/todos'
import CadenceDialog from './CadenceDialog'

// ── Date helpers ───────────────────────────────────────────────────────────────

const DAY_ABBR   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function weekRangeLabel(weekStartIso) {
  const start = new Date(weekStartIso + 'T00:00:00')
  const end   = new Date(start)
  end.setDate(start.getDate() + 6)
  return (
    `${DAY_ABBR[start.getDay()]} ${start.getDate()} — ` +
    `${DAY_ABBR[end.getDay()]} ${end.getDate()} ${MONTH_ABBR[end.getMonth()]} ${end.getFullYear()}`
  )
}

function shiftWeek(isoDate, delta) {
  const d = new Date(isoDate + 'T00:00:00')
  d.setDate(d.getDate() + delta * 7)
  return localIso(d)
}

function buildWeekDates(weekStartIso) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStartIso + 'T00:00:00')
    d.setDate(d.getDate() + i)
    return localIso(d)
  })
}

// ── Status pill ────────────────────────────────────────────────────────────────

function StatusPill({ status }) {
  return <span className={`planner-status-pill ${status}`}>{status}</span>
}

// ── Session detail (read-only) ─────────────────────────────────────────────────

function SessionDetail({ session, onStartSession, onSkip, onClose }) {
  return (
    <section className="planner-detail r r-3">
      <div className="planner-detail-head">
        <div className="planner-detail-head-left">
          <div className="planner-detail-title">{session.template_name}</div>
          {session.notes && (
            <div className="planner-detail-note">{session.notes}</div>
          )}
        </div>
        <div className="planner-detail-actions">
          {session.status === 'scheduled' && (
            <>
              <button type="button" className="btn btn-ghost" onClick={onSkip}>Skip</button>
              <button type="button" className="btn btn-primary" onClick={onStartSession}>
                Start session
              </button>
            </>
          )}
          {session.status === 'completed' && (
            <span className="planner-detail-status-text completed">Session completed.</span>
          )}
          {session.status === 'skipped' && (
            <span className="planner-detail-status-text skipped">Skipped.</span>
          )}
          <button
            type="button"
            className="planner-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>

      <ul className="planner-lifts-list">
        {(session.lifts || []).map((lift, i) => (
          <li key={i} className="planner-lift-row">
            <span className="planner-lift-name">{lift.exercise}</span>
            <span className="planner-lift-target">
              {lift.targetSets}×{lift.targetReps}
              {lift.targetWeight != null ? ` · ${lift.targetWeight}kg` : ''}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ── Template combobox (reused in editor) ───────────────────────────────────────

function ExerciseCombobox({ value, onChange, allLogs }) {
  const [query,       setQuery      ] = useState(value || '')
  const [dropOpen,    setDropOpen   ] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const comboRef = useRef(null)
  const inputRef = useRef(null)
  const listRef  = useRef(null)

  const dbExercises = useMemo(
    () => listExercises().filter(e => !e.cardio).map(e => e.name),
    []
  )

  const customExercises = useMemo(() => {
    const seen = new Set(listExercises().map(e => e.name.toLowerCase()))
    const out  = []
    Object.values(allLogs || {}).forEach(log => {
      ;(Array.isArray(log?.lifts) ? log.lifts : []).forEach(({ exercise }) => {
        if (!exercise) return
        const key = exercise.toLowerCase()
        if (!seen.has(key)) { seen.add(key); out.push(exercise) }
      })
    })
    return out
  }, [allLogs])

  const filteredList = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [
      ...dbExercises.filter(n => n.toLowerCase().includes(q)),
      ...customExercises.filter(n => !getExerciseByName(n) && n.toLowerCase().includes(q)),
    ]
  }, [query, dbExercises, customExercises])

  useEffect(() => { setHighlighted(filteredList.length > 0 ? 0 : -1) }, [filteredList])

  useEffect(() => {
    if (!dropOpen) return
    function down(e) {
      if (comboRef.current && !comboRef.current.contains(e.target)) setDropOpen(false)
    }
    document.addEventListener('mousedown', down)
    return () => document.removeEventListener('mousedown', down)
  }, [dropOpen])

  useEffect(() => {
    if (!listRef.current || highlighted < 0) return
    listRef.current.children[highlighted]?.scrollIntoView({ block: 'nearest' })
  }, [highlighted])

  function select(name) {
    setQuery(name)
    setDropOpen(false)
    setHighlighted(-1)
    onChange(name)
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!dropOpen) { setDropOpen(true); return }
      setHighlighted(i => Math.min(i + 1, filteredList.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (dropOpen && highlighted >= 0 && filteredList[highlighted]) select(filteredList[highlighted])
      else if (query.trim()) select(query.trim())
    } else if (e.key === 'Escape') {
      setDropOpen(false); setHighlighted(-1)
    }
  }

  return (
    <div className="planner-combo" ref={comboRef}>
      <input
        ref={inputRef}
        type="text"
        className="edit-input planner-combo-input"
        placeholder="Exercise"
        autoComplete="off"
        role="combobox"
        aria-expanded={dropOpen}
        aria-haspopup="listbox"
        aria-autocomplete="list"
        aria-activedescendant={highlighted >= 0 ? `pcombo-opt-${highlighted}` : undefined}
        value={query}
        onChange={e => { setQuery(e.target.value); setDropOpen(true); onChange(e.target.value) }}
        onFocus={() => setDropOpen(true)}
        onKeyDown={handleKeyDown}
      />
      {dropOpen && filteredList.length > 0 && (
        <ul ref={listRef} className="planner-combo-list" role="listbox" aria-label="Exercises">
          {filteredList.map((name, i) => (
            <li
              key={name}
              id={`pcombo-opt-${i}`}
              role="option"
              aria-selected={i === highlighted}
              className={`planner-combo-option${i === highlighted ? ' highlighted' : ''}`}
              onMouseDown={e => { e.preventDefault(); select(name) }}
              onMouseEnter={() => setHighlighted(i)}
            >
              {name}
            </li>
          ))}
        </ul>
      )}
      {dropOpen && filteredList.length === 0 && query.trim() && (
        <div className="planner-combo-empty">Enter to use as custom</div>
      )}
    </div>
  )
}

// ── Template editor ────────────────────────────────────────────────────────────

function TemplateEditor({ initial, onSave, onCancel, allLogs }) {
  const [name,  setName ] = useState(initial?.name  || '')
  const [notes, setNotes] = useState(initial?.notes || '')
  const [lifts, setLifts] = useState(
    initial?.lifts?.map(l => ({ ...l })) || []
  )

  function addLift() {
    setLifts(prev => [
      ...prev,
      { exercise: '', targetSets: 3, targetReps: 8, targetWeight: null },
    ])
  }

  function removeLift(idx) {
    setLifts(prev => prev.filter((_, i) => i !== idx))
  }

  function updateLift(idx, field, val) {
    setLifts(prev => prev.map((l, i) => i === idx ? { ...l, [field]: val } : l))
  }

  const canSave = name.trim().length > 0 && lifts.length > 0

  return (
    <div className="edit-form planner-editor-form">
      <div>
        <label className="edit-label" htmlFor="tpl-name">Name</label>
        <input
          id="tpl-name"
          type="text"
          className="edit-input"
          placeholder="Template name"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
        />
      </div>

      <div>
        <label className="edit-label" htmlFor="tpl-notes">Notes</label>
        <textarea
          id="tpl-notes"
          className="edit-textarea"
          placeholder="Add a note"
          rows={2}
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </div>

      <div>
        <label className="edit-label">Lifts</label>
        {lifts.length === 0 && (
          <div className="planner-editor-empty">No lifts yet. Add one below.</div>
        )}
        {lifts.map((lift, idx) => (
          <div key={idx} className="planner-editor-lift-row">
            <ExerciseCombobox
              value={lift.exercise}
              onChange={v => updateLift(idx, 'exercise', v)}
              allLogs={allLogs}
            />
            <input
              type="text"
              inputMode="numeric"
              className="edit-input planner-editor-num"
              placeholder="Sets"
              value={lift.targetSets || ''}
              onChange={e => updateLift(idx, 'targetSets', parseInt(e.target.value, 10) || '')}
              aria-label="Target sets"
            />
            <input
              type="text"
              inputMode="numeric"
              className="edit-input planner-editor-num"
              placeholder="Reps"
              value={lift.targetReps || ''}
              onChange={e => updateLift(idx, 'targetReps', parseInt(e.target.value, 10) || '')}
              aria-label="Target reps"
            />
            <input
              type="text"
              inputMode="decimal"
              className="edit-input planner-editor-num"
              placeholder="kg"
              value={lift.targetWeight ?? ''}
              onChange={e => updateLift(idx, 'targetWeight', e.target.value === '' ? null : parseFloat(e.target.value) || null)}
              aria-label="Target weight"
            />
            <button
              type="button"
              className="planner-editor-del"
              onClick={() => removeLift(idx)}
              aria-label="Remove lift"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        ))}
        <button type="button" className="planner-add-lift-btn" onClick={addLift}>
          + Add lift
        </button>
      </div>

      <div className="planner-editor-footer">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canSave}
          onClick={() => onSave({ name: name.trim(), notes: notes.trim() || null, lifts })}
        >
          Save
        </button>
      </div>
    </div>
  )
}

// ── Schedule modal ─────────────────────────────────────────────────────────────

function ScheduleModal({ date, onScheduled, onCancel, allLogs }) {
  const [templates,   setTemplates  ] = useState([])
  const [selected,    setSelected   ] = useState(null)
  const [loading,     setLoading    ] = useState(false)
  const [showEditor,  setShowEditor ] = useState(false)
  const [cloneSource, setCloneSource] = useState(null)

  useEffect(() => {
    db.listTemplates().then(setTemplates)
  }, [])

  const d = new Date(date + 'T00:00:00')
  const dateLabel = `${DAY_ABBR[d.getDay()]} ${d.getDate()} ${MONTH_ABBR[d.getMonth()]}`

  async function handleSchedule() {
    if (!selected) return
    setLoading(true)
    try {
      await db.scheduleSession({ scheduledDate: date, templateId: selected.id })
      onScheduled()
    } finally {
      setLoading(false)
    }
  }

  async function handleCopyTemplate(tpl) {
    setCloneSource(tpl)
    setShowEditor(true)
  }

  async function handleEditorSave(fields) {
    await db.createTemplate(fields)
    const updated = await db.listTemplates()
    setTemplates(updated)
    setShowEditor(false)
    setCloneSource(null)
  }

  const body = (
    <div className="planner-schedule-body">
      {templates.length === 0 && (
        <div className="planner-schedule-empty">No templates yet. Create one via Templates.</div>
      )}
      {templates.map(tpl => (
        <div
          key={tpl.id}
          className={`planner-schedule-row${selected?.id === tpl.id ? ' selected' : ''}`}
          onClick={() => setSelected(tpl)}
          role="option"
          aria-selected={selected?.id === tpl.id}
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(tpl) } }}
        >
          <div className="planner-schedule-row-left">
            <span className="planner-schedule-tpl-name">{tpl.name}</span>
            <span className="planner-schedule-tpl-count">
              {tpl.lifts?.length ?? 0} lift{tpl.lifts?.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="planner-schedule-row-right">
            {tpl.is_seed && <span className="planner-seed-pill">Seed</span>}
            <button
              type="button"
              className="planner-copy-btn"
              onClick={e => { e.stopPropagation(); handleCopyTemplate(tpl) }}
            >
              Copy template
            </button>
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <>
      <CadenceDialog
        open={!showEditor}
        title={`Schedule a session — ${dateLabel}`}
        body={body}
        confirmLabel={loading ? 'Scheduling…' : 'Schedule'}
        confirmClass="btn-primary"
        confirmDisabled={!selected || loading}
        cancelLabel="Cancel"
        onConfirm={handleSchedule}
        onCancel={onCancel}
        dialogClass="dialog-wide"
      />
      {showEditor && (
        <CadenceDialog
          open
          title="Copy template"
          body={
            <TemplateEditor
              initial={cloneSource ? { name: `${cloneSource.name} (copy)`, notes: cloneSource.notes, lifts: cloneSource.lifts } : null}
              onSave={handleEditorSave}
              onCancel={() => { setShowEditor(false); setCloneSource(null) }}
              allLogs={allLogs}
            />
          }
          confirmLabel={null}
          cancelLabel={null}
          onCancel={() => { setShowEditor(false); setCloneSource(null) }}
          dialogClass="dialog-extra-wide"
        />
      )}
    </>
  )
}

// ── Templates management modal ─────────────────────────────────────────────────

function TemplatesModal({ onClose, allLogs }) {
  const [templates,      setTemplates     ] = useState([])
  const [editorOpen,     setEditorOpen    ] = useState(false)
  const [editorInitial,  setEditorInitial ] = useState(null)
  const [editorTargetId, setEditorTargetId] = useState(null)
  const [confirmDelete,  setConfirmDelete ] = useState(null)

  async function reload() {
    const rows = await db.listTemplates()
    setTemplates(rows)
  }

  useEffect(() => { reload() }, [])

  function openCreate() {
    setEditorInitial(null)
    setEditorTargetId(null)
    setEditorOpen(true)
  }

  function openEdit(tpl) {
    setEditorInitial(tpl)
    setEditorTargetId(tpl.id)
    setEditorOpen(true)
  }

  async function handleEditorSave(fields) {
    if (editorTargetId) {
      await db.updateTemplate(editorTargetId, fields)
    } else {
      await db.createTemplate(fields)
    }
    await reload()
    setEditorOpen(false)
    setEditorTargetId(null)
    setEditorInitial(null)
  }

  async function handleDelete(id) {
    await db.deleteTemplate(id)
    await reload()
    setConfirmDelete(null)
  }

  const body = (
    <div className="planner-tpl-list">
      {templates.length === 0 && (
        <div className="planner-tpl-empty">No templates yet.</div>
      )}
      {templates.map(tpl => (
        <div key={tpl.id} className="planner-tpl-row">
          <div className="planner-tpl-row-left">
            <span className="planner-tpl-name">{tpl.name}</span>
            <span className="planner-tpl-meta">
              {tpl.lifts?.length ?? 0} lift{tpl.lifts?.length !== 1 ? 's' : ''}
            </span>
            {tpl.is_seed && <span className="planner-seed-pill">Seed</span>}
          </div>
          <div className="planner-tpl-row-right">
            {!tpl.is_seed && (
              <>
                <button type="button" className="planner-tpl-action" onClick={() => openEdit(tpl)}>Edit</button>
                <button
                  type="button"
                  className="planner-tpl-action danger"
                  onClick={() => setConfirmDelete(tpl)}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      ))}
      <button type="button" className="planner-new-tpl-btn" onClick={openCreate}>
        + New template
      </button>
    </div>
  )

  return (
    <>
      <CadenceDialog
        open={!editorOpen && !confirmDelete}
        title="Templates"
        body={body}
        confirmLabel="Close"
        confirmClass="btn-ghost"
        cancelLabel={null}
        onConfirm={onClose}
        onCancel={onClose}
        dialogClass="dialog-wide"
      />

      {editorOpen && (
        <CadenceDialog
          open
          title={editorTargetId ? 'Edit template' : 'New template'}
          body={
            <TemplateEditor
              initial={editorInitial}
              onSave={handleEditorSave}
              onCancel={() => { setEditorOpen(false); setEditorInitial(null); setEditorTargetId(null) }}
              allLogs={allLogs}
            />
          }
          confirmLabel={null}
          cancelLabel={null}
          onCancel={() => { setEditorOpen(false); setEditorInitial(null); setEditorTargetId(null) }}
          dialogClass="dialog-extra-wide"
        />
      )}

      {confirmDelete && (
        <CadenceDialog
          open
          title="Delete template"
          body={`Delete "${confirmDelete.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          confirmClass="btn-danger"
          cancelLabel="Cancel"
          onConfirm={() => handleDelete(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </>
  )
}

// ── Session execution form ─────────────────────────────────────────────────────

function SessionExecution({ session, logs, saveLog, onComplete, onCancel }) {
  const [rows, setRows] = useState(
    (session.lifts || []).map(l => ({
      exercise:    l.exercise,
      sets:        String(l.targetSets || 3),
      weight:      '',
      reps:        String(l.targetReps || ''),
      targetWeight: l.targetWeight,
    }))
  )
  const [sessionNotes, setSessionNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError ] = useState(null)

  function updateRow(idx, field, val) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r))
  }

  async function handleComplete() {
    const completedLifts = []
    for (const row of rows) {
      const sets   = parseInt(row.sets, 10)  || 1
      const weight = parseFloat(row.weight)  || 0
      const reps   = parseInt(row.reps, 10)  || 0
      for (let s = 0; s < sets; s++) {
        completedLifts.push({ exercise: row.exercise, weight, reps })
      }
    }

    setSaving(true)
    setError(null)
    try {
      // Mark session completed in DB
      await db.updateScheduledSession(session.id, {
        status:       'completed',
        completed_at: new Date().toISOString(),
        notes:        sessionNotes.trim() || null,
      })

      // Merge lifts into daily log via the shared saveLog callback
      const currentLog     = logs[session.scheduled_date] || {}
      const existingLifts  = Array.isArray(currentLog.lifts) ? currentLog.lifts : []
      const mergedLog      = { ...currentLog, lifts: [...existingLifts, ...completedLifts] }

      try {
        await saveLog(session.scheduled_date, mergedLog)
      } catch (logErr) {
        // Roll back the status update if the log write fails
        await db.updateScheduledSession(session.id, { status: 'scheduled', completed_at: null })
        throw logErr
      }

      onComplete()
    } catch (e) {
      setError('Something went wrong. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="planner-detail planner-exec r r-3">
      <div className="planner-detail-head">
        <div className="planner-exec-title">{session.template_name}</div>
        <button type="button" className="planner-close-btn" onClick={onCancel} aria-label="Cancel">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div className="planner-exec-grid">
        <div className="planner-exec-header-row">
          <span className="planner-exec-col-label">Exercise</span>
          <span className="planner-exec-col-label">Sets</span>
          <span className="planner-exec-col-label">Weight (kg)</span>
          <span className="planner-exec-col-label">Reps</span>
        </div>
        {rows.map((row, idx) => (
          <div key={idx} className="planner-exec-lift-row">
            <span className="planner-exec-lift-name">{row.exercise}</span>
            <input
              type="text"
              inputMode="numeric"
              className="planner-exec-input"
              value={row.sets}
              onChange={e => updateRow(idx, 'sets', e.target.value)}
              aria-label="Sets"
            />
            <input
              type="text"
              inputMode="decimal"
              className="planner-exec-input"
              placeholder={row.targetWeight != null ? String(row.targetWeight) : '—'}
              value={row.weight}
              onChange={e => updateRow(idx, 'weight', e.target.value)}
              aria-label="Weight"
            />
            <input
              type="text"
              inputMode="numeric"
              className="planner-exec-input"
              value={row.reps}
              onChange={e => updateRow(idx, 'reps', e.target.value)}
              aria-label="Reps"
            />
          </div>
        ))}
      </div>

      <div className="planner-exec-notes">
        <label className="planner-exec-notes-label" htmlFor="exec-notes">Session notes</label>
        <textarea
          id="exec-notes"
          className="planner-exec-notes-input"
          placeholder="Add a note"
          rows={2}
          value={sessionNotes}
          onChange={e => setSessionNotes(e.target.value)}
        />
      </div>

      {error && <div className="planner-exec-error">{error}</div>}

      <div className="planner-exec-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={handleComplete} disabled={saving}>
          {saving ? 'Saving…' : 'Complete session'}
        </button>
      </div>
    </section>
  )
}

// ── Todos ──────────────────────────────────────────────────────────────────────

const REPEAT_LABELS = { none: 'None', daily: 'Daily', weekday: 'Weekday', weekly: 'Weekly', monthly: 'Monthly' }

function AddTodoForm({ date, onSave, onCancel }) {
  const [title,  setTitle ] = useState('')
  const [repeat, setRepeat] = useState('none')
  const titleRef = useRef(null)

  useEffect(() => { titleRef.current?.focus() }, [])

  function handleSave() {
    const t = title.trim()
    if (!t) return
    const d      = new Date(date + 'T00:00:00')
    const jsDay  = d.getDay()
    const isoDay = jsDay === 0 ? 6 : jsDay - 1
    onSave({
      title: t,
      repeat_kind:         repeat,
      repeat_weekday:      repeat === 'weekly'  ? isoDay        : null,
      repeat_day_of_month: repeat === 'monthly' ? d.getDate()   : null,
      start_date:          date,
    })
  }

  return (
    <div className="todo-add-form">
      <input
        ref={titleRef}
        type="text"
        className="todo-add-input"
        placeholder="To-do title"
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSave(); else if (e.key === 'Escape') onCancel() }}
      />
      <div className="todo-add-repeat-row">
        <label className="todo-add-repeat-label">Repeat</label>
        <select
          className="todo-add-repeat-select"
          value={repeat}
          onChange={e => setRepeat(e.target.value)}
        >
          <option value="none">None</option>
          <option value="daily">Daily</option>
          <option value="weekday">Weekday</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>
      <div className="todo-add-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={!title.trim()}>Save</button>
      </div>
    </div>
  )
}

function TodoExpandedEdit({ todo, onSave, onDelete, onCollapse }) {
  const [title,      setTitle     ] = useState(todo.title)
  const [notes,      setNotes     ] = useState(todo.notes || '')
  const [repeat,     setRepeat    ] = useState(todo.repeat_kind)
  const [startDate,  setStartDate ] = useState(todo.start_date)
  const [endDate,    setEndDate   ] = useState(todo.end_date || '')
  const [confirmDel, setConfirmDel] = useState(false)

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCollapse() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onCollapse])

  const handleSave = () => onSave(todo.id, {
    title:       title.trim(),
    notes:       notes.trim() || null,
    repeat_kind: repeat,
    start_date:  startDate,
    end_date:    endDate || null,
  })

  return (
    <div className="todo-expand" onClick={e => e.stopPropagation()}>
      <div className="todo-expand-divider" />
      {confirmDel ? (
        <div className="todo-del-confirm">
          <p className="todo-del-warn">Delete this to-do? This cannot be undone.</p>
          <div className="todo-del-actions">
            <button type="button" className="btn btn-danger" onClick={() => onDelete(todo.id)}>Delete</button>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmDel(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="todo-edit-form">
          <div className="todo-edit-field">
            <label className="todo-edit-label">Title</label>
            <input
              type="text"
              className="todo-add-input"
              value={title}
              autoFocus
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
            />
          </div>
          <div className="todo-edit-field">
            <label className="todo-edit-label">Notes</label>
            <textarea
              className="todo-add-input"
              rows={2}
              value={notes}
              placeholder="Optional note"
              onChange={e => setNotes(e.target.value)}
            />
          </div>
          <div className="todo-add-repeat-row">
            <label className="todo-add-repeat-label">Repeat</label>
            <select className="todo-add-repeat-select" value={repeat} onChange={e => setRepeat(e.target.value)}>
              <option value="none">None</option>
              <option value="daily">Daily</option>
              <option value="weekday">Weekday</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div className="todo-edit-dates">
            <div className="todo-edit-date">
              <label className="todo-edit-label">Start</label>
              <input type="date" className="todo-add-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="todo-edit-date">
              <label className="todo-edit-label">End</label>
              <input type="date" className="todo-add-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="todo-edit-actions">
            <button type="button" className="todo-del-trigger" onClick={() => setConfirmDel(true)}>Delete</button>
            <div className="todo-edit-save-cancel">
              <button type="button" className="btn btn-ghost" onClick={onCollapse}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleSave} disabled={!title.trim()}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TodosSection({ weekStart, today }) {
  const [todos,          setTodos         ] = useState([])
  const [completions,    setCompletions   ] = useState([])
  const [addingDate,     setAddingDate    ] = useState(null)
  const [expandedTodoId, setExpandedTodoId] = useState(null)

  const weekDates = useMemo(() => buildWeekDates(weekStart), [weekStart])

  useEffect(() => {
    Promise.all([db.listTodos(), db.listTodoCompletions()]).then(([t, c]) => {
      setTodos(t)
      setCompletions(c)
    })
  }, [])

  // Visible dates: week dates that have todos + always today
  const visibleDates = useMemo(() => {
    const allDates = today && !weekDates.includes(today) ? [today, ...weekDates] : weekDates
    return [...new Set(allDates)].filter(date => {
      if (date === today) return true
      const { pending, completed } = filterTodosForDate(todos, completions, date)
      return pending.length > 0 || completed.length > 0
    }).sort()
  }, [weekDates, today, todos, completions])

  async function handleAdd(date, fields) {
    try {
      const newTodo = await db.createTodo(fields)
      setTodos(prev => [...prev, newTodo])
      setAddingDate(null)
    } catch (e) {
      console.error('createTodo failed:', e)
    }
  }

  async function handleComplete(todo, isoDate) {
    setCompletions(prev => [...prev, { todo_id: todo.id, completion_date: isoDate }])
    try {
      await db.completeTodo(todo.id, isoDate)
    } catch (e) {
      console.error('completeTodo failed:', e)
      setCompletions(prev => prev.filter(c => !(c.todo_id === todo.id && c.completion_date === isoDate)))
    }
  }

  async function handleUncomplete(todo, isoDate) {
    setCompletions(prev => prev.filter(c => !(c.todo_id === todo.id && c.completion_date === isoDate)))
    try {
      await db.uncompleteTodo(todo.id, isoDate)
    } catch (e) {
      console.error('uncompleteTodo failed:', e)
      setCompletions(prev => [...prev, { todo_id: todo.id, completion_date: isoDate }])
    }
  }

  async function handleEdit(todoId, fields) {
    const startD = new Date(fields.start_date + 'T00:00:00')
    const jsDay  = startD.getDay()
    const isoDay = jsDay === 0 ? 6 : jsDay - 1
    const updateFields = {
      ...fields,
      repeat_weekday:      fields.repeat_kind === 'weekly'  ? isoDay            : null,
      repeat_day_of_month: fields.repeat_kind === 'monthly' ? startD.getDate()  : null,
    }
    setTodos(prev => prev.map(t => t.id === todoId ? { ...t, ...updateFields } : t))
    setExpandedTodoId(null)
    try {
      await db.updateTodo(todoId, updateFields)
    } catch (e) {
      console.error('updateTodo failed:', e)
      db.listTodos().then(setTodos)
    }
  }

  async function handleDelete(todoId) {
    setTodos(prev => prev.filter(t => t.id !== todoId))
    setExpandedTodoId(null)
    try {
      await db.deleteTodo(todoId)
    } catch (e) {
      console.error('deleteTodo failed:', e)
      db.listTodos().then(setTodos)
    }
  }

  return (
    <section className="planner-todos r r-4">
      <div className="planner-todos-head">
        <span className="planner-todos-title">To-dos</span>
      </div>

      {visibleDates.map(date => {
        const { pending, completed } = filterTodosForDate(todos, completions, date)
        const d        = new Date(date + 'T00:00:00')
        const dayLabel = `${DAY_ABBR[d.getDay()]} ${d.getDate()} ${MONTH_ABBR[d.getMonth()]}${date === today ? ' · Today' : ''}`

        return (
          <div key={date} className="todo-day-group">
            <div className="todo-day-label">{dayLabel}</div>

            {pending.map(todo => {
              const isExpanded = expandedTodoId === todo.id
              return (
                <div key={todo.id} className={`todo-row${isExpanded ? ' expanded' : ''}`}>
                  <div
                    className="todo-row-head"
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpandedTodoId(isExpanded ? null : todo.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setExpandedTodoId(isExpanded ? null : todo.id)
                      }
                    }}
                  >
                    <button
                      type="button"
                      className="todo-check"
                      aria-label={`Complete: ${todo.title}`}
                      onClick={e => { e.stopPropagation(); handleComplete(todo, date) }}
                    />
                    <span className="todo-title">{todo.title}</span>
                    {todo.repeat_kind !== 'none' && (
                      <span className="todo-repeat-chip">{REPEAT_LABELS[todo.repeat_kind]}</span>
                    )}
                    <svg
                      className={`todo-chevron${isExpanded ? ' open' : ''}`}
                      width="12" height="12" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                  {isExpanded && (
                    <TodoExpandedEdit
                      todo={todo}
                      onSave={handleEdit}
                      onDelete={handleDelete}
                      onCollapse={() => setExpandedTodoId(null)}
                    />
                  )}
                </div>
              )
            })}

            {completed.map(todo => (
              <div key={todo.id} className="todo-row done">
                <div className="todo-row-head">
                  <button type="button" className="todo-check checked" aria-label={`Undo: ${todo.title}`} onClick={() => handleUncomplete(todo, date)} />
                  <span className="todo-title">{todo.title}</span>
                </div>
              </div>
            ))}

            {addingDate === date ? (
              <AddTodoForm
                date={date}
                onSave={fields => handleAdd(date, fields)}
                onCancel={() => setAddingDate(null)}
              />
            ) : (
              <button type="button" className="todo-add-trigger" onClick={() => setAddingDate(date)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                Add to-do
              </button>
            )}
          </div>
        )
      })}

    </section>
  )
}

// ── Event form (expand-in-place — mirrors TodoExpandedEdit) ────────────────────

function EventForm({ date, initial, onSave, onDelete, onCancel }) {
  const [title,      setTitle     ] = useState(initial?.title || '')
  const [notes,      setNotes     ] = useState(initial?.notes || '')
  const [allDay,     setAllDay    ] = useState(initial ? initial.all_day : true)
  const [startDate,  setStartDate ] = useState(initial?.start_date || date)
  const [endDate,    setEndDate   ] = useState(initial?.end_date || date)
  const [startTime,  setStartTime ] = useState(initial?.start_time?.slice(0, 5) || '')
  const [endTime,    setEndTime   ] = useState(initial?.end_time?.slice(0, 5) || '')
  const [confirmDel, setConfirmDel] = useState(false)

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onCancel])

  const canSave = title.trim().length > 0 && startDate && endDate && endDate >= startDate

  const handleSave = () => onSave({
    title:      title.trim(),
    notes:      notes.trim() || null,
    all_day:    allDay,
    start_date: startDate,
    end_date:   endDate || startDate,
    start_time: allDay ? null : (startTime || null),
    end_time:   allDay ? null : (endTime || null),
  })

  if (confirmDel) {
    return (
      <div className="event-form" onClick={e => e.stopPropagation()}>
        <div className="todo-del-confirm">
          <p className="todo-del-warn">Delete this event? This cannot be undone.</p>
          <div className="todo-del-actions">
            <button type="button" className="btn btn-danger" onClick={() => onDelete(initial.id)}>Delete</button>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmDel(false)}>Cancel</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="event-form" onClick={e => e.stopPropagation()}>
      <div className="event-form-field">
        <label className="todo-edit-label">Title</label>
        <input
          type="text"
          className="todo-add-input"
          value={title}
          autoFocus
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && canSave) handleSave() }}
        />
      </div>
      <div className="event-form-field">
        <label className="todo-edit-label">Notes</label>
        <textarea
          className="todo-add-input"
          rows={2}
          placeholder="Optional note"
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </div>
      <label className="event-form-allday">
        <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} />
        <span>All day</span>
      </label>
      <div className="event-form-dates">
        <div className="event-form-date">
          <label className="todo-edit-label">Start</label>
          <input type="date" className="todo-add-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div className="event-form-date">
          <label className="todo-edit-label">End</label>
          <input type="date" className="todo-add-input" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} />
        </div>
      </div>
      {!allDay && (
        <div className="event-form-dates">
          <div className="event-form-date">
            <label className="todo-edit-label">From</label>
            <input type="time" className="todo-add-input" value={startTime} onChange={e => setStartTime(e.target.value)} />
          </div>
          <div className="event-form-date">
            <label className="todo-edit-label">To</label>
            <input type="time" className="todo-add-input" value={endTime} onChange={e => setEndTime(e.target.value)} />
          </div>
        </div>
      )}
      <div className="event-form-actions">
        {initial
          ? <button type="button" className="todo-del-trigger" onClick={() => setConfirmDel(true)}>Delete</button>
          : <span />}
        <div className="event-form-save-cancel">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={!canSave} onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}

// ── Week strip day row (holiday + events · session · to-dos) ────────────────────

function DayRow({
  date, isToday, session, holidays, events, pending, completed,
  onScheduleSession, onOpenSession, onAddEvent, onEditEvent, onCompleteTodo, form,
}) {
  const d       = new Date(date + 'T00:00:00')
  const dayName = DAY_ABBR[d.getDay()]
  const dayNum  = d.getDate()
  const hasCal  = holidays.length > 0 || events.length > 0
  const hasTodos = pending.length > 0 || completed.length > 0

  return (
    <div className={`planner-day-row${isToday ? ' today' : ''}`}>
      <div className="planner-day-gutter">
        <span className="planner-day-row-name">{dayName}</span>
        <span className="planner-day-row-num">{dayNum}</span>
        {isToday && <span className="planner-day-row-today">Today</span>}
      </div>

      <div className="planner-day-content">
        {!form && (
          <button type="button" className="cal-add" onClick={onAddEvent}>+ add</button>
        )}

        {hasCal && (
          <div className="planner-band">
            {holidays.map((title, i) => (
              <span key={`h${i}`} className="cal-holiday" title={title}>{title}</span>
            ))}
            {events.map(ev => (
              <button key={ev.id} type="button" className="cal-event" onClick={() => onEditEvent(ev)}>
                {!ev.all_day && ev.start_time && (
                  <span className="cal-event-time">{ev.start_time.slice(0, 5)}</span>
                )}
                <span className="cal-event-title">{ev.title}</span>
              </button>
            ))}
          </div>
        )}

        <div className="planner-band">
          {session ? (
            <button type="button" className="cal-session" onClick={onOpenSession}>
              <span className="cal-session-name">{session.template_name}</span>
              <span className="cal-session-meta">
                {session.lifts?.length ?? 0} exercise{session.lifts?.length !== 1 ? 's' : ''}
              </span>
              <StatusPill status={session.status} />
            </button>
          ) : (
            <button type="button" className="cal-session-add" onClick={onScheduleSession}>
              + Schedule session
            </button>
          )}
        </div>

        {hasTodos && (
          <div className="planner-band">
            {pending.map(todo => (
              <span key={todo.id} className="cal-todo">
                <button
                  type="button"
                  className="todo-check"
                  aria-label={`Complete: ${todo.title}`}
                  onClick={() => onCompleteTodo(todo)}
                />
                <span className="cal-todo-title">{todo.title}</span>
              </span>
            ))}
            {completed.map(todo => (
              <span key={todo.id} className="cal-todo done">
                <span className="todo-check checked" aria-hidden="true" />
                <span className="cal-todo-title">{todo.title}</span>
              </span>
            ))}
          </div>
        )}

        {form}
      </div>
    </div>
  )
}

// ── Week strip (events + to-dos glance + holidays over the shipped sessions) ────

function WeekStrip({ weekStart, today, sessions, holidaysByDate, onEmptyDay, onSessionDay }) {
  const [events,      setEvents     ] = useState([])
  const [todos,       setTodos      ] = useState([])
  const [completions, setCompletions] = useState([])
  const [eventForm,   setEventForm  ] = useState(null) // { date, event }

  const dates    = useMemo(() => buildWeekDates(weekStart), [weekStart])
  const startIso = dates[0]
  const endIso   = dates[6]

  const refreshEvents = useCallback(async () => {
    setEvents(await db.loadEventsInRange(startIso, endIso))
  }, [startIso, endIso])

  useEffect(() => { refreshEvents() }, [refreshEvents])

  useEffect(() => {
    Promise.all([db.listTodos(), db.listTodoCompletions()]).then(([t, c]) => {
      setTodos(t)
      setCompletions(c)
    })
  }, [])

  // Events overlapping each date (single- and multi-day, via the range).
  const eventsByDate = useMemo(() => {
    const map = {}
    dates.forEach(d => { map[d] = [] })
    events.forEach(ev => {
      dates.forEach(d => { if (ev.start_date <= d && ev.end_date >= d) map[d].push(ev) })
    })
    return map
  }, [events, dates])

  async function handleCompleteTodo(todo, date) {
    setCompletions(prev => [...prev, { todo_id: todo.id, completion_date: date }])
    try {
      await db.completeTodo(todo.id, date)
    } catch (e) {
      console.error('completeTodo failed:', e)
      setCompletions(prev => prev.filter(c => !(c.todo_id === todo.id && c.completion_date === date)))
    }
  }

  async function handleSaveEvent(fields) {
    try {
      if (eventForm?.event) await db.updateEvent(eventForm.event.id, fields)
      else                  await db.createEvent(fields)
      setEventForm(null)
      await refreshEvents()
    } catch (e) {
      console.error('save event failed:', e)
    }
  }

  async function handleDeleteEvent(id) {
    try {
      await db.deleteEvent(id)
      setEventForm(null)
      await refreshEvents()
    } catch (e) {
      console.error('delete event failed:', e)
    }
  }

  return (
    <section className="planner-week-strip r r-2">
      {dates.map(date => {
        const session   = sessions.find(s => s.scheduled_date === date) ?? null
        const holidays  = holidaysByDate[date] || []
        const dayEvents = eventsByDate[date] || []
        const { pending, completed } = filterTodosForDate(todos, completions, date)
        const formHere  = eventForm && eventForm.date === date
        return (
          <DayRow
            key={date}
            date={date}
            isToday={date === today}
            session={session}
            holidays={holidays}
            events={dayEvents}
            pending={pending}
            completed={completed}
            onScheduleSession={() => onEmptyDay(date)}
            onOpenSession={() => onSessionDay(date)}
            onAddEvent={() => setEventForm({ date, event: null })}
            onEditEvent={ev => setEventForm({ date, event: ev })}
            onCompleteTodo={todo => handleCompleteTodo(todo, date)}
            form={formHere ? (
              <EventForm
                date={date}
                initial={eventForm.event}
                onSave={handleSaveEvent}
                onDelete={handleDeleteEvent}
                onCancel={() => setEventForm(null)}
              />
            ) : null}
          />
        )
      })}
    </section>
  )
}

// ── Planner (root) ─────────────────────────────────────────────────────────────

export default function Planner({ logs, saveLog }) {
  const [weekStart,        setWeekStart       ] = useState(() => localIso(startOfWeek()))
  const [sessions,         setSessions        ] = useState([])
  const [expandedDate,     setExpandedDate    ] = useState(null)
  const [scheduleModalDate,setScheduleModalDate] = useState(null)
  const [templatesModal,   setTemplatesModal  ] = useState(false)
  const [executingSession, setExecutingSession] = useState(null)
  const [holidaysByDate,   setHolidaysByDate  ] = useState({})

  const dates   = buildWeekDates(weekStart)
  const endDate = dates[6]
  const today   = localIso()

  const refreshSessions = useCallback(async () => {
    const rows = await db.listScheduledSessions(weekStart, endDate)
    setSessions(rows)
  }, [weekStart, endDate])

  useEffect(() => { refreshSessions() }, [refreshSessions])

  // UK public holidays — fetched once, keyed by date. Degrades to none.
  useEffect(() => {
    fetch('/api/holidays')
      .then(r => r.json())
      .then(({ events }) => {
        const map = {}
        ;(events || []).forEach(h => { (map[h.date] ||= []).push(h.title) })
        setHolidaysByDate(map)
      })
      .catch(() => setHolidaysByDate({}))
  }, [])

  function prevWeek() {
    setWeekStart(w => shiftWeek(w, -1))
    setExpandedDate(null)
    setExecutingSession(null)
  }
  function nextWeek() {
    setWeekStart(w => shiftWeek(w, +1))
    setExpandedDate(null)
    setExecutingSession(null)
  }

  function handleEmptyDay(date) {
    setScheduleModalDate(date)
    setExpandedDate(null)
    setExecutingSession(null)
  }

  function handleSessionDay(date) {
    setExecutingSession(null)
    setExpandedDate(prev => prev === date ? null : date)
  }

  async function handleSkip(session) {
    await db.updateScheduledSession(session.id, { status: 'skipped' })
    await refreshSessions()
    setExpandedDate(null)
  }

  async function handleScheduled() {
    setScheduleModalDate(null)
    await refreshSessions()
  }

  async function handleSessionComplete() {
    setExecutingSession(null)
    setExpandedDate(null)
    await refreshSessions()
  }

  const expandedSession = expandedDate
    ? sessions.find(s => s.scheduled_date === expandedDate) ?? null
    : null

  return (
    <div className="planner-page">

      {/* r-1 — header */}
      <header className="planner-header r r-1">
        <h1 className="planner-title">Planner</h1>
        <span className="planner-week-range">{weekRangeLabel(weekStart)}</span>
        <div className="planner-nav-controls">
          <button type="button" className="planner-nav-btn" onClick={prevWeek} aria-label="Previous week">‹</button>
          <button type="button" className="planner-nav-btn" onClick={nextWeek} aria-label="Next week">›</button>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => setTemplatesModal(true)}>
          Templates
        </button>
      </header>

      {/* r-2 — week strip */}
      <WeekStrip
        weekStart={weekStart}
        today={today}
        sessions={sessions}
        holidaysByDate={holidaysByDate}
        onEmptyDay={handleEmptyDay}
        onSessionDay={handleSessionDay}
      />

      {/* r-3 — expanded detail or execution form */}
      {executingSession ? (
        <SessionExecution
          session={executingSession}
          logs={logs}
          saveLog={saveLog}
          onComplete={handleSessionComplete}
          onCancel={() => setExecutingSession(null)}
        />
      ) : expandedSession ? (
        <SessionDetail
          session={expandedSession}
          onStartSession={() => setExecutingSession(expandedSession)}
          onSkip={() => handleSkip(expandedSession)}
          onClose={() => setExpandedDate(null)}
        />
      ) : null}

      {/* r-4 — to-dos */}
      <TodosSection weekStart={weekStart} today={today} />

      {/* Schedule modal */}
      {scheduleModalDate && (
        <ScheduleModal
          date={scheduleModalDate}
          onScheduled={handleScheduled}
          onCancel={() => setScheduleModalDate(null)}
          allLogs={logs}
        />
      )}

      {/* Templates modal */}
      {templatesModal && (
        <TemplatesModal
          onClose={() => setTemplatesModal(false)}
          allLogs={logs}
        />
      )}

    </div>
  )
}
