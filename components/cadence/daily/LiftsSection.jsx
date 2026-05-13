'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { buildLiftHistory, isLiftPB } from './dailyHelpers'
import { listExercises, getExerciseByName, resolveMuscle } from '../../../lib/exercises'

export default function LiftsSection({ date, allLogs = {}, lifts = [], onLiftsChange }) {
  const [showAddRow,  setShowAddRow ] = useState(false)
  const [addWeight,   setAddWeight  ] = useState('')
  const [addReps,     setAddReps    ] = useState('')

  // ── Combobox state
  const [query,       setQuery      ] = useState('')
  const [dropOpen,    setDropOpen   ] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const [selected,    setSelected   ] = useState(null)

  const comboRef   = useRef(null)
  const inputRef   = useRef(null)
  const weightRef  = useRef(null)
  const listRef    = useRef(null)

  // PB history excludes today
  const history = useMemo(() => buildLiftHistory(allLogs, date), [allLogs, date])

  // Custom exercises from prior logs that aren't in the DB
  const customExercises = useMemo(() => {
    const seen = new Set(listExercises().map(e => e.name.toLowerCase()))
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

  // DB entries excluding cardio + any custom entries from logs
  const dbExercises = useMemo(
    () => listExercises().filter(e => !e.cardio),
    []
  )

  // Filtered list for the dropdown
  const filteredList = useMemo(() => {
    const q = query.trim().toLowerCase()
    const dbMatches = dbExercises.filter(e => e.name.toLowerCase().includes(q))
    const customMatches = customExercises.filter(
      e => !getExerciseByName(e) && e.toLowerCase().includes(q)
    )
    return [
      ...dbMatches.map(e => e.name),
      ...customMatches,
    ]
  }, [query, dbExercises, customExercises])

  // Auto-highlight first match whenever the filtered list changes
  useEffect(() => {
    setHighlighted(filteredList.length > 0 ? 0 : -1)
  }, [filteredList])

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropOpen) return
    function handleMouseDown(e) {
      if (comboRef.current && !comboRef.current.contains(e.target)) {
        setDropOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [dropOpen])

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current || highlighted < 0) return
    const item = listRef.current.children[highlighted]
    item?.scrollIntoView({ block: 'nearest' })
  }, [highlighted])

  function openAdd() {
    setShowAddRow(true)
    setQuery('')
    setSelected(null)
    setAddWeight('')
    setAddReps('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function cancelAdd() {
    setShowAddRow(false)
    setDropOpen(false)
    setQuery('')
    setSelected(null)
    setAddWeight('')
    setAddReps('')
  }

  function confirmSelection(name) {
    if (!name) return
    setSelected(name)
    setQuery(name)
    setDropOpen(false)
    setHighlighted(-1)
    setTimeout(() => weightRef.current?.focus(), 50)
  }

  function handleInputChange(e) {
    const v = e.target.value
    setQuery(v)
    setSelected(null)
    setDropOpen(true)
  }

  function handleInputKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!dropOpen) { setDropOpen(true); return }
      setHighlighted(i => Math.min(i + 1, filteredList.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (dropOpen && highlighted >= 0 && filteredList[highlighted]) {
        confirmSelection(filteredList[highlighted])
      } else if (query.trim()) {
        // Custom entry — use exactly as typed
        confirmSelection(query.trim())
      }
    } else if (e.key === 'Escape') {
      setDropOpen(false)
      setHighlighted(-1)
    }
  }

  function handleInputFocus() {
    setDropOpen(true)
  }

  function saveLift() {
    const name = selected || query.trim()
    if (!name) { inputRef.current?.focus(); return }
    if (!addWeight || !addReps) return
    const entry = {
      exercise: name,
      weight:   parseFloat(addWeight) || 0,
      reps:     parseInt(addReps, 10) || 0,
    }
    onLiftsChange?.([...lifts, entry])
    setShowAddRow(false)
    setDropOpen(false)
    setQuery('')
    setSelected(null)
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
          const muscle = resolveMuscle(lift.exercise)
          const muscleLabel = muscle ? muscle.charAt(0).toUpperCase() + muscle.slice(1) : null
          return (
            <div key={idx} className="lift-row">
              <span className="exercise">{lift.exercise}</span>
              <div className="lift-tags">
                {pb && (
                  <span className="pb-tag">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12l5 5L20 7"/>
                    </svg>
                    New PB
                  </span>
                )}
                {muscleLabel && (
                  <span className="muscle-chip">{muscleLabel}</span>
                )}
              </div>
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
            <div className="lift-combobox" ref={comboRef}>
              <input
                ref={inputRef}
                type="text"
                className="lift-combobox-input"
                placeholder="Exercise"
                autoComplete="off"
                aria-label="Exercise"
                role="combobox"
                aria-expanded={dropOpen}
                aria-haspopup="listbox"
                aria-autocomplete="list"
                aria-activedescendant={highlighted >= 0 ? `lift-opt-${highlighted}` : undefined}
                value={query}
                onChange={handleInputChange}
                onFocus={handleInputFocus}
                onKeyDown={handleInputKeyDown}
              />
              {dropOpen && filteredList.length > 0 && (
                <ul
                  ref={listRef}
                  className="lift-combobox-list"
                  role="listbox"
                  aria-label="Exercises"
                >
                  {filteredList.map((name, i) => (
                    <li
                      key={name}
                      id={`lift-opt-${i}`}
                      role="option"
                      aria-selected={i === highlighted}
                      className={`lift-combobox-option${i === highlighted ? ' highlighted' : ''}`}
                      onMouseDown={e => { e.preventDefault(); confirmSelection(name) }}
                      onMouseEnter={() => setHighlighted(i)}
                    >
                      {name}
                    </li>
                  ))}
                </ul>
              )}
              {dropOpen && filteredList.length === 0 && query.trim() && (
                <div className="lift-combobox-empty">
                  No match — Enter to log as custom
                </div>
              )}
            </div>
            <span />
            <input
              ref={weightRef}
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
