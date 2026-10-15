'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import './clipping.css'
import { db } from '../../lib/db'
import {
  londonDateKey, dayOfMonth, weekdayShort, formatRange,
  phaseDates, phaseLength, getPhaseDay, clampDay, clampDate, pickPhase,
  targetFor, rowKey, getRow, pageDayStatus, dayHitCount, streak, weekTotals,
  formatMins, shouldReplay, tasksFor, lastCampaign, RAMP, RULES, CHECKIN_HINT,
} from '../../lib/clipping'
import useClipSync, { readClipOutbox, clearClipOutbox } from './useClipSync'
import ClipPageCard from './ClipPageCard'
import ClipScoreboard from './ClipScoreboard'

/**
 * Clipping — setup-week tracker (FC-090 part 1). Wealth pillar.
 *
 * Owns its own data (loaded on mount, like Planner). Every edit updates local
 * state at once and goes through useClipSync: page-days and notes debounced,
 * checklist ticks immediate, all flushed when Safari hides the page. All logic
 * is in lib/clipping.js.
 */

// Mirrors --ease, cubic-bezier(0.2, 0.7, 0.2, 1), for JS-driven number tweens.
function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
  const sx = t => ((ax * t + bx) * t + cx) * t
  const sy = t => ((ay * t + by) * t + cy) * t
  const dx = t => (3 * ax * t + 2 * bx) * t + cx
  return x => {
    let t = x
    for (let i = 0; i < 6; i++) {
      const d = dx(t)
      if (Math.abs(d) < 1e-6) break
      t -= (sx(t) - x) / d
    }
    return sy(Math.min(1, Math.max(0, t)))
  }
}
const EASE = cubicBezier(0.2, 0.7, 0.2, 1)
const TWEEN_MS = 600

// Tweens a number to its new value over 600 ms (brand §8 data transitions).
function useTween(target) {
  const [value, setValue] = useState(0)
  const fromRef = useRef(0)
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) { fromRef.current = target; setValue(target); return }
    const from = fromRef.current
    let raf, start = null
    const step = now => {
      if (start == null) start = now
      const p = Math.min((now - start) / TWEEN_MS, 1)
      const v = from + (target - from) * EASE(p)
      fromRef.current = v
      setValue(Math.round(v))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return value
}

function Stat({ label, value, of, format }) {
  const v = useTween(value)
  return (
    <div className="clip-stat">
      <div className="clip-stat-num">
        {format ? format(v) : v}
        {of != null && <span className="of"> / {of}</span>}
      </div>
      <div className="clip-stat-label">{label}</div>
    </div>
  )
}

const blankRow = (pageId, date) => ({ page_id: pageId, log_date: date, posts: 0, engagement_mins: 0, provider: null, campaign: null, views: null })
const toPayload = r => ({ page_id: r.page_id, log_date: r.log_date, posts: r.posts, engagement_mins: r.engagement_mins, provider: r.provider ?? null, campaign: r.campaign ?? null, views: r.views })

export default function Clipping() {
  const [load, setLoad]               = useState('loading')   // loading | ready | empty | error
  const [pages, setPages]             = useState([])
  const [phase, setPhase]             = useState(null)
  const [rows, setRows]               = useState(() => new Map())
  const [completions, setCompletions] = useState(() => new Set())
  const [notes, setNotes]             = useState(() => new Map())
  const [todayKey, setTodayKey]       = useState(() => londonDateKey())
  const [selectedDate, setSelectedDate] = useState(null)

  // Refs mirror state so edits build on the latest value between renders.
  const rowsRef  = useRef(rows)
  const notesRef = useRef(notes)
  const doneRef  = useRef(completions)

  const sync = useClipSync({
    day:  p => db.upsertClipPageDay(p),
    note: p => db.upsertClipDayNote(p.note_date, p.body),
    task: p => (p.done ? db.completeClipTask(p.phase_id, p.task_key) : db.uncompleteClipTask(p.phase_id, p.task_key)),
  })

  // Keep "today" right when the page is left open past midnight.
  useEffect(() => {
    const tick = () => setTodayKey(londonDateKey())
    const id = setInterval(tick, 60000)
    const onVis = () => { if (document.visibilityState === 'visible') tick() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const today = londonDateKey()
        const [pg, phases] = await Promise.all([db.loadClipPages(), db.loadClipPhases()])
        const ph = pickPhase(phases, today)
        if (cancelled) return
        if (!ph) { setLoad('empty'); return }
        const [days, done, nts] = await Promise.all([
          db.loadClipPageDays(ph.start_date, ph.end_date),
          db.loadClipTaskCompletions(ph.id),
          db.loadClipDayNotes(ph.start_date, ph.end_date),
        ])
        if (cancelled) return

        const rowMap  = new Map(days.map(r => [rowKey(r.page_id, r.log_date), r]))
        const noteMap = new Map(nts.map(n => [n.note_date, n]))
        const doneSet = new Set(done.map(c => c.task_key))

        // Replay the outbox: writes that never reached the server last time.
        const replay = []
        readClipOutbox().forEach(entry => {
          const p = entry.payload
          if (entry.kind === 'day') {
            const k = rowKey(p.page_id, p.log_date)
            if (!shouldReplay(entry, rowMap.get(k))) return
            rowMap.set(k, { ...(rowMap.get(k) || {}), ...p })
          } else if (entry.kind === 'note') {
            if (!shouldReplay(entry, noteMap.get(p.note_date))) return
            noteMap.set(p.note_date, { ...(noteMap.get(p.note_date) || {}), note_date: p.note_date, body: p.body })
          } else if (entry.kind === 'task') {
            if (p.phase_id === ph.id) { if (p.done) doneSet.add(p.task_key); else doneSet.delete(p.task_key) }
          } else return
          replay.push(entry)
        })

        rowsRef.current = rowMap
        notesRef.current = noteMap
        doneRef.current = doneSet
        setPages(pg.filter(p => p.active !== false))
        setPhase(ph)
        setRows(rowMap)
        setNotes(noteMap)
        setCompletions(doneSet)
        setSelectedDate(clampDate(ph, today))
        setLoad('ready')
        // Skipped entries are dropped; replayed ones go back on the queue.
        clearClipOutbox()
        replay.forEach(e => sync.queue(e.kind, e.key, e.payload, { immediate: true, queuedAt: e.queuedAt }))
      } catch (e) {
        console.error('Clipping load failed:', e)
        if (!cancelled) setLoad('error')
      }
    })()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const dates = useMemo(() => (phase ? phaseDates(phase) : []), [phase])
  const totals = useMemo(() => (phase ? weekTotals(phase, pages, rows) : null), [phase, pages, rows])
  const streakDays = useMemo(() => (phase ? streak(phase, pages, rows, todayKey) : 0), [phase, pages, rows, todayKey])

  if (load === 'loading') return <div className="clipping"><div className="clip-quiet">Loading…</div></div>
  if (load === 'error') return <div className="clipping"><div className="card clip-quiet-card">Clipping could not load. The clip tables may not be set up yet.</div></div>
  if (load === 'empty') return <div className="clipping"><div className="card clip-quiet-card">No clipping phase set up yet.</div></div>

  const selectedDay = getPhaseDay(phase, selectedDate)
  const todayDay = clampDay(phase, todayKey)
  const length = phaseLength(phase)
  const checklist = tasksFor(phase, selectedDay)
  const note = notes.get(selectedDate)?.body ?? ''

  const updateRow = (page, patch) => {
    const k = rowKey(page.id, selectedDate)
    const next = { ...(rowsRef.current.get(k) || blankRow(page.id, selectedDate)), ...patch }
    rowsRef.current = new Map(rowsRef.current).set(k, next)
    setRows(rowsRef.current)
    sync.queue('day', k, toPayload(next))
  }

  const updateNote = (body) => {
    notesRef.current = new Map(notesRef.current).set(selectedDate, { ...(notesRef.current.get(selectedDate) || {}), note_date: selectedDate, body })
    setNotes(notesRef.current)
    sync.queue('note', selectedDate, { note_date: selectedDate, body })
  }

  const toggleTask = (taskKey) => {
    const done = !doneRef.current.has(taskKey)
    const next = new Set(doneRef.current)
    if (done) next.add(taskKey); else next.delete(taskKey)
    doneRef.current = next
    setCompletions(next)
    sync.queue('task', `${phase.id}|${taskKey}`, { phase_id: phase.id, task_key: taskKey, done }, { immediate: true })
  }

  return (
    <div className="clipping">

      <header className="clip-head r r-1">
        <div>
          <div className="eyebrow"><span className="clip-pip" />Clipping · {phase.name} · {formatRange(phase.start_date, phase.end_date)}</div>
          <h1>Day {todayDay} of {length}<span className="dot">.</span></h1>
        </div>
        {sync.failing && <div className="clip-stamp" role="status">Not saved. Retrying.</div>}
      </header>

      <div className="clip-stats r r-2">
        <Stat label="Day streak" value={streakDays} />
        <Stat label="Posts this week" value={totals.posts} of={totals.planned} />
        <Stat label="Engagement" value={totals.engagementMins} format={formatMins} />
        <Stat label="Page-days hit" value={totals.hit} of={totals.pageDays} />
      </div>

      <div className="clip-strip r r-3" role="group" aria-label="Day">
        {dates.map((d, i) => {
          const hits = dayHitCount(phase, pages, rows, d)
          return (
            <button
              key={d}
              type="button"
              className={`clip-day${d === selectedDate ? ' is-selected' : ''}${d === todayKey ? ' is-today' : ''}`}
              aria-pressed={d === selectedDate}
              aria-current={d === todayKey ? 'date' : undefined}
              onClick={() => setSelectedDate(d)}
            >
              <span className="wd">{weekdayShort(d)}</span>
              <span className="dm">{dayOfMonth(d)}</span>
              <span className="dn">D{i + 1}</span>
              <span className="tg">{targetFor(phase, i + 1, null)}/day</span>
              <span className="bar" aria-label={`${hits} of ${pages.length} pages hit`}>
                {pages.map((p, j) => <i key={p.id} className={j < hits ? 'on' : ''} />)}
              </span>
            </button>
          )
        })}
      </div>

      <div className="clip-cards">
        {pages.map((p, i) => {
          const row = getRow(rows, p.id, selectedDate)
          return (
            <ClipPageCard
              key={p.id}
              className={`r r-${Math.min(10, 4 + i)}`}
              page={p}
              row={row}
              target={targetFor(phase, selectedDay, p.slug)}
              dateKey={selectedDate}
              carriedCampaign={lastCampaign(rows, p.id, selectedDate)}
              status={pageDayStatus(phase, p, selectedDate, row, todayKey)}
              onChange={patch => updateRow(p, patch)}
            />
          )
        })}
      </div>

      <div className="clip-pair">
        {checklist && (
          <section className="card clip-tasks r r-9">
            <div className="card-eyebrow"><span className="pip clip-pip" />Day {selectedDay} setup focus</div>
            <h2 className="card-title">{checklist.title}</h2>
            <ul>
              {checklist.tasks.map(t => (
                <li key={t.key}>
                  <label className="clip-check">
                    <input type="checkbox" checked={completions.has(t.key)} onChange={() => toggleTask(t.key)} />
                    <span className="box" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
                    </span>
                    <span>{t.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="card clip-checkin r r-9">
          <div className="card-eyebrow"><span className="pip clip-pip" />Check-in · {weekdayShort(selectedDate)} {dayOfMonth(selectedDate)}</div>
          <label className="clip-hint" htmlFor="clip-note">{CHECKIN_HINT}</label>
          <textarea id="clip-note" rows={4} value={note} onChange={e => updateNote(e.target.value)} />
        </section>
      </div>

      <ClipScoreboard
        className="r r-10"
        phase={phase}
        pages={pages}
        rows={rows}
        dates={dates}
        todayKey={todayKey}
        selectedDate={selectedDate}
        onSelectDay={setSelectedDate}
      />

      <section className="card clip-rules r r-10">
        <div className="card-eyebrow"><span className="pip clip-pip" />Rules</div>
        <ul className="clip-ramp">
          {RAMP.map(r => (
            <li key={r.when}><span className="when">{r.when}</span><span className="tg">{r.target}</span></li>
          ))}
        </ul>
        <div className="clip-rule-groups">
          {RULES.map(g => (
            <div key={g.title}>
              <h3>{g.title}</h3>
              <ul>{g.items.map(item => <li key={item}>{item}</li>)}</ul>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}
