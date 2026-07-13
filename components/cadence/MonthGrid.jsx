'use client'

/**
 * Presentation-only month grid (Monday-first). Knows nothing about events,
 * holidays, or plans — the parent supplies per-cell decoration via getCell.
 * Extracted from Planner.jsx (FC-060) so the Planner year calendar and the
 * Training month view share one scaffold.
 *
 *   getCell(iso, day) → { tint?, selected?, dots?: string[], extra?, onClick? } | null
 * A cell with an onClick renders as a button; without one, a static div.
 */

const MONTH_DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

// Weeks (Mon-first) of a month; each cell is { iso, day } or null padding.
export function monthMatrix(year, month) {
  const firstDow    = (new Date(year, month, 1).getDay() + 6) % 7 // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ iso, day: d })
  }
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

export default function MonthGrid({ year, month, today, getCell }) {
  const weeks     = monthMatrix(year, month)
  const monthName = new Date(year, month, 1).toLocaleDateString('en-GB', { month: 'long' })

  return (
    <div className="mini-month">
      <div className="mini-month-name">{monthName}</div>
      <div className="mini-week mini-week-head">
        {MONTH_DOW.map((w, i) => <span key={i} className="mini-dow">{w}</span>)}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="mini-week">
          {week.map((cell, ci) => {
            if (!cell) return <span key={ci} className="mini-day empty" />
            const c = getCell?.(cell.iso, cell.day) || {}
            const cls = ['mini-day',
              cell.iso === today && 'today',
              ci >= 5 && 'weekend',
              c.tint && 'holiday',
              c.selected && 'selected',
              !c.onClick && 'static',
            ].filter(Boolean).join(' ')
            const inner = (
              <>
                <span className="mini-day-num">{cell.day}</span>
                <span className="mini-day-dots">
                  {(c.dots || []).map((d, i) => <span key={i} className={`mini-dot ${d}`} />)}
                  {c.extra ? <span className="mini-day-count">{c.extra}</span> : null}
                </span>
              </>
            )
            return c.onClick
              ? <button key={ci} type="button" className={cls} onClick={c.onClick}>{inner}</button>
              : <div key={ci} className={cls}>{inner}</div>
          })}
        </div>
      ))}
    </div>
  )
}
