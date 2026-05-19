'use client'

import { useState, useEffect } from 'react'
import './training.css'

function isoWeek(d = new Date()) {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7)
  const jan4 = new Date(date.getFullYear(), 0, 4)
  return 1 + Math.round(((date - jan4) / 86400000 - 3 + (jan4.getDay() + 6) % 7) / 7)
}

const TYPE_LABEL = {
  run: 'Running', swim: 'Swimming', cycle: 'Cycling', hike: 'Hiking',
  gym: 'Gym', strength: 'Strength', functional: 'Functional',
  yoga: 'Yoga', stretch: 'Stretching', rest: 'Rest day', custom: 'Custom',
}

function pipClass(type) {
  if (['run', 'swim', 'cycle', 'hike'].includes(type)) return 't-run'
  if (['gym', 'strength'].includes(type)) return 't-gym'
  if (type === 'functional') return 't-functional'
  if (['yoga', 'stretch'].includes(type)) return 't-yoga'
  return 't-rest'
}

function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }

const SESSION_TYPES = [
  { key: 'run',        label: 'Running' },
  { key: 'functional', label: 'Functional' },
  { key: 'gym',        label: 'Gym' },
  { key: 'yoga',       label: 'Yoga' },
  { key: 'rest',       label: 'Rest day' },
  { key: 'swim',       label: 'Swimming' },
  { key: 'cycle',      label: 'Cycling' },
  { key: 'hike',       label: 'Hiking' },
  { key: 'stretch',    label: 'Stretching' },
  { key: 'custom',     label: 'Custom' },
]

function EditDay({ day, di, updateSession, deleteSession, addSession, moveSession }) {
  const [addOpen,    setAddOpen]    = useState(false)
  const [newType,    setNewType]    = useState('run')
  const [newDetails, setNewDetails] = useState('')

  const handleAdd = () => {
    if (!newDetails.trim()) return
    addSession(di, newType, newDetails)
    setNewDetails('')
    setNewType('run')
    setAddOpen(false)
  }

  return (
    <div className="t-edit-day">
      <div className="t-edit-day-head">
        <span className="t-edit-day-name">{day.short}</span>
        <span className="t-edit-day-full">{day.day}</span>
      </div>
      <div className="t-edit-day-body">
        {day.sessions.length === 0 && (
          <p className="t-empty">No sessions — add one below</p>
        )}
        {day.sessions.map((s, si) => (
          <div key={s.id} className="t-session-row">
            <div className="t-session-type">
              <div className="t-field-label">Type</div>
              <select
                value={s.type}
                onChange={e => updateSession(di, s.id, 'type', e.target.value)}
                className="t-select"
              >
                {SESSION_TYPES.map(t => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="t-session-details">
              <div className="t-field-label">
                Details {s.type === 'functional' && <span className="t-hint">one exercise per line</span>}
              </div>
              {s.type === 'functional' ? (
                <textarea
                  value={s.details}
                  onChange={e => updateSession(di, s.id, 'details', e.target.value)}
                  className="t-textarea"
                  rows={4}
                />
              ) : (
                <input
                  type="text"
                  value={s.details}
                  onChange={e => updateSession(di, s.id, 'details', e.target.value)}
                  placeholder={`${TYPE_LABEL[s.type] || 'Session'} details…`}
                  className="t-input"
                />
              )}
            </div>
            <div className="t-session-controls">
              <button
                type="button"
                onClick={() => moveSession(di, s.id, -1)}
                disabled={si === 0}
                className="t-ctrl"
                aria-label="Move up"
              >▲</button>
              <button
                type="button"
                onClick={() => moveSession(di, s.id, 1)}
                disabled={si === day.sessions.length - 1}
                className="t-ctrl"
                aria-label="Move down"
              >▼</button>
              <button
                type="button"
                onClick={() => deleteSession(di, s.id)}
                className="t-ctrl t-ctrl-delete"
                aria-label="Remove session"
              >✕</button>
            </div>
          </div>
        ))}

        {addOpen ? (
          <div className="t-add-form">
            <div className="t-add-head">New session</div>
            <div className="t-add-row">
              <div className="t-session-type">
                <div className="t-field-label">Type</div>
                <select value={newType} onChange={e => setNewType(e.target.value)} className="t-select">
                  {SESSION_TYPES.map(t => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="t-session-details">
                <div className="t-field-label">Details</div>
                {newType === 'functional' ? (
                  <textarea
                    value={newDetails}
                    onChange={e => setNewDetails(e.target.value)}
                    placeholder={'100 Pull Ups\n200 Press Ups'}
                    className="t-textarea"
                    rows={3}
                  />
                ) : (
                  <input
                    type="text"
                    value={newDetails}
                    onChange={e => setNewDetails(e.target.value)}
                    placeholder={`${TYPE_LABEL[newType] || 'Session'} details…`}
                    className="t-input"
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                  />
                )}
              </div>
            </div>
            <div className="t-add-actions">
              <button
                type="button"
                onClick={handleAdd}
                disabled={!newDetails.trim()}
                className="t-btn-primary"
              >Add session</button>
              <button
                type="button"
                onClick={() => { setAddOpen(false); setNewDetails(''); setNewType('run') }}
                className="t-btn-ghost"
              >Cancel</button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="t-add-trigger"
          >+ Add session to {day.day.toLowerCase()}</button>
        )}
      </div>
    </div>
  )
}

function shortTitle(details, type) {
  const fallback = TYPE_LABEL[type] || 'Session'
  if (!details) return fallback
  const first = String(details).split(/\n/)[0].trim()
  const s = first.replace(/^\d+(?:[:.]\d+)?(?:[–-]\d+)?\s*(?:hr|hrs|h|min|m)\b\s*/i, '').trim()
  const c = s || first
  return c.length <= 28 ? c : c.slice(0, 26).replace(/\s+\S*$/, '') + '…'
}

export default function Training({ plan, savePlan, settings, getDefaultPlan }) {
  const [editing,   setEditing]   = useState(false)
  const [expanded,  setExpanded]  = useState(null)
  const [localPlan, setLocalPlan] = useState(plan)
  const [saveFlash, setSaveFlash] = useState(false)

  useEffect(() => { setLocalPlan(plan) }, [plan])

  if (!plan) return null

  const wk = isoWeek()
  const todayName   = new Date().toLocaleDateString('en-US', { weekday: 'long' })
  const displayPlan = editing ? localPlan : plan

  const updateSession = (di, id, field, val) =>
    setLocalPlan(p => p.map((day, i) =>
      i !== di ? day : { ...day, sessions: day.sessions.map(s => s.id !== id ? s : { ...s, [field]: val }) }
    ))
  const deleteSession = (di, id) =>
    setLocalPlan(p => p.map((day, i) =>
      i !== di ? day : { ...day, sessions: day.sessions.filter(s => s.id !== id) }
    ))
  const addSession = (di, type, details) => {
    if (!details.trim()) return
    setLocalPlan(p => p.map((day, i) =>
      i !== di ? day : { ...day, sessions: [...day.sessions, { id: uid(), type, details }] }
    ))
  }
  const moveSession = (di, id, dir) =>
    setLocalPlan(p => p.map((day, i) => {
      if (i !== di) return day
      const idx = day.sessions.findIndex(s => s.id === id)
      const ni  = idx + dir
      if (ni < 0 || ni >= day.sessions.length) return day
      const arr = [...day.sessions]
      ;[arr[idx], arr[ni]] = [arr[ni], arr[idx]]
      return { ...day, sessions: arr }
    }))

  const handleSave = async () => {
    await savePlan(localPlan)
    setEditing(false)
    setSaveFlash(true)
    setTimeout(() => setSaveFlash(false), 2500)
  }
  const handleCancel = () => { setLocalPlan(plan); setEditing(false) }
  const handleReset  = async () => {
    if (!getDefaultPlan) return
    const d = getDefaultPlan()
    setLocalPlan(d)
    await savePlan(d)
    setEditing(false)
  }

  const kmTarget     = parseFloat(settings?.weeklyKm?.value) || null
  const funcCount    = plan.filter(d => d.sessions.some(s => s.type === 'functional')).length
  const gymTypes     = [...new Set(
    plan.flatMap(d => d.sessions.filter(s => s.type === 'gym').map(s =>
      s.details.split('–')[0].split('/')[0].trim()
    ))
  )].length
  const yogaCount    = plan.filter(d => d.sessions.some(s => s.type === 'yoga')).length
  const sessionTotal = plan.reduce((n, day) => n + day.sessions.length, 0)

  return (
    <>
      <header className="training-header r r-1">
        <div className="training-title">
          <h1>Training plan</h1>
          <span className="training-week">WK {wk}</span>
        </div>
        <div className="training-actions">
          {editing ? (
            <>
              <button type="button" onClick={handleReset} className="t-btn-ghost t-btn-danger">Reset default</button>
              <button type="button" onClick={handleCancel} className="t-btn-ghost">Cancel</button>
              <button type="button" onClick={handleSave} className="t-btn-primary">Save plan</button>
            </>
          ) : (
            <button type="button" onClick={() => setEditing(true)} className="t-btn-ghost">Edit plan</button>
          )}
        </div>
      </header>

      {saveFlash && <div className="training-saved">Plan saved</div>}

      <div className="stat-row r r-2">
        <div className="stat">
          <div className="label">Distance</div>
          <div className="value">
            {kmTarget != null ? `~${kmTarget}` : '—'}
            {kmTarget != null && <span className="unit">km</span>}
          </div>
          <div className="helper">weekly target</div>
        </div>
        <div className="stat">
          <div className="label">Functional</div>
          <div className="value">{funcCount}</div>
          <div className="helper">sessions this week</div>
        </div>
        <div className="stat">
          <div className="label">Gym types</div>
          <div className="value">{gymTypes}</div>
          <div className="helper">types in plan</div>
        </div>
        <div className="stat">
          <div className="label">Yoga</div>
          <div className="value">{yogaCount}</div>
          <div className="helper">days this week</div>
        </div>
        <div className="stat">
          <div className="label">Sessions</div>
          <div className="value">{sessionTotal}</div>
          <div className="helper">in plan this week</div>
        </div>
      </div>

      <section className="section training-plan r r-3">
        <div className="section-head">
          <h2>{editing ? 'Edit weekly plan' : `Weekly plan · WK ${wk}`}</h2>
          {!editing && (
            <div className="right">
              <button type="button" className="link" onClick={() => setEditing(true)}>Edit plan →</button>
            </div>
          )}
        </div>

        {editing ? (
          <div className="t-edit-list">
            {localPlan.map((day, di) => (
              <EditDay
                key={day.day}
                day={day}
                di={di}
                updateSession={updateSession}
                deleteSession={deleteSession}
                addSession={addSession}
                moveSession={moveSession}
              />
            ))}
          </div>
        ) : (
        <div className="week-grid">
          {displayPlan.map(day => {
            const isToday  = day.day === todayName
            const isOpen   = expanded === day.day
            const primary  = day.sessions[0]
            const isRest   = primary?.type === 'rest'

            return (
              <div
                key={day.day}
                className={`day${isToday ? ' today' : ''}${isRest ? ' rest' : ''}`}
                onClick={() => setExpanded(isOpen ? null : day.day)}
                role="button"
                tabIndex={0}
                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setExpanded(isOpen ? null : day.day)}
              >
                <div className="day-head">
                  <span className="day-name">{day.short}</span>
                  <span className="day-num">{day.sessions.length}</span>
                </div>
                <div className="day-session">
                  {primary ? shortTitle(primary.details, primary.type) : 'Free day'}
                </div>
                {isOpen ? (
                  <div className="t-day-sessions">
                    {day.sessions.map(s => (
                      <div key={s.id} className="t-day-session" data-type={s.type}>
                        <div className="t-day-session-type">{TYPE_LABEL[s.type] || 'Session'}</div>
                        <div className="t-day-session-body">
                          {String(s.details || '').split('\n').filter(Boolean).map((line, li) => (
                            <div key={li}>{line}</div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="day-meta">
                    {day.sessions.map(s => (
                      <span key={s.id} className={`pip ${pipClass(s.type)}`} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        )}
      </section>
    </>
  )
}
