/**
 * lib/whoop-ingest.js — WHOOP v2 → whoop_data ingest core (WH-001b).
 *
 * Server-only. Shared by /api/whoop/backfill and /api/whoop/webhook. Writes
 * ONLY to whoop_data. Never touches daily_logs, the CSV importer, workouts, or
 * body_measurement. Never logs a token.
 *
 * The join is recovery-anchored, per the locked date rule:
 *   recovery.sleep_id → the night sleep → local date of sleep.end
 *   recovery.cycle_id → the cycle (strain, energy)
 * Naps are never reached (we only follow recovery.sleep_id) and are skipped +
 * counted defensively if one ever appears.
 */
import { supabaseServer } from './supabase-server'
import { WHOOP_API_BASE } from './whoop'

// Data columns merged on upsert. `date` is the conflict key; `source` and
// `uploaded_at` are set explicitly on write, not merged.
const DATA_COLS = [
  'recovery_score', 'rhr', 'hrv', 'skin_temp', 'blood_oxygen',
  'day_strain', 'energy_burned', 'sleep_score', 'hours_slept',
  'deep_sleep_mins', 'rem_sleep_mins', 'light_sleep_mins',
  'sleep_efficiency', 'sleep_consistency', 'respiratory_rate',
  'bed_time', 'wake_time',
]

// ── Local-time helpers ───────────────────────────────────────────────────────
// WHOOP sends timezone_offset as "+HH:MM"/"-HH:MM", and as "Z" (UTC) on older
// records. Returns offset minutes, or null if unparseable (caller skips).
function offsetMinutes(offset) {
  if (!offset || offset === 'Z') return 0
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(offset)
  if (!m) return null
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]))
}
// Shift a UTC instant by the offset so the resulting Date's UTC fields read as
// the local wall clock. Returns null (not an Invalid Date) on any bad input.
function shiftToLocal(iso, offset) {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return null
  const om = offsetMinutes(offset)
  if (om == null) return null
  const d = new Date(t + om * 60000)
  return Number.isNaN(d.getTime()) ? null : d
}
function localDate(iso, offset) {
  const d = shiftToLocal(iso, offset)
  return d ? d.toISOString().slice(0, 10) : null
}
function localHHMM(iso, offset) {
  const d = shiftToLocal(iso, offset)
  return d ? d.toISOString().slice(11, 16) : null
}
const round  = (v) => (v == null ? null : Math.round(v))
const round2 = (v) => (v == null ? null : Math.round(v * 100) / 100)

// ── Pagination ───────────────────────────────────────────────────────────────
// Pages a v2 collection to exhaustion, following next_token. `basePath` may
// already carry query params (start/end); limit=25 is added if absent. The
// same query params ride along with nextToken on each page.
export async function fetchAllPages(basePath, token, { maxPages = 200 } = {}) {
  const sep = basePath.includes('?') ? '&' : '?'
  const path = basePath.includes('limit=') ? basePath : `${basePath}${sep}limit=25`
  const records = []
  let nextToken = null
  let pages = 0
  do {
    const url = WHOOP_API_BASE + path + (nextToken ? `&nextToken=${encodeURIComponent(nextToken)}` : '')
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error(`WHOOP request failed (${res.status})`) // no token in message
    const body = await res.json()
    if (Array.isArray(body.records)) records.push(...body.records)
    nextToken = body.next_token || null
    pages++
  } while (nextToken && pages < maxPages)
  if (nextToken && pages >= maxPages) {
    // Surface a capped page walk rather than silently truncating history.
    console.warn(`WHOOP paging hit maxPages=${maxPages}; results may be partial`)
  }
  return records
}

function indexById(records) {
  const map = {}
  for (const r of records) map[r.id] = r
  return map
}

// ── Row builder ──────────────────────────────────────────────────────────────
// Recovery-anchored. Returns rows plus skip counters. Open cycles (cycle.end
// === null, or no cycle) withhold day_strain and energy_burned — they fill in
// on a later sync once the cycle closes.
export function buildRows(recoveries, sleepById, cycleById) {
  const rows = []
  let skippedNoSleep = 0, skippedNap = 0, skippedNoDate = 0
  for (const rec of recoveries) {
    const sleep = sleepById[rec.sleep_id]
    if (!sleep) { skippedNoSleep++; continue }
    if (sleep.nap === true) { skippedNap++; continue } // defensive — must never happen
    const offset = sleep.timezone_offset
    const date = localDate(sleep.end, offset)
    if (!date) { skippedNoDate++; continue }

    const rScore = rec.score || {}
    const sScore = sleep.score || {}
    const stages = sScore.stage_summary || {}
    const cycle  = cycleById[rec.cycle_id]
    const cScore = cycle?.score || {}
    const cycleOpen = !cycle || cycle.end == null // withhold strain/energy while open

    const inBed = stages.total_in_bed_time_milli
    const awake = stages.total_awake_time_milli
    const hoursSlept = (inBed != null && awake != null)
      ? round2((inBed - awake) / 3_600_000)
      : null

    rows.push({
      date,
      recovery_score:    rScore.recovery_score ?? null,
      rhr:               round(rScore.resting_heart_rate),
      hrv:               round(rScore.hrv_rmssd_milli), // TASK 1: straight map, round only
      skin_temp:         rScore.skin_temp_celsius ?? null,
      blood_oxygen:      rScore.spo2_percentage ?? null,
      day_strain:        cycleOpen ? null : (cScore.strain ?? null),
      energy_burned:     cycleOpen ? null : (cScore.kilojoule != null ? Math.round(cScore.kilojoule / 4.184) : null),
      sleep_score:       sScore.sleep_performance_percentage ?? null,
      hours_slept:       hoursSlept,
      deep_sleep_mins:   stages.total_slow_wave_sleep_time_milli != null ? Math.round(stages.total_slow_wave_sleep_time_milli / 60_000) : null,
      rem_sleep_mins:    stages.total_rem_sleep_time_milli       != null ? Math.round(stages.total_rem_sleep_time_milli       / 60_000) : null,
      light_sleep_mins:  stages.total_light_sleep_time_milli     != null ? Math.round(stages.total_light_sleep_time_milli     / 60_000) : null,
      sleep_efficiency:  sScore.sleep_efficiency_percentage  ?? null,
      sleep_consistency: sScore.sleep_consistency_percentage ?? null,
      respiratory_rate:  sScore.respiratory_rate ?? null,
      bed_time:          localHHMM(sleep.start, offset),
      wake_time:         localHHMM(sleep.end, offset),
    })
  }
  return { rows, skippedNoSleep, skippedNap, skippedNoDate }
}

// Non-null-wins merge of two rows (a over b). THE no-null-clobber rule.
function mergeRow(a, b) {
  const out = { ...b }
  for (const k of Object.keys(a)) out[k] = a[k] != null ? a[k] : b[k]
  return out
}

// ── Merge + upsert ───────────────────────────────────────────────────────────
// Reads existing rows for the incoming dates and merges column-by-column with
// `incoming ?? existing` — a null from WHOOP NEVER overwrites an existing
// value. Idempotent: a second run changes nothing but uploaded_at.
export async function mergeAndUpsert(rows, userId) {
  if (!rows.length) return { upserted: 0, dates: [] }

  // Collapse any same-date incoming rows first (defensive; also avoids a
  // duplicate-key error in a single upsert batch).
  const incomingByDate = {}
  for (const r of rows) {
    const prev = incomingByDate[r.date]
    incomingByDate[r.date] = prev ? mergeRow(r, prev) : r
  }
  const dates = Object.keys(incomingByDate)

  // Read only THIS user's existing rows (FC-075a) so a no-null-clobber merge
  // never reads across users.
  const { data: existingRows, error } = await supabaseServer
    .from('whoop_data').select('*').eq('user_id', userId).in('date', dates)
  if (error) throw error
  const existingByDate = {}
  for (const r of (existingRows || [])) existingByDate[r.date] = r

  const nowIso = new Date().toISOString()
  const merged = dates.map(date => {
    const inc = incomingByDate[date]
    const ex  = existingByDate[date] || {}
    const out = { user_id: userId, date }
    for (const col of DATA_COLS) out[col] = inc[col] != null ? inc[col] : (ex[col] ?? null)
    out.source = 'whoop_api'      // API is now the primary path for this date
    out.uploaded_at = nowIso      // the only non-idempotent field (metadata)
    return out
  })

  const { error: upErr } = await supabaseServer
    .from('whoop_data').upsert(merged, { onConflict: 'user_id,date' })
  if (upErr) throw upErr
  return { upserted: merged.length, dates }
}

// ── Orchestration ────────────────────────────────────────────────────────────
async function ingestRecords(recoveries, sleeps, cycles, userId) {
  const { rows, skippedNoSleep, skippedNap, skippedNoDate } =
    buildRows(recoveries, indexById(sleeps), indexById(cycles))
  const { upserted, dates } = await mergeAndUpsert(rows, userId)
  const sorted = dates.slice().sort()
  return {
    fetched: { recoveries: recoveries.length, sleeps: sleeps.length, cycles: cycles.length },
    upserted,
    skippedNoSleep, skippedNap, skippedNoDate,
    dateRange: sorted.length ? [sorted[0], sorted[sorted.length - 1]] : null,
  }
}

// Full-history backfill. Pages every resource to exhaustion.
export async function ingestFromWhoop(token, userId, { maxPages = 200 } = {}) {
  const [recoveries, sleeps, cycles] = await Promise.all([
    fetchAllPages('/v2/recovery',        token, { maxPages }),
    fetchAllPages('/v2/activity/sleep',  token, { maxPages }),
    fetchAllPages('/v2/cycle',           token, { maxPages }),
  ])
  return ingestRecords(recoveries, sleeps, cycles, userId)
}

// Windowed re-ingest for webhooks — a bounded recent slice, same join+merge.
export async function ingestWindow(token, userId, days = 7) {
  const end   = new Date()
  const start = new Date(end.getTime() - days * 86_400_000)
  const win = `?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}&limit=25`
  const [recoveries, sleeps, cycles] = await Promise.all([
    fetchAllPages('/v2/recovery'       + win, token, { maxPages: 10 }),
    fetchAllPages('/v2/activity/sleep' + win, token, { maxPages: 10 }),
    fetchAllPages('/v2/cycle'          + win, token, { maxPages: 10 }),
  ])
  return ingestRecords(recoveries, sleeps, cycles, userId)
}
