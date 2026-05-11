'use client'

import { useEffect } from 'react'
import {
  fmtDateLong,
  todayIso,
  weekStripData,
  shiftIso,
} from './dailyHelpers'

/**
 * Date navigation — arrows, date display, Today button, 7-day strip.
 *
 *   date     currently-selected ISO date
 *   setDate  setter; can refuse a future date (handled in shiftIso)
 *   logs     keyed by ISO date; drives the moss/empty pip per tile
 *
 * Keyboard: ← / → step one day; T jumps to today. Suppressed while
 * any input / select / textarea has focus.
 */
export default function DateNav({ date, setDate, logs }) {
  const today = todayIso()
  const isToday = date === today
  const weekDays = weekStripData(date, logs)

  const shiftDate = (delta) => {
    setDate(prev => shiftIso(prev, delta) ?? prev)
  }
  const goToday = () => setDate(today)

  useEffect(() => {
    const onKey = (e) => {
      const tag = (document.activeElement && document.activeElement.tagName) || ''
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowLeft')       shiftDate(-1)
      else if (e.key === 'ArrowRight') shiftDate(1)
      else if (e.key === 't' || e.key === 'T') goToday()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <section className="date-nav r r-2">
      <div className="date-display">
        <button
          type="button"
          className="nav-arrow"
          aria-label="Previous day"
          onClick={() => shiftDate(-1)}
        >‹</button>
        <div className="date-text">{fmtDateLong(date)}</div>
        <button
          type="button"
          className="nav-arrow"
          aria-label="Next day"
          disabled={isToday}
          onClick={() => shiftDate(1)}
        >›</button>
        <button
          type="button"
          className={`today-btn${isToday ? ' hidden' : ''}`}
          onClick={goToday}
        >
          Today
        </button>
      </div>

      <div className="week-strip">
        {weekDays.map(d => (
          <button
            key={d.iso}
            type="button"
            className={`week-day${d.isActive ? ' active' : ''}${d.hasEntry ? '' : ' empty'}`}
            onClick={() => setDate(d.iso)}
          >
            <span className="dow">{d.dow}</span>
            <span className="num">{d.num}</span>
            <span className="pip" />
          </button>
        ))}
      </div>
    </section>
  )
}
