// FC-090 self-test for lib/clipping.js. Run: node --test lib/clipping.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  londonDateKey, addDays, diffDays, formatRange, getPhaseDay, clampDay, pickPhase,
  targetFor, minEngagement, pageDayStatus, streak, weekTotals, formatMins,
  shouldReplay, rowKey, lastCampaign, lastProvider, rulesFor, SETUP_TASKS,
} from './clipping.js'

const PHASE = {
  id: 'ph1', slug: 'setup-week', start_date: '2026-10-15', end_date: '2026-10-21',
  config: {
    ramp: [{ from_day: 1, to_day: 3, posts: 1 }, { from_day: 4, to_day: 7, posts: 3 }],
    min_engagement_mins: 15,
    page_overrides: {},
  },
}
const THEMED = { id: 'p1', slug: 'bodycam', kind: 'themed', monetisation: 'none', active: true }
const CLIP   = { id: 'p2', slug: 'streamer', kind: 'clip', monetisation: 'whop', active: true }
const row = (o = {}) => ({ posts: 0, engagement_mins: 0, provider: null, campaign: null, views: null, ...o })

test('londonDateKey: late evening BST stays on the London day', () => {
  // 23:30 BST on 15 Oct = 22:30 UTC
  assert.equal(londonDateKey(new Date('2026-10-15T22:30:00Z')), '2026-10-15')
  // 00:30 BST on 16 Oct = 23:30 UTC on 15 Oct
  assert.equal(londonDateKey(new Date('2026-10-15T23:30:00Z')), '2026-10-16')
  // After the clocks go back (GMT): 23:30 GMT on 26 Oct
  assert.equal(londonDateKey(new Date('2026-10-26T23:30:00Z')), '2026-10-26')
})

test('day arithmetic across the clock change', () => {
  assert.equal(addDays('2026-10-24', 2), '2026-10-26')
  assert.equal(diffDays('2026-10-22', '2026-10-28'), 6)
  assert.equal(formatRange('2026-10-15', '2026-10-21'), '15–21 Oct')
  assert.equal(formatRange('2026-10-29', '2026-11-04'), '29 Oct – 4 Nov')
})

test('getPhaseDay and clampDay', () => {
  assert.equal(getPhaseDay(PHASE, '2026-10-15'), 1)
  assert.equal(getPhaseDay(PHASE, '2026-10-21'), 7)
  assert.equal(getPhaseDay(PHASE, '2026-10-14'), null)
  assert.equal(getPhaseDay(PHASE, '2026-10-22'), null)
  assert.equal(clampDay(PHASE, '2026-10-01'), 1)
  assert.equal(clampDay(PHASE, '2026-11-01'), 7)
})

test('pickPhase: current, then most recent past, then earliest upcoming', () => {
  const a = { slug: 'a', start_date: '2026-10-01', end_date: '2026-10-07' }
  const b = { slug: 'b', start_date: '2026-10-08', end_date: '2026-10-14' }
  const c = { slug: 'c', start_date: '2026-11-01', end_date: '2026-11-07' }
  assert.equal(pickPhase([a, b, c], '2026-10-10').slug, 'b')
  assert.equal(pickPhase([a, b, c], '2026-10-20').slug, 'b')
  assert.equal(pickPhase([c, b], '2026-09-01').slug, 'b')
})

test('targetFor reads the ramp and page overrides', () => {
  assert.equal(targetFor(PHASE, 1, 'bodycam'), 1)
  assert.equal(targetFor(PHASE, 4, 'bodycam'), 3)
  assert.equal(targetFor(PHASE, 9, 'bodycam'), 0)
  const p = { ...PHASE, config: { ...PHASE.config, page_overrides: { combat: { ramp: [{ from_day: 1, to_day: 7, posts: 2 }], min_engagement_mins: 20 } } } }
  assert.equal(targetFor(p, 1, 'combat'), 2)
  assert.equal(minEngagement(p, 'combat'), 20)
  assert.equal(minEngagement(p, 'bodycam'), 15)
})

test('pageDayStatus edge cases', () => {
  const today = '2026-10-17'
  // hit: target met exactly, engagement exactly at the minimum
  assert.equal(pageDayStatus(PHASE, THEMED, '2026-10-17', row({ posts: 1, engagement_mins: 15 }), today), 'hit')
  // clip page needs a provider
  assert.equal(pageDayStatus(PHASE, CLIP, '2026-10-17', row({ posts: 1, engagement_mins: 15 }), today), 'progress')
  assert.equal(pageDayStatus(PHASE, CLIP, '2026-10-17', row({ posts: 1, engagement_mins: 15, provider: 'Whop' }), today), 'hit')
  // past and logged but under target → short
  assert.equal(pageDayStatus(PHASE, THEMED, '2026-10-16', row({ posts: 1, engagement_mins: 0 }), today), 'short')
  // views alone counts as logged
  assert.equal(pageDayStatus(PHASE, THEMED, '2026-10-16', row({ views: 0 }), today), 'short')
  // past, nothing logged → missed (with and without a row)
  assert.equal(pageDayStatus(PHASE, THEMED, '2026-10-16', row(), today), 'missed')
  assert.equal(pageDayStatus(PHASE, THEMED, '2026-10-16', null, today), 'missed')
  // today, nothing logged → todo; future → todo
  assert.equal(pageDayStatus(PHASE, THEMED, '2026-10-17', null, today), 'todo')
  assert.equal(pageDayStatus(PHASE, THEMED, '2026-10-20', null, today), 'todo')
  // day 4 needs 3 posts
  assert.equal(pageDayStatus(PHASE, THEMED, '2026-10-18', row({ posts: 2, engagement_mins: 30 }), '2026-10-18'), 'progress')
  // outside the phase never hits
  assert.equal(pageDayStatus(PHASE, THEMED, '2026-10-22', row({ posts: 9, engagement_mins: 30 }), '2026-10-22'), 'progress')
})

function rowsFor(entries) {
  const m = new Map()
  entries.forEach(([page, date, r]) => m.set(rowKey(page.id, date), row(r)))
  return m
}
const HIT_T = { posts: 1, engagement_mins: 15 }
const HIT_C = { posts: 1, engagement_mins: 15, provider: 'Whop' }

test('streak counts back from today, or yesterday if today is open', () => {
  const pages = [THEMED, CLIP]
  const rows = rowsFor([
    [THEMED, '2026-10-15', HIT_T], [CLIP, '2026-10-15', HIT_C],
    [THEMED, '2026-10-16', HIT_T], [CLIP, '2026-10-16', HIT_C],
  ])
  // Today 17th not logged → starts at 16th → 2
  assert.equal(streak(PHASE, pages, rows, '2026-10-17'), 2)
  // Today hit too → 3
  rows.set(rowKey(THEMED.id, '2026-10-17'), row(HIT_T))
  rows.set(rowKey(CLIP.id, '2026-10-17'), row(HIT_C))
  assert.equal(streak(PHASE, pages, rows, '2026-10-17'), 3)
  // A gap breaks it
  rows.delete(rowKey(CLIP.id, '2026-10-16'))
  assert.equal(streak(PHASE, pages, rows, '2026-10-17'), 1)
  // Day 1, nothing logged: yesterday is before the phase → 0
  assert.equal(streak(PHASE, pages, new Map(), '2026-10-15'), 0)
  // Inactive pages are ignored
  const r2 = rowsFor([[THEMED, '2026-10-15', HIT_T]])
  assert.equal(streak(PHASE, [THEMED, { ...CLIP, active: false }], r2, '2026-10-15'), 1)
  // After the phase: counts back from the last day
  const r3 = rowsFor([[THEMED, '2026-10-21', { posts: 3, engagement_mins: 15 }]])
  assert.equal(streak(PHASE, [THEMED], r3, '2026-10-25'), 1)
})

test('weekTotals: setup week plans 75 posts over 35 page-days', () => {
  const pages = ['a', 'b', 'c', 'd', 'e'].map((id, i) => ({ id, slug: id, kind: i < 2 ? 'themed' : 'clip', active: true }))
  const rows = new Map([[rowKey('a', '2026-10-15'), row({ posts: 1, engagement_mins: 20 })]])
  const t = weekTotals(PHASE, pages, rows)
  assert.equal(t.planned, 75)
  assert.equal(t.pageDays, 35)
  assert.equal(t.posts, 1)
  assert.equal(t.engagementMins, 20)
  assert.equal(t.hit, 1)
})

test('formatMins', () => {
  assert.equal(formatMins(0), '0h 0m')
  assert.equal(formatMins(95), '1h 35m')
})

test('shouldReplay: skips page-days and notes the server changed later', () => {
  const queuedAt = Date.parse('2026-10-15T21:00:00Z')
  const older = { updated_at: '2026-10-15T20:59:59Z' }
  const newer = { updated_at: '2026-10-15T21:00:01Z' }
  assert.equal(shouldReplay({ kind: 'day', queuedAt }, older), true)
  assert.equal(shouldReplay({ kind: 'day', queuedAt }, newer), false)
  assert.equal(shouldReplay({ kind: 'note', queuedAt }, newer), false)
  assert.equal(shouldReplay({ kind: 'day', queuedAt }, null), true)
  assert.equal(shouldReplay({ kind: 'task', queuedAt }, newer), true)
})

test('setup tasks: 7 days, unique keys', () => {
  const keys = Object.values(SETUP_TASKS).flatMap(d => d.tasks.map(t => t.key))
  assert.equal(Object.keys(SETUP_TASKS).length, 7)
  assert.equal(keys.length, 28)
  assert.equal(new Set(keys).size, keys.length)
  assert.deepEqual(SETUP_TASKS[1].tasks.map(t => t.key), ['d1a', 'd1c', 'd1d', 'd1e', 'd1t', 'd1w'])
  assert.deepEqual(SETUP_TASKS[2].tasks.map(t => t.key), ['d2a', 'd2b', 'd2d', 'd2w'])
  assert.deepEqual(SETUP_TASKS[6].tasks.map(t => t.key), ['d6a', 'd6b', 'd6c', 'd6t'])
})

test('lastCampaign: most recent earlier non-empty value', () => {
  const r = (date, c, page = 'p2') => [rowKey(page, date), { page_id: page, log_date: date, campaign: c }]
  const rows = new Map([
    r('2026-10-15', 'Kick streamer A'),
    r('2026-10-16', '   '),                 // whitespace-only: skipped
    r('2026-10-17', 'Same-day value'),      // same day: ignored
    r('2026-10-18', 'Later value'),         // later: ignored
    r('2026-10-16', 'Other page', 'p9'),    // other page: ignored
  ])
  assert.equal(lastCampaign(rows, 'p2', '2026-10-17'), 'Kick streamer A')
  rows.set(rowKey('p2', '2026-10-16'), { page_id: 'p2', log_date: '2026-10-16', campaign: 'Comedy B' })
  assert.equal(lastCampaign(rows, 'p2', '2026-10-17'), 'Comedy B')
  assert.equal(lastCampaign(rows, 'p2', '2026-10-15'), null)
  assert.equal(lastCampaign(new Map(), 'p2', '2026-10-17'), null)
  assert.equal(lastCampaign(rows, 'p2', '2026-10-19'), 'Later value')
})

test('campaign alone does not count as logged', () => {
  const only = row({ campaign: 'Campaign X' })
  assert.equal(pageDayStatus(PHASE, CLIP, '2026-10-20', only, '2026-10-17'), 'todo')
  assert.equal(pageDayStatus(PHASE, CLIP, '2026-10-16', only, '2026-10-17'), 'missed')
})

test('weekTotals: inactive pages are left out (3 clip pages → 45 planned, 21 page-days)', () => {
  const pages = ['a', 'b', 'c', 'd', 'e'].map((id, i) => ({ id, slug: id, kind: i < 2 ? 'themed' : 'clip', active: i >= 2 }))
  const rows = new Map([
    [rowKey('a', '2026-10-15'), row({ posts: 4, engagement_mins: 30 })],   // inactive page: not counted
    [rowKey('c', '2026-10-15'), row({ posts: 1, engagement_mins: 15, provider: 'Clipit' })],
  ])
  const t = weekTotals(PHASE, pages, rows)
  assert.equal(t.planned, 45)
  assert.equal(t.pageDays, 21)
  assert.equal(t.posts, 1)
  assert.equal(t.engagementMins, 15)
  assert.equal(t.hit, 1)
})

test('provider: hit needs one on clip pages, not on themed pages', () => {
  const today = '2026-10-17'
  const base = { posts: 1, engagement_mins: 15 }
  assert.equal(pageDayStatus(PHASE, CLIP, today, row(base), today), 'progress')
  assert.equal(pageDayStatus(PHASE, CLIP, today, row({ ...base, provider: '   ' }), today), 'progress')
  assert.equal(pageDayStatus(PHASE, CLIP, today, row({ ...base, provider: 'Clipfy' }), today), 'hit')
  assert.equal(pageDayStatus(PHASE, THEMED, today, row(base), today), 'hit')
  // clip pages are decided by kind, not monetisation
  const clipNoWhop = { ...CLIP, monetisation: 'none' }
  assert.equal(pageDayStatus(PHASE, clipNoWhop, today, row(base), today), 'progress')
  // a provider alone counts as logged
  assert.equal(pageDayStatus(PHASE, CLIP, '2026-10-16', row({ provider: 'Whop' }), today), 'short')
})

test('provider: an "Other" free-text provider counts', () => {
  const today = '2026-10-17'
  assert.equal(pageDayStatus(PHASE, CLIP, today, row({ posts: 1, engagement_mins: 15, provider: 'Streamr Pay' }), today), 'hit')
})

test('lastProvider: most recent earlier non-empty value', () => {
  const r = (date, v, page = 'p2') => [rowKey(page, date), { page_id: page, log_date: date, provider: v }]
  const rows = new Map([
    r('2026-10-15', 'Whop'),
    r('2026-10-16', ''),              // empty: skipped
    r('2026-10-17', 'Clipit'),        // same day: ignored
    r('2026-10-18', 'Clipfy'),        // later: ignored
    r('2026-10-16', 'Other co', 'p9'),
  ])
  assert.equal(lastProvider(rows, 'p2', '2026-10-17'), 'Whop')
  assert.equal(lastProvider(rows, 'p2', '2026-10-15'), null)
  assert.equal(lastProvider(new Map(), 'p2', '2026-10-17'), null)
})

test('rulesFor: themed group only when an active themed page exists', () => {
  const titles = pages => rulesFor(pages).map(g => g.title)
  assert.deepEqual(titles([CLIP]), ['Clip pages', 'Every page, every day'])
  assert.deepEqual(titles([THEMED, CLIP]), ['Themed pages', 'Clip pages', 'Every page, every day'])
  assert.deepEqual(titles([{ ...THEMED, active: false }, CLIP]), ['Clip pages', 'Every page, every day'])
})

test('Body Cam back: 1 themed + 4 clip pages → 75 planned, 35 page-days; themed hit needs no provider', () => {
  const pages = [
    { id: 'bc', slug: 'bodycam', kind: 'themed', active: true },
    { id: 'cb', slug: 'combat', kind: 'themed', active: false },
    ...['streamer', 'comedy', 'fitness', 'podcast'].map(slug => ({ id: slug, slug, kind: 'clip', active: true })),
  ]
  const rows = new Map([[rowKey('bc', '2026-10-15'), row({ posts: 1, engagement_mins: 15 })]])
  const t = weekTotals(PHASE, pages, rows)
  assert.equal(t.planned, 75)
  assert.equal(t.pageDays, 35)
  assert.equal(t.hit, 1)
  assert.equal(pageDayStatus(PHASE, pages[0], '2026-10-15', rows.get(rowKey('bc', '2026-10-15')), '2026-10-16'), 'hit')
})
