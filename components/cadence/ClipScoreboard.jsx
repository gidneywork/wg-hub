'use client'

import {
  dayOfMonth, weekdayShort, getRow, pageDayStatus,
  STATUS_LABELS, STATUS_ORDER, SCOREBOARD_FOOTNOTE,
} from '../../lib/clipping'

/**
 * Week scoreboard (FC-090): pages × days, each cell coloured by status.
 * Numbers stay Ink (CADENCE.md rule 5); missed shows a dash, to do is blank.
 * Tapping a cell selects that day.
 */
export default function ClipScoreboard({ phase, pages, rows, dates, todayKey, selectedDate, onSelectDay, className = '' }) {
  return (
    <section className={`card clip-board ${className}`}>
      <div className="card-eyebrow"><span className="pip clip-pip" />Week scoreboard</div>

      <table className="clip-board-table">
        <thead>
          <tr>
            <th scope="col"><span className="sr-only">Page</span></th>
            {dates.map((d, i) => (
              <th
                key={d}
                scope="col"
                className={`${d === selectedDate ? 'is-selected' : ''}${d === todayKey ? ' is-today' : ''}`}
              >
                <span className="d">D{i + 1}</span>
                <span className="n">{dayOfMonth(d)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pages.map(p => (
            <tr key={p.id}>
              <th scope="row">{p.short_name}</th>
              {dates.map(d => {
                const row = getRow(rows, p.id, d)
                const status = pageDayStatus(phase, p, d, row, todayKey)
                const posts = row?.posts || 0
                const shown = status === 'missed' ? '–' : status === 'todo' ? '' : posts
                return (
                  <td key={d}>
                    <button
                      type="button"
                      className={`clip-cell is-${status}`}
                      onClick={() => onSelectDay(d)}
                      aria-label={`${p.short_name}, ${weekdayShort(d)} ${dayOfMonth(d)}: ${STATUS_LABELS[status]}, ${posts} ${posts === 1 ? 'post' : 'posts'}`}
                    >
                      {shown}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="clip-legend">
        {STATUS_ORDER.map(s => (
          <li key={s}><span className={`swatch is-${s}`} aria-hidden="true" />{STATUS_LABELS[s]}</li>
        ))}
      </ul>
      <p className="clip-footnote">{SCOREBOARD_FOOTNOTE}</p>
    </section>
  )
}
