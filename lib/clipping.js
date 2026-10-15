/**
 * clipping.js — single source of truth for Clipping logic (FC-090).
 *
 * Pure functions only: no React, no database. Dates are London date keys
 * ('YYYY-MM-DD'). Day arithmetic works on the keys through Date.UTC, so a
 * clock change (25 Oct 2026) can never shift a key. Never derive a key from
 * toISOString(): late-evening logging would land on the next day.
 *
 * Rows are page-day rows from clip_page_days, held in a Map (or plain object)
 * keyed by rowKey(pageId, dateKey).
 */

// ─── Date keys ────────────────────────────────────────────────────────────────

const LONDON_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
})

// The London calendar date of an instant, as 'YYYY-MM-DD'.
export function londonDateKey(d = new Date()) {
  return LONDON_FMT.format(d)
}

function keyToUtc(key) {
  const [y, m, d] = key.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function utcToKey(ms) {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

const DAY_MS = 86400000

export function addDays(key, n) {
  return utcToKey(keyToUtc(key) + n * DAY_MS)
}

// Whole days from a to b (b − a).
export function diffDays(a, b) {
  return Math.round((keyToUtc(b) - keyToUtc(a)) / DAY_MS)
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS   = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function weekdayShort(key) {
  return WEEKDAYS[new Date(keyToUtc(key)).getUTCDay()]
}

export function dayOfMonth(key) {
  return Number(key.slice(8, 10))
}

// "15–21 Oct", or "29 Oct – 4 Nov" across a month boundary.
export function formatRange(startKey, endKey) {
  const sm = MONTHS[Number(startKey.slice(5, 7)) - 1]
  const em = MONTHS[Number(endKey.slice(5, 7)) - 1]
  if (sm === em) return `${dayOfMonth(startKey)}–${dayOfMonth(endKey)} ${em}`
  return `${dayOfMonth(startKey)} ${sm} – ${dayOfMonth(endKey)} ${em}`
}

// ─── Phases ───────────────────────────────────────────────────────────────────

export function phaseLength(phase) {
  return diffDays(phase.start_date, phase.end_date) + 1
}

export function phaseDates(phase) {
  return Array.from({ length: phaseLength(phase) }, (_, i) => addDays(phase.start_date, i))
}

// 1-based day of the phase, or null outside it.
export function getPhaseDay(phase, dateKey) {
  if (!phase || dateKey < phase.start_date || dateKey > phase.end_date) return null
  return diffDays(phase.start_date, dateKey) + 1
}

// Day number clamped into 1..length (before the phase → 1, after → last).
export function clampDay(phase, dateKey) {
  if (dateKey < phase.start_date) return 1
  if (dateKey > phase.end_date) return phaseLength(phase)
  return getPhaseDay(phase, dateKey)
}

// The date key clamped into the phase.
export function clampDate(phase, dateKey) {
  return addDays(phase.start_date, clampDay(phase, dateKey) - 1)
}

// The phase to show: the one containing today; else the most recent past
// phase; else the earliest upcoming one.
export function pickPhase(phases, todayKey) {
  if (!phases?.length) return null
  const current = phases.find(p => p.start_date <= todayKey && p.end_date >= todayKey)
  if (current) return current
  const past = phases.filter(p => p.end_date < todayKey).sort((a, b) => (a.end_date < b.end_date ? 1 : -1))
  if (past.length) return past[0]
  return [...phases].sort((a, b) => (a.start_date < b.start_date ? -1 : 1))[0]
}

// ─── Targets ──────────────────────────────────────────────────────────────────

function override(phase, pageSlug) {
  return phase?.config?.page_overrides?.[pageSlug] || {}
}

// Posts target for a day of the phase. page_overrides[slug].ramp replaces the
// phase ramp for that page. A day outside every ramp step has no target (0).
export function targetFor(phase, dayNumber, pageSlug) {
  const ramp = override(phase, pageSlug).ramp || phase?.config?.ramp || []
  const step = ramp.find(s => dayNumber >= s.from_day && dayNumber <= s.to_day)
  return step ? step.posts : 0
}

export function minEngagement(phase, pageSlug) {
  const o = override(phase, pageSlug).min_engagement_mins
  if (o != null) return o
  return phase?.config?.min_engagement_mins ?? 0
}

// ─── Page-day status ──────────────────────────────────────────────────────────

export const rowKey = (pageId, dateKey) => `${pageId}|${dateKey}`

export function getRow(rows, pageId, dateKey) {
  if (!rows) return null
  const k = rowKey(pageId, dateKey)
  return (rows instanceof Map ? rows.get(k) : rows[k]) || null
}

// The Whop campaign carried forward for a page: whop_campaign from its most
// recent row strictly before dateKey with a non-empty value, else null.
export function lastCampaign(rows, pageId, dateKey) {
  if (!rows) return null
  const list = rows instanceof Map ? [...rows.values()] : Object.values(rows)
  let best = null
  list.forEach(r => {
    if (r.page_id !== pageId || !(r.log_date < dateKey)) return
    const c = (r.whop_campaign ?? '').trim()
    if (c && (!best || r.log_date > best.log_date)) best = { log_date: r.log_date, c }
  })
  return best ? best.c : null
}

// whop_campaign deliberately does not count towards "logged" (FC-090b).
export function isLogged(row) {
  if (!row) return false
  return (row.posts || 0) > 0 || (row.engagement_mins || 0) > 0 || !!row.whop_linked || row.views != null
}

export function isHit(phase, page, dateKey, row) {
  const day = getPhaseDay(phase, dateKey)
  if (day == null || !row) return false
  return (row.posts || 0) >= targetFor(phase, day, page.slug)
    && (row.engagement_mins || 0) >= minEngagement(phase, page.slug)
    && (page.monetisation !== 'whop' || !!row.whop_linked)
}

// 'hit' | 'progress' | 'short' | 'missed' | 'todo'
export function pageDayStatus(phase, page, dateKey, row, todayKey) {
  if (isHit(phase, page, dateKey, row)) return 'hit'
  const past = dateKey < todayKey
  if (isLogged(row)) return past ? 'short' : 'progress'
  return past ? 'missed' : 'todo'
}

export const STATUS_LABELS = {
  hit:      'Hit',
  progress: 'In progress',
  short:    'Short',
  missed:   'Missed',
  todo:     'To do',
}

export const STATUS_ORDER = ['hit', 'progress', 'short', 'missed', 'todo']

// Active pages hit on a date.
export function dayHitCount(phase, pages, rows, dateKey) {
  return pages.filter(p => p.active !== false)
    .filter(p => isHit(phase, p, dateKey, getRow(rows, p.id, dateKey))).length
}

// ─── Streak and totals ────────────────────────────────────────────────────────

// Consecutive days, counting back, on which every active page was hit. Starts
// at today (capped at the phase end); if that day is not all-hit, starts at
// the day before. Days before the phase start end the count.
export function streak(phase, pages, rows, todayKey) {
  const active = pages.filter(p => p.active !== false)
  if (!phase || !active.length) return 0
  const allHit = d => active.every(p => isHit(phase, p, d, getRow(rows, p.id, d)))
  let d = todayKey > phase.end_date ? phase.end_date : todayKey
  if (!allHit(d)) d = addDays(d, -1)
  let n = 0
  while (d >= phase.start_date && allHit(d)) {
    n++
    d = addDays(d, -1)
  }
  return n
}

export function weekTotals(phase, pages, rows) {
  const active = pages.filter(p => p.active !== false)
  const days = phaseDates(phase)
  let posts = 0, planned = 0, engagementMins = 0, hit = 0
  days.forEach((d, i) => {
    active.forEach(p => {
      const row = getRow(rows, p.id, d)
      planned += targetFor(phase, i + 1, p.slug)
      if (row) {
        posts += row.posts || 0
        engagementMins += row.engagement_mins || 0
      }
      if (isHit(phase, p, d, row)) hit++
    })
  })
  return { posts, planned, engagementMins, hit, pageDays: days.length * active.length }
}

// "Xh Ym"
export function formatMins(mins) {
  const m = Math.max(0, Math.round(mins || 0))
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

// ─── Outbox replay ────────────────────────────────────────────────────────────

// Whether a locally queued write should be replayed over the server state.
// Page-days and notes are skipped when the server row changed after the entry
// was queued (another device saved later). Task ticks replay as-is.
// entry: { kind: 'day' | 'note' | 'task', queuedAt: ms }
export function shouldReplay(entry, serverRow) {
  if (entry.kind === 'task') return true
  if (!serverRow?.updated_at) return true
  return Date.parse(serverRow.updated_at) <= entry.queuedAt
}

// ─── Copy ─────────────────────────────────────────────────────────────────────

export const ENGAGEMENT_OPTIONS = [0, 15, 20, 30]

// Setup-week checklist, keyed by day of the phase.
export const SETUP_TASKS = {
  1: { title: 'Foundations', tasks: [
    { key: 'd1c', label: 'Join one Whop campaign each for Streamer, Comedy and Fitness, and read its rules' },
    { key: 'd1d', label: 'Make a folder per page with raw / edited / posted subfolders' },
    { key: 'd1e', label: 'Post 1 to every page and log it' },
  ] },
  2: { title: 'Content bank', tasks: [
    { key: 'd2a', label: 'Stage 5 raw clips per page in its raw folder' },
    { key: 'd2d', label: 'Write one title and caption formula per page' },
  ] },
  3: { title: 'Templates', tasks: [
    { key: 'd3a', label: 'Save an edit template per page (caption font, hook overlay, end card)' },
    { key: 'd3b', label: "Check each Whop campaign's disclosure and link rules" },
    { key: 'd3c', label: 'Get to 12 edited clips per page, enough for Sun and Mon at 3/day' },
  ] },
  4: { title: 'Step up to 3 a day', tasks: [
    { key: 'd4a', label: 'Pick three fixed posting slots and stick to them (e.g. 12:00, 17:00, 21:00)' },
    { key: 'd4b', label: "Batch-edit Monday's 15 clips in one sitting" },
  ] },
  5: { title: 'First review', tasks: [
    { key: 'd5a', label: 'Record views on every post so far; mark the top 2 per page' },
    { key: 'd5b', label: "Reuse the hook style of each page's best post in tomorrow's batch" },
    { key: 'd5c', label: "Batch-edit Tuesday's 15 clips" },
  ] },
  6: { title: 'Week 2 batch', tasks: [
    { key: 'd6a', label: 'Start the week 2 bank: aim for 35 clips per page (5/day)' },
    { key: 'd6c', label: "Batch-edit Wednesday's 15 clips" },
  ] },
  7: { title: 'Week review', tasks: [
    { key: 'd7a', label: 'Write the week review in the check-in box' },
    { key: 'd7b', label: 'Keep, change or cut each page based on views' },
    { key: 'd7c', label: "Set each page's week 2 target (5 to 10 a day) and the posting slots" },
  ] },
}

// Checklist for a day of a phase. Only the setup week has one in part 1.
export function tasksFor(phase, dayNumber) {
  if (phase?.slug !== 'setup-week') return null
  return SETUP_TASKS[dayNumber] || null
}

export const RAMP = [
  { when: 'Days 1–3',                 target: '1/day' },
  { when: 'Days 4–7',                 target: '3/day' },
  { when: 'Week 2, from Thu 22 Oct',  target: '5–10/day' },
]

export const RULES = [
  { title: 'Clip pages (Streamer, Comedy, Fitness)', items: [
    'Whop creator campaign link on every post.',
    'Keep the promo vague and inside the niche.',
    "Follow each campaign's own rules on disclosure and format.",
  ] },
  { title: 'Every page, every day', items: [
    '15–30 min engagement per page: reply, comment in the niche, watch competitors.',
    "Log it before bed. Unlogged means it didn't happen.",
    'Never miss two days in a row on any page.',
  ] },
]

export const SCOREBOARD_FOOTNOTE =
  'A page-day is hit when the posts target is met, engagement is 15 min or more, and, for clip pages, the Whop link went on every post.'

export const CHECKIN_HINT = "Best post, what flopped, what you'll post first tomorrow. Two lines is enough."
