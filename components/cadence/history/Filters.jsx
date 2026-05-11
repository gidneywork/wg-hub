'use client'

import { useEffect, useRef } from 'react'

const TYPE_OPTIONS = [
  { val: 'all',      label: 'All' },
  { val: 'run',      label: 'Run',      pip: 'run' },
  { val: 'strength', label: 'Strength', pip: 'strength' },
  { val: 'recovery', label: 'Recovery', pip: 'recovery' },
]

const SOURCE_OPTIONS = [
  { val: 'all',    label: 'All' },
  { val: 'strava', label: 'Strava' },
  { val: 'whoop',  label: 'Whoop' },
  { val: 'manual', label: 'Manual' },
]

const RANGE_OPTIONS = [
  { val: 'this-week',  label: 'This week' },
  { val: 'this-month', label: 'This month' },
  { val: '3-months',   label: 'Last 3 months' },
  { val: 'this-year',  label: 'This year' },
  { val: 'all-time',   label: 'All time' },
]

const RANGE_LABEL = Object.fromEntries(RANGE_OPTIONS.map(o => [o.val, o.label]))

export default function Filters({
  search, setSearch,
  typeFilter, setTypeFilter,
  sourceFilter, setSourceFilter,
  range, setRange,
  rangeOpen, setRangeOpen,
}) {
  const pickerRef = useRef(null)

  // Close the range menu on outside-click and Escape.
  useEffect(() => {
    if (!rangeOpen) return
    const onClick = e => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setRangeOpen(false)
      }
    }
    const onKey = e => { if (e.key === 'Escape') setRangeOpen(false) }
    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [rangeOpen, setRangeOpen])

  return (
    <section className="filters r r-3">

      <div className="search-wrap">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input
          className="search-input"
          type="text"
          placeholder="Search by name, type, or note…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="filter-group" data-filter="type">
        <span className="gl">Type</span>
        {TYPE_OPTIONS.map(opt => (
          <button
            key={opt.val}
            type="button"
            className={`filter-pill${typeFilter === opt.val ? ' active' : ''}`}
            onClick={() => setTypeFilter(opt.val)}
          >
            {opt.pip ? <span className={`pip ${opt.pip}`} /> : null}
            {opt.label}
          </button>
        ))}
      </div>

      <div className="filter-group" data-filter="source">
        <span className="gl">Source</span>
        {SOURCE_OPTIONS.map(opt => (
          <button
            key={opt.val}
            type="button"
            className={`filter-pill${sourceFilter === opt.val ? ' active' : ''}`}
            onClick={() => setSourceFilter(opt.val)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div ref={pickerRef} className={`range-picker${rangeOpen ? ' open' : ''}`}>
        <button
          type="button"
          className="range-btn"
          onClick={e => { e.stopPropagation(); setRangeOpen(!rangeOpen) }}
        >
          <span>{RANGE_LABEL[range]}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
        </button>
        <div className={`range-menu${rangeOpen ? ' open' : ''}`}>
          {RANGE_OPTIONS.map(opt => (
            <button
              key={opt.val}
              type="button"
              className={range === opt.val ? 'active' : ''}
              onClick={() => { setRange(opt.val); setRangeOpen(false) }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

    </section>
  )
}
