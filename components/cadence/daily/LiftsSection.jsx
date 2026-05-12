'use client'

import { useState, useMemo, useRef } from 'react'
import { buildLiftHistory, isLiftPB } from './dailyHelpers'

const SEED_EXERCISES = [
  'Back squat',
  'Front squat',
  'Deadlift',
  'Bench press',
  'Overhead press',
  'Pull-up · weighted',
  'Pull-up · bodyweight',
  'Romanian deadlift',
  'Hip thrust',
  'Bulgarian split squat',
]

const NEW_SENTINEL = '__new__'

export default function LiftsSection({ date, allLogs = {}, lifts = [], onLiftsChange }) {
  const [showAddRow,      setShowAddRow     ] = useState(false)
  const [addExercise,     setAddExercise    ] = useState('')
  const [addWeight,       setAddWeight      ] = useState('')
  const [addReps,         setAddReps        ] = useState('')
  const [showNewExercise, setShowNewExercise] = useState(false)
  const [newName,         setNewName        ] = useState('')
  const [newError,        setNewError       ] = useState(false)

  const errorTimerRef = useRef(null)
  const selectRef     = useRef(null)
  const newInputRef   = useRef(null)

  // Exercises from prior log entries not in the seed list
  const customExercises = useMemo(() => {
    const seen = new Set(SEED_EXERCISES.map(e => e.toLowerCase()))
    const out  = []
    Object.values(allLogs).forEach(log => {
      ;(Array.isArray(log?.lifts) ? log.lifts : []).forEach(({ exercise }) => {
        if (!exercise) return
        const key = exercise.toLowerCase()
        if (!seen.has(key)) { seen.add(key); out.push(exercise) }
      })
    })
    return out
  }, [allLogs])

  const allExercises = [...SEED_EXERCISES, ...customExercises]

  // PB history excludes today — today's lifts compare against prior days only
  const history = useMemo(() => buildLiftHistory(allLogs, date), [allLogs, date])

  // ── Add-row handlers
  function openAdd() {
    setShowAddRow(true)
    setAddExercise('')
    setAddWeight('')
    setAddReps('')
    setTimeout(() => selectRef.current?.focus(), 50)
  }

  function cancelAdd() {
    setShowAddRow(false)
    setShowNewExercise(false)
    setAddExercise('')
    setAddWeight('')
    setAddReps('')
    setNewName('')
    setNewError(false)
  }

  function handleExerciseSelect(e) {
    const val = e.target.value
    if (val === NEW_SENTINEL) {
      setShowNewExercise(true)
      setAddExercise('')
      setTimeout(() => newInputRef.current?.focus(), 50)
    } else {
      setAddExercise(val)
      setShowNewExercise(false)
    }
  }

  function commitNewExercise() {
    const name = newName.trim()
    if (!name) return
    if (allExercises.some(e => e.toLowerCase() === name.toLowerCase())) {
      setNewError(true)
      clearTimeout(errorTimerRef.current)
      errorTimerRef.current = setTimeout(() => setNewError(false), 2000)
      return
    }
    setShowNewExercise(false)
    setAddExercise(name)
    setNewName('')
    setTimeout(() => selectRef.current?.focus(), 50)
  }

  function saveLift() {
    if (!addExercise) { selectRef.current?.focus(); return }
    if (!addWeight || !addReps) return
    const entry = {
      exercise: addExercise,
      weight:   parseFloat(addWeight) || 0,
      reps:     parseInt(addReps, 10) || 0,
    }
    onLiftsChange?.([...lifts, entry])
    setShowAddRow(false)
    setShowNewExercise(false)
    setAddExercise('')
    setAddWeight('')
    setAddReps('')
  }

  function deleteLift(idx) {
    onLiftsChange?.(lifts.filter((_, i) => i !== idx))
  }

  const metaSuffix = lifts.length > 0 ? ` · ${lifts.length} logged today` : ''

  return (
    <section className="section r r-8">
      <div className="section-head">
        <span className="title">Lifts</span>
        <span className="meta">Optional{metaSuffix}</span>
      </div>
      <div className="lifts-card">

        {lifts.map((lift, idx) => {
          const pb = isLiftPB(lift, history)
          return (
            <div key={idx} className="lift-row">
              <span className="exercise">{lift.exercise}</span>
              {pb ? (
                <span className="pb-tag">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l5 5L20 7"/>
                  </svg>
                  New PB
                </span>
              ) : (
                <span />
              )}
              <span className="weight">
                {lift.weight > 0 ? lift.weight : '—'}
                {lift.weight > 0 && <span className="unit">kg</span>}
              </span>
              <span className="reps">× {lift.reps}<span className="unit">reps</span></span>
              <button
                type="button"
                className="del-btn"
                aria-label="Remove"
                onClick={() => deleteLift(idx)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
          )
        })}

        {lifts.length === 0 && !showAddRow && (
          <div className="lift-empty">No lifts logged yet</div>
        )}

        {showAddRow && (
          <div className="lift-add-row">
            {showNewExercise ? (
              <div className="lift-new-exercise">
                <input
                  ref={newInputRef}
                  type="text"
                  className="lift-new-exercise-input"
                  placeholder="Exercise name"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') commitNewExercise() }}
                />
                <button type="button" className="btn" onClick={commitNewExercise}>Add</button>
                {newError && (
                  <span key={Date.now()} className="lift-new-exercise-error">Already exists</span>
                )}
              </div>
            ) : (
              <select
                ref={selectRef}
                aria-label="Exercise"
                value={addExercise}
                onChange={handleExerciseSelect}
              >
                <option value="">Choose exercise…</option>
                {allExercises.map(o => <option key={o} value={o}>{o}</option>)}
                <option value={NEW_SENTINEL}>+ New exercise</option>
              </select>
            )}
            <span />
            <input
              type="text"
              inputMode="decimal"
              placeholder="kg"
              aria-label="Weight"
              value={addWeight}
              onChange={e => setAddWeight(e.target.value)}
            />
            <input
              type="text"
              inputMode="numeric"
              placeholder="reps"
              aria-label="Reps"
              value={addReps}
              onChange={e => setAddReps(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveLift() }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" className="btn" onClick={saveLift}>Save</button>
              <button type="button" className="btn ghost" onClick={cancelAdd}>×</button>
            </div>
          </div>
        )}

        {!showAddRow && (
          <button type="button" className="lift-add-trigger" onClick={openAdd}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Add lift
          </button>
        )}

      </div>
    </section>
  )
}
