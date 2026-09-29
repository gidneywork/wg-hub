/**
 * lib/cronometer-shared.js — Cronometer sync rules shared by server and
 * browser (FC-084). Pure: no Supabase, no network, no secrets.
 *
 * The London clock, the schedule, the export budget and the wording of the
 * sync status live here once, so the sync route and the refresh control can
 * never disagree about them.
 */

// ── London time ──────────────────────────────────────────────────────────────
export function londonParts(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d).map(x => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24, minute: Number(p.minute) }
}

const pad = n => String(n).padStart(2, '0')

// ── Schedule ─────────────────────────────────────────────────────────────────
// Scheduled runs at 07, 10, 13, 16, 19 and 22 London time (6 a day).
export const SCHEDULED_HOURS = [7, 10, 13, 16, 19, 22]
export function isScheduledHour(hour) {
  return SCHEDULED_HOURS.includes(hour)
}
// The next scheduled run after `now`, as "HH:MM" London time (tomorrow's
// first run once today's last has passed).
export function nextScheduledTime(now = new Date()) {
  const { hour } = londonParts(now)
  const next = SCHEDULED_HOURS.find(h => h > hour) ?? SCHEDULED_HOURS[0]
  return `${pad(next)}:00`
}

// ── Export budget ────────────────────────────────────────────────────────────
// Cronometer allows 10 exports a day. Scheduled runs (6) and manual refreshes
// (up to 4) share it. Counts are kept per London date on cronometer_connection.
export const EXPORT_LIMIT_DAILY = 10
export const MANUAL_LIMIT_DAILY = 4

export function exportsUsed(conn, londonDate) {
  return conn?.exports_day === londonDate ? (conn.exports_used || 0) : 0
}
export function manualUsed(conn, londonDate) {
  return conn?.exports_day === londonDate ? (conn.manual_used || 0) : 0
}
// Manual refreshes left today: capped at 4, and never past the daily 10.
export function refreshesLeft(conn, londonDate) {
  return Math.max(0, Math.min(MANUAL_LIMIT_DAILY - manualUsed(conn, londonDate), EXPORT_LIMIT_DAILY - exportsUsed(conn, londonDate)))
}

// ── Status wording ───────────────────────────────────────────────────────────
// Failing when the latest error is newer than the latest successful sync
// (same rule as the WHOOP card, FC-080).
export function isFailing(conn) {
  const e = conn?.last_error
  if (!e?.at) return false
  return !conn.last_synced_at || new Date(e.at) > new Date(conn.last_synced_at)
}

export function failureReason(stage) {
  const s = String(stage || '')
  if (s === 'login' || s.startsWith('login') || s === 'credentials not configured' || s === 'authenticate') return 'Cronometer sign-in failed'
  if (s.startsWith('export format')) return 'Cronometer’s export format changed'
  if (s.startsWith('export')) return 'Cronometer export failed'
  return 'Cronometer unavailable'
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// "HH:MM" when `iso` is today in London, else "28 Sep 22:00".
export function londonStamp(iso, now = new Date()) {
  if (!iso) return null
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return null
  const hm = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
  if (londonParts(d).date === londonParts(now).date) return hm
  // Fixed three-letter months: en-GB Intl now abbreviates September "Sept".
  const [, m, day] = londonParts(d).date.split('-').map(Number)
  return `${day} ${MONTHS[m - 1]} ${hm}`
}

// Everything the refresh control and the Settings card show.
export function syncStatus(conn, now = new Date()) {
  const today = londonParts(now).date
  const left = refreshesLeft(conn, today)
  const synced = londonStamp(conn?.last_synced_at, now)
  const leftText = `${left} ${left === 1 ? 'refresh' : 'refreshes'} left today`
  const failing = isFailing(conn)
  return {
    left,
    spent: left === 0,
    failing,
    line: left === 0
      ? `No refreshes left today · next sync ${nextScheduledTime(now)}`
      : synced ? `Synced ${synced} · ${leftText}` : `Not synced yet · ${leftText}`,
    error: failing ? `Sync failed ${londonStamp(conn.last_error.at, now)} · ${failureReason(conn.last_error.stage)}` : null,
  }
}
