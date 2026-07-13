'use client'

import { useState, useEffect } from 'react'
import './training.css'
import { getCurrentWeek, getPlanPosition, resolveWeek, buildEmptyWeek } from '../../lib/plan'

const TYPE_LABEL = {
  run: 'Running', swim: 'Swimming', cycle: 'Cycling', hike: 'Hiking',
  gym: 'Gym', strength: 'Strength', functional: 'Functional',
  climbing: 'Climbing',
  yoga: 'Yoga', stretch: 'Stretching', rest: 'Rest day', custom: 'Custom',
}

function pipClass(type) {
  if (['run', 'swim', 'cycle', 'hike'].includes(type)) return 't-run'
  if (['gym', 'strength'].includes(type)) return 't-gym'
  if (type === 'functional') return 't-functional'
  if (type === 'climbing') return 't-climb'
  if (['yoga', 'stretch'].includes(type)) return 't-yoga'
  return 't-rest'
}

function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }

const SESSION_TYPES = [
  { key: 'run',        label: 'Running' },
  { key: 'functional', label: 'Functional' },
  { key: 'gym',        label: 'Gym' },
  { key: 'climbing',   label: 'Climbing' },
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

function EditProgramme({ localPlan, setLocalPlan, updateSession, deleteSession, addSession, moveSession }) {
  const [startDateWarn,    setStartDateWarn   ] = useState(false)
  const [showRepeatConfirm, setShowRepeatConfirm] = useState(false)

  const isSingleWeek = (localPlan.weeks?.length ?? 0) === 1

  const updateMeta = (field, val) =>
    setLocalPlan(p => ({ ...p, meta: { ...p.meta, [field]: val } }))

  const handleRepeatOff = () => {
    const source = resolveWeek(localPlan.weeks, 0) || buildEmptyWeek()
    const dup = source.map(day => ({ ...day, sessions: day.sessions.map(s => ({ ...s, id: uid() })) }))
    setLocalPlan(p => ({ ...p, weeks: [...p.weeks, dup] }))
  }

  const handleRepeatOnConfirm = () => {
    const source = resolveWeek(localPlan.weeks, 0) || localPlan.weeks[0]
    setLocalPlan(p => ({ ...p, weeks: [source] }))
    setShowRepeatConfirm(false)
  }

  const handleRepeatToggle = (checked) => {
    if (checked && !isSingleWeek) { setShowRepeatConfirm(true); return }
    if (!checked && isSingleWeek)  { handleRepeatOff(); return }
  }

  const addWeek = () =>
    setLocalPlan(p => ({ ...p, weeks: [...p.weeks, buildEmptyWeek()] }))

  const deleteWeek = (wi) =>
    setLocalPlan(p => {
      const newWeeks = p.weeks
        .filter((_, i) => i !== wi)
        .map(w => {
          if (!Array.isArray(w) && w.repeatsWeek != null) {
            if (w.repeatsWeek === wi)  return { repeatsWeek: 0 }
            if (w.repeatsWeek > wi)    return { repeatsWeek: w.repeatsWeek - 1 }
          }
          return w
        })
      return { ...p, weeks: newWeeks }
    })

  const makeIndependent = (wi) =>
    setLocalPlan(p => {
      const resolved = resolveWeek(p.weeks, wi) || buildEmptyWeek()
      const copy = resolved.map(day => ({ ...day, sessions: day.sessions.map(s => ({ ...s, id: uid() })) }))
      return { ...p, weeks: p.weeks.map((w, i) => i === wi ? copy : w) }
    })

  const setRepeat = (wi, targetWi) =>
    setLocalPlan(p => ({ ...p, weeks: p.weeks.map((w, i) => i === wi ? { repeatsWeek: targetWi } : w) }))

  return (
    <div className="t-edit-programme">
      <div className="t-prog-meta">
        <div className="t-prog-meta-field">
          <div className="t-field-label">Programme name</div>
          <input
            type="text"
            value={localPlan.meta?.name || ''}
            onChange={e => updateMeta('name', e.target.value)}
            className="t-input"
            placeholder="Training plan"
          />
        </div>
        <div className="t-prog-meta-field">
          <div className="t-field-label">Start date</div>
          <input
            type="date"
            value={localPlan.meta?.startDate || ''}
            onChange={e => updateMeta('startDate', e.target.value)}
            onBlur={e => {
              if (!e.target.value) { setStartDateWarn(false); return }
              const d = new Date(e.target.value + 'T00:00:00')
              setStartDateWarn(d.getDay() !== 1)
            }}
            className="t-input t-input-date"
          />
          {startDateWarn && (
            <p className="t-date-warn">Start date is not a Monday — the programme will begin mid-week.</p>
          )}
        </div>
        <div className="t-prog-meta-field">
          <div className="t-field-label">Repeats weekly</div>
          <label className="ac-toggle-label">
            <input
              type="checkbox"
              className="ac-toggle-input"
              checked={isSingleWeek}
              onChange={e => handleRepeatToggle(e.target.checked)}
            />
            <span className="ac-toggle-track"><span className="ac-toggle-thumb" /></span>
            <span className="ac-toggle-text">{isSingleWeek ? 'On' : 'Off'}</span>
          </label>
          {showRepeatConfirm && (
            <div className="t-repeat-confirm">
              <p className="t-date-warn" style={{ marginTop: 0 }}>This will remove weeks 2 onwards and keep only week 1.</p>
              <div className="t-repeat-confirm-actions">
                <button type="button" className="t-btn-primary t-btn-sm" onClick={handleRepeatOnConfirm}>Confirm</button>
                <button type="button" className="t-btn-ghost t-btn-sm" onClick={() => setShowRepeatConfirm(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {localPlan.weeks?.map((week, wi) => {
        const isRepeat  = !Array.isArray(week) && week.repeatsWeek != null
        const refCount  = localPlan.weeks.filter((w, i) => i !== wi && !Array.isArray(w) && w.repeatsWeek === wi).length
        const hasOtherReal = localPlan.weeks.some((w, i) => i !== wi && Array.isArray(w))
        return (
          <div key={wi} className="t-edit-week">
            <div className="t-edit-week-head">
              <span className="t-edit-week-label">Week {wi + 1}</span>
              <div className="t-edit-week-actions">
                {!isRepeat && hasOtherReal && (
                  <button
                    type="button"
                    className="t-btn-ghost t-btn-sm"
                    onClick={() => setRepeat(wi, wi === 0 ? 1 : 0)}
                  >Mark as repeat of…</button>
                )}
                {isRepeat && (
                  <button
                    type="button"
                    className="t-btn-ghost t-btn-sm"
                    onClick={() => makeIndependent(wi)}
                  >Make independent</button>
                )}
                {localPlan.weeks.length > 1 && (
                  <button
                    type="button"
                    className="t-btn-ghost t-btn-sm t-btn-danger"
                    onClick={() => deleteWeek(wi)}
                  >Delete week</button>
                )}
              </div>
            </div>

            {refCount > 0 && (
              <p className="t-week-delete-warn">
                This week is referenced by {refCount} repeat week{refCount !== 1 ? 's' : ''}. Deleting will retarget them to week 1.
              </p>
            )}

            {isRepeat ? (
              <div className="t-repeat-row">
                <span className="t-repeat-label">Repeats</span>
                <select
                  value={week.repeatsWeek}
                  onChange={e => setRepeat(wi, parseInt(e.target.value, 10))}
                  className="t-select t-select-inline"
                >
                  {localPlan.weeks.map((_, i) => i !== wi && (
                    <option key={i} value={i}>Week {i + 1}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="t-edit-list">
                {week.map((day, di) => (
                  <EditDay
                    key={day.day}
                    day={day}
                    di={di}
                    updateSession={(di, id, field, val) => updateSession(wi, di, id, field, val)}
                    deleteSession={(di, id)            => deleteSession(wi, di, id)}
                    addSession={(di, type, details)    => addSession(wi, di, type, details)}
                    moveSession={(di, id, dir)         => moveSession(wi, di, id, dir)}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}

      <button type="button" onClick={addWeek} className="t-add-week-btn">+ Add week</button>
    </div>
  )
}

export default function Training({ plan, savePlan, settings, getDefaultPlan }) {
  const [editing,   setEditing]   = useState(false)
  const [expanded,  setExpanded]  = useState(() => new Set(['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']))
  const [localPlan, setLocalPlan] = useState(plan)
  const [saveFlash, setSaveFlash] = useState(false)

  useEffect(() => { setLocalPlan(plan) }, [plan])

  if (!plan) return null

  const today       = new Date()
  const todayName   = today.toLocaleDateString('en-US', { weekday: 'long' })
  const currentWeek = getCurrentWeek(plan, today) || []
  const { idx: weekIdx, total: weekTotal, before: beforePlan, after: afterPlan } = getPlanPosition(plan, today)
  const planName    = plan?.meta?.name || 'Training plan'
  const startDateFmt = plan?.meta?.startDate
    ? new Date(plan.meta.startDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null
  const endDate = (() => {
    if (!plan?.meta?.startDate || !plan?.weeks?.length) return null
    const d = new Date(plan.meta.startDate + 'T00:00:00')
    d.setDate(d.getDate() + plan.weeks.length * 7 - 1)
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  })()

  // Edit-mode session mutations — operate on localPlan.weeks[wi][di]
  const updateSession = (wi, di, id, field, val) =>
    setLocalPlan(p => ({
      ...p,
      weeks: p.weeks.map((week, wIdx) => {
        if (wIdx !== wi || !Array.isArray(week)) return week
        return week.map((day, dIdx) =>
          dIdx !== di ? day : { ...day, sessions: day.sessions.map(s => s.id !== id ? s : { ...s, [field]: val }) }
        )
      }),
    }))
  const deleteSession = (wi, di, id) =>
    setLocalPlan(p => ({
      ...p,
      weeks: p.weeks.map((week, wIdx) => {
        if (wIdx !== wi || !Array.isArray(week)) return week
        return week.map((day, dIdx) =>
          dIdx !== di ? day : { ...day, sessions: day.sessions.filter(s => s.id !== id) }
        )
      }),
    }))
  const addSession = (wi, di, type, details) => {
    if (!details.trim()) return
    setLocalPlan(p => ({
      ...p,
      weeks: p.weeks.map((week, wIdx) => {
        if (wIdx !== wi || !Array.isArray(week)) return week
        return week.map((day, dIdx) =>
          dIdx !== di ? day : { ...day, sessions: [...day.sessions, { id: uid(), type, details }] }
        )
      }),
    }))
  }
  const moveSession = (wi, di, id, dir) =>
    setLocalPlan(p => ({
      ...p,
      weeks: p.weeks.map((week, wIdx) => {
        if (wIdx !== wi || !Array.isArray(week)) return week
        return week.map((day, dIdx) => {
          if (dIdx !== di) return day
          const idx = day.sessions.findIndex(s => s.id === id)
          const ni  = idx + dir
          if (ni < 0 || ni >= day.sessions.length) return day
          const arr = [...day.sessions]
          ;[arr[idx], arr[ni]] = [arr[ni], arr[idx]]
          return { ...day, sessions: arr }
        })
      }),
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
  const funcCount    = currentWeek.filter(d => d.sessions.some(s => s.type === 'functional')).length
  const gymTypes     = [...new Set(
    currentWeek.flatMap(d => d.sessions.filter(s => s.type === 'gym').map(s =>
      s.details.split('–')[0].split('/')[0].trim()
    ))
  )].length
  const yogaCount    = currentWeek.filter(d => d.sessions.some(s => s.type === 'yoga')).length
  const sessionTotal = currentWeek.reduce((n, day) => n + day.sessions.length, 0)

  return (
    <>
      <header className="training-header r r-1">
        <div className="training-title">
          <div className="training-name-group">
            <h1>Training plan</h1>
            {planName !== 'Training plan' && <span className="training-name">{planName}</span>}
          </div>
          {!beforePlan && !afterPlan && currentWeek.length > 0 && (
            <span className="training-week">WEEK {weekIdx + 1} OF {weekTotal}</span>
          )}
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
          <h2>
            {editing
              ? 'Edit programme'
              : beforePlan || afterPlan || currentWeek.length === 0
                ? 'Weekly plan'
                : `Weekly plan · week ${weekIdx + 1} of ${weekTotal}`}
          </h2>
          {!editing && (
            <div className="right">
              <button type="button" className="link" onClick={() => setEditing(true)}>Edit plan →</button>
            </div>
          )}
        </div>

        {!editing && beforePlan && startDateFmt && (
          <div className="t-plan-banner">
            <div className="t-plan-banner-label">Programme starts</div>
            <div className="t-plan-banner-date">{startDateFmt}</div>
          </div>
        )}
        {!editing && afterPlan && (
          <div className="t-plan-banner">
            <div className="t-plan-banner-label">Programme complete</div>
            {endDate && <div className="t-plan-banner-date">Ended {endDate}</div>}
          </div>
        )}
        {!editing && !beforePlan && !afterPlan && currentWeek.length === 0 && (
          <div className="t-plan-banner">
            <div className="t-plan-banner-label">No plan scheduled</div>
            <div className="t-plan-banner-date">
              <button type="button" className="link" onClick={() => setEditing(true)}>Edit plan →</button>
            </div>
          </div>
        )}

        {editing ? (
          <EditProgramme
            localPlan={localPlan}
            setLocalPlan={setLocalPlan}
            updateSession={updateSession}
            deleteSession={deleteSession}
            addSession={addSession}
            moveSession={moveSession}
          />

        ) : (
        <div className="week-grid">
          {currentWeek.map(day => {
            const isToday  = day.day === todayName
            const isOpen   = expanded.has(day.day)
            const primary  = day.sessions[0]
            const isRest   = primary?.type === 'rest'

            return (
              <div
                key={day.day}
                className={`day${isToday ? ' today' : ''}${isRest ? ' rest' : ''}`}
                onClick={() => setExpanded(prev => { const s = new Set(prev); isOpen ? s.delete(day.day) : s.add(day.day); return s })}
                role="button"
                tabIndex={0}
                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setExpanded(prev => { const s = new Set(prev); isOpen ? s.delete(day.day) : s.add(day.day); return s })}
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
