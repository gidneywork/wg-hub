'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { localIso, startOfWeek } from './helpers'
import { db } from '../../lib/db'
import { filterTodosForDate } from '../../lib/todos'
import MonthGrid from './MonthGrid'

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
    <section className="planner-todos r r-2">
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
  date, isToday, holidays, events, pending, completed,
  onAddEvent, onEditEvent, onCompleteTodo, form,
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

// ── Week strip (events + to-dos glance + holidays) ─────────────────────────────

function WeekStrip({ weekStart, today, holidaysByDate }) {
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

  // Live-sync events across the week strip and year calendar.
  useEffect(() => db.subscribeToEvents(() => { refreshEvents() }), [refreshEvents])

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
    <section className="planner-week-strip r r-3">
      {dates.map(date => {
        const holidays  = holidaysByDate[date] || []
        const dayEvents = eventsByDate[date] || []
        const { pending, completed } = filterTodosForDate(todos, completions, date)
        const formHere  = eventForm && eventForm.date === date
        return (
          <DayRow
            key={date}
            date={date}
            isToday={date === today}
            holidays={holidays}
            events={dayEvents}
            pending={pending}
            completed={completed}
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

// ── Year calendar ──────────────────────────────────────────────────────────────

// monthMatrix + the month-grid scaffold now live in the shared MonthGrid
// component (FC-060); YearCalendar feeds it event/holiday decoration below.

function YearCalendar({ holidaysByDate }) {
  const [year,         setYear        ] = useState(() => new Date().getFullYear())
  const [events,       setEvents      ] = useState([])
  const [selectedDate, setSelectedDate] = useState(null)
  const [eventForm,    setEventForm   ] = useState(null) // { date, event }

  const today = localIso()

  const refreshEvents = useCallback(async () => {
    setEvents(await db.loadEventsInRange(`${year}-01-01`, `${year}-12-31`))
  }, [year])

  useEffect(() => { refreshEvents() }, [refreshEvents])

  // Live-sync events across the week strip and year calendar.
  useEffect(() => db.subscribeToEvents(() => { refreshEvents() }), [refreshEvents])

  // Expand each event across the days it covers within this year.
  const eventsByDate = useMemo(() => {
    const map = {}
    const yStr = String(year)
    events.forEach(ev => {
      const end = new Date(ev.end_date + 'T00:00:00')
      for (let d = new Date(ev.start_date + 'T00:00:00'); d <= end; d.setDate(d.getDate() + 1)) {
        const iso = localIso(d)
        if (iso.slice(0, 4) === yStr) (map[iso] ||= []).push(ev)
      }
    })
    return map
  }, [events, year])

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

  function selectDay(iso) {
    setEventForm(null)
    setSelectedDate(prev => prev === iso ? null : iso)
  }

  const selEvents   = selectedDate ? (eventsByDate[selectedDate] || []) : []
  const selHolidays = selectedDate ? (holidaysByDate[selectedDate] || []) : []
  const detailDate  = selectedDate
    ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <section className="planner-year r r-4">
      <div className="planner-year-head">
        <div className="planner-year-nav">
          <button type="button" className="planner-nav-btn" onClick={() => setYear(y => y - 1)} aria-label="Previous year">‹</button>
          <span className="planner-year-label">{year}</span>
          <button type="button" className="planner-nav-btn" onClick={() => setYear(y => y + 1)} aria-label="Next year">›</button>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => setYear(new Date().getFullYear())}>This year</button>
      </div>

      <div className="planner-year-grid">
        {Array.from({ length: 12 }, (_, m) => (
          <MonthGrid
            key={m}
            year={year}
            month={m}
            today={today}
            getCell={(iso) => ({
              tint:     (holidaysByDate[iso] || []).length > 0,
              selected: iso === selectedDate,
              dots:     (eventsByDate[iso] || []).length > 0 ? ['event'] : [],
              onClick:  () => selectDay(iso),
            })}
          />
        ))}
      </div>

      {selectedDate && (
        <div className="planner-year-detail">
          <div className="planner-year-detail-head">
            <span className="planner-year-detail-date">{detailDate}</span>
            <button
              type="button"
              className="planner-close-btn"
              onClick={() => { setSelectedDate(null); setEventForm(null) }}
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {selHolidays.map((title, i) => (
            <div key={`h${i}`} className="cal-holiday">{title}</div>
          ))}

          {selEvents.map(ev => (
            <button key={ev.id} type="button" className="cal-event" onClick={() => setEventForm({ date: selectedDate, event: ev })}>
              {!ev.all_day && ev.start_time && <span className="cal-event-time">{ev.start_time.slice(0, 5)}</span>}
              <span className="cal-event-title">{ev.title}</span>
            </button>
          ))}

          {eventForm ? (
            <EventForm
              date={eventForm.date}
              initial={eventForm.event}
              onSave={handleSaveEvent}
              onDelete={handleDeleteEvent}
              onCancel={() => setEventForm(null)}
            />
          ) : (
            <button type="button" className="year-add" onClick={() => setEventForm({ date: selectedDate, event: null })}>
              + add event
            </button>
          )}
        </div>
      )}
    </section>
  )
}

// ── Planner (root) ─────────────────────────────────────────────────────────────

export default function Planner() {
  const [weekStart,      setWeekStart     ] = useState(() => localIso(startOfWeek()))
  const [holidaysByDate, setHolidaysByDate] = useState({})

  const today = localIso()

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

  function prevWeek() { setWeekStart(w => shiftWeek(w, -1)) }
  function nextWeek() { setWeekStart(w => shiftWeek(w, +1)) }

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
      </header>

      {/* r-2 — to-dos */}
      <TodosSection weekStart={weekStart} today={today} />

      {/* r-3 — week strip */}
      <WeekStrip
        weekStart={weekStart}
        today={today}
        holidaysByDate={holidaysByDate}
      />

      {/* r-4 — year calendar */}
      <YearCalendar holidaysByDate={holidaysByDate} />

    </div>
  )
}
