/**
 * lib/cronometer.js — Cronometer web client (FC-084). Server-only.
 *
 * Cronometer has no public API. This drives the same internal calls its web
 * app uses (GWT-RPC) — confirmed by a signed-in capture on 2026-09-29:
 *   login        GET /login/ (anticsrf) → POST /login (form) → sesnonce cookie
 *   authenticate GWT, validates the session and returns the Cronometer user id
 *   export       GWT generateAuthorizationToken → GET /export?generate=dailySummary
 *                (consumed totals, computed by Cronometer's server; counts
 *                toward Cronometer's 10-exports-a-day limit)
 *   targets      GWT getDailyMacroTargetTemplate (protein, fat, kcal, net carbs)
 *
 * The session (cookie jar) is reused between runs; a fresh login happens only
 * when the stored session is rejected, and never more than once per run.
 *
 * Credentials come only from env (CRONOMETER_USERNAME / CRONOMETER_PASSWORD).
 * Nothing here ever logs, returns or includes in an error message a
 * credential, a cookie or the session nonce — errors carry a stage and an
 * HTTP status only.
 */
import { supabaseServer } from './supabase-server'

const ORIGIN      = 'https://cronometer.com'
const MODULE_BASE = `${ORIGIN}/cronometer/`
const GWT_URL     = `${ORIGIN}/cronometer/app`
const SERVICE     = 'com.cronometer.shared.rpc.CronometerService'
const T_STRING    = 'java.lang.String/2004016611'
const T_DAY       = 'com.cronometer.shared.entries.models.Day/782579793'
const T_AUTHSCOPE = 'com.cronometer.shared.user.AuthScope/2065601159'
const T_INTEGER   = 'java.lang.Integer/3438268394'
const UA          = 'Mozilla/5.0 (Cadence nutrition sync)'

export class CronometerError extends Error {
  constructor(stage, status = null) {
    super(`Cronometer ${stage} failed${status ? ` (${status})` : ''}`)
    this.name   = 'CronometerError'
    this.stage  = stage
    this.status = status
  }
}

// ── London time ──────────────────────────────────────────────────────────────
export function londonParts(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false,
  }).formatToParts(d).map(x => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24 }
}
// Minutes east of UTC for London right now (60 in BST, 0 in GMT) — the value
// the web app sends to authenticate.
export function londonOffsetMinutes(d = new Date()) {
  const name = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', timeZoneName: 'shortOffset' })
    .formatToParts(d).find(x => x.type === 'timeZoneName')?.value || 'GMT'
  const m = /GMT([+-]\d{1,2})(?::(\d{2}))?/.exec(name)
  return m ? Number(m[1]) * 60 + Math.sign(Number(m[1])) * Number(m[2] || 0) : 0
}
export function shiftDate(iso, days) {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ── Schedule and merge rules ─────────────────────────────────────────────────
export const CONSUMED = ['calories', 'protein', 'carbs', 'net_carbs', 'fat', 'fibre']

// Scheduled runs act only at 07, 09, …, 23 London time. pg_cron fires hourly
// on UTC; this check makes the schedule follow BST / GMT automatically.
export function isScheduledHour(hour) {
  return hour >= 7 && hour <= 23 && hour % 2 === 1
}

// Merge one exported day into what is stored. A value missing from the
// export never overwrites a stored one. For today the latest export wins
// (the diary fills through the day); for a past day a zero never overwrites
// a recorded non-zero value.
export function mergeConsumed(incoming, existing, isToday) {
  const out = {}
  for (const k of CONSUMED) {
    const inc = incoming[k], ex = existing?.[k] ?? null
    if (inc == null) out[k] = ex
    else if (!isToday && inc === 0 && ex != null && Number(ex) > 0) out[k] = ex
    else out[k] = inc
  }
  return out
}

// ── Cookie jar ───────────────────────────────────────────────────────────────
function makeJar(initial = {}) {
  const jar = { ...initial }
  return {
    header: () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '),
    absorb: (res) => {
      for (const c of res.headers.getSetCookie?.() || []) {
        const [kv, ...attrs] = c.split(';')
        const i = kv.indexOf('=')
        const name = kv.slice(0, i).trim(), value = kv.slice(i + 1).trim()
        const expired = attrs.some(a => /^\s*max-age=0\s*$/i.test(a)) ||
          attrs.some(a => /^\s*expires=/i.test(a) && new Date(a.split('=').slice(1).join('=')) < new Date())
        if (expired || value === '') delete jar[name]
        else jar[name] = value
      }
    },
    get: (k) => jar[k],
    all: () => ({ ...jar }),
    clear: () => { for (const k of Object.keys(jar)) delete jar[k] },
  }
}

// ── Build values (public; rediscovered every run so a new Cronometer build
//    never leaves stale hashes behind) ────────────────────────────────────────
async function discoverBuild() {
  const noc = await fetch(`${MODULE_BASE}cronometer.nocache.js`, { headers: { 'User-Agent': UA } })
  if (!noc.ok) throw new CronometerError('build discovery', noc.status)
  const permutation = (/='([A-F0-9]{32})'/.exec(await noc.text()) || [])[1]
  if (!permutation) throw new CronometerError('build discovery (permutation)')
  const cache = await fetch(`${MODULE_BASE}${permutation}.cache.js`, { headers: { 'User-Agent': UA } })
  if (!cache.ok) throw new CronometerError('build discovery', cache.status)
  const header = (/'app','([A-F0-9]{32})'/.exec(await cache.text()) || [])[1]
  if (!header) throw new CronometerError('build discovery (serialization header)')
  return { permutation, header }
}

// ── GWT-RPC response helpers ─────────────────────────────────────────────────
// A response is //OK[<data tokens…>,[<string table>],0,7]. //EX means an
// exception (e.g. the session was rejected).
export function gwtStringTable(raw) {
  const end = raw.lastIndexOf('],0,7]')
  const start = raw.lastIndexOf(',[', end)
  if (start < 0 || end < 0) return []
  try { return JSON.parse(raw.slice(start + 1, end + 1)) } catch { return [] }
}
export function gwtTokens(raw) {
  const end = raw.lastIndexOf('],0,7]')
  const start = raw.lastIndexOf(',[', end)
  const data = raw.slice(raw.indexOf('[') + 1, start < 0 ? raw.length : start)
  return data.split(',').map(s => s.trim()).filter(Boolean)
}

// getDailyMacroTargetTemplate: the macro values are the float tokens, in the
// order protein, fat, calories, net carbs. Returns null (never zeros) when the
// shape is not what we expect — the caller then falls back to Cadence targets.
export function parseMacroTargets(raw) {
  if (!raw?.startsWith('//OK[')) return null
  const floats = gwtTokens(raw).filter(t => /^-?\d+\.\d+(E-?\d+)?$/i.test(t)).map(Number)
  if (floats.length < 4) return null
  const [protein, fat, calories, netCarbs] = floats
  if (![protein, fat, calories, netCarbs].every(v => Number.isFinite(v) && v >= 0)) return null
  return { target_protein: protein, target_fat: fat, target_calories: calories, target_net_carbs: netCarbs }
}

// ── Daily-summary CSV ────────────────────────────────────────────────────────
function parseCsv(text) {
  const rows = []; let row = [], field = '', q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') q = false
      else field += ch
    } else if (ch === '"') q = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some(c => c !== '')) rows.push(row)
      row = []
    } else field += ch
  }
  row.push(field)
  if (row.some(c => c !== '')) rows.push(row)
  return rows
}

// Column names as Cronometer labels them. Matched case-insensitively; fibre
// accepts either spelling. A missing required column is a hard error (the
// export format changed) rather than a silent zero.
const COLS = {
  date:      ['date'],
  calories:  ['energy (kcal)'],
  protein:   ['protein (g)'],
  carbs:     ['carbs (g)'],
  net_carbs: ['net carbs (g)'],
  fat:       ['fat (g)'],
  fibre:     ['fiber (g)', 'fibre (g)'],
}
const REQUIRED = ['date', 'calories', 'protein', 'carbs', 'fat']

export function parseDailySummary(csv) {
  const rows = parseCsv(String(csv || ''))
  if (!rows.length) return []
  const header = rows[0].map(h => h.trim().toLowerCase())
  const idx = {}
  for (const [key, names] of Object.entries(COLS)) idx[key] = header.findIndex(h => names.includes(h))
  const missing = REQUIRED.filter(k => idx[k] < 0)
  if (missing.length) {
    const err = new CronometerError('export format (missing columns)')
    err.missing = missing // column keys only — never values
    throw err
  }
  const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null }
  return rows.slice(1).map(r => {
    const out = { date: (r[idx.date] || '').trim() }
    for (const key of ['calories', 'protein', 'carbs', 'net_carbs', 'fat', 'fibre']) out[key] = idx[key] >= 0 ? num(r[idx[key]]) : null
    out.nutrients = Object.fromEntries(rows[0].map((h, i) => [h.trim(), r[i] ?? null]))
    return out
  }).filter(r => /^\d{4}-\d{2}-\d{2}$/.test(r.date))
}

// ── Session ──────────────────────────────────────────────────────────────────
// Opens a Cronometer session for `userId`: reuses the stored cookies when the
// server still accepts them, otherwise logs in ONCE with the env credentials.
// Returns a client with the calls the sync needs.
export async function openSession(userId) {
  const build = await discoverBuild()
  const { data: stored, error } = await supabaseServer
    .from('cronometer_session').select('cookies').eq('user_id', userId).maybeSingle()
  if (error) throw new CronometerError('session read')
  const jar = makeJar(stored?.cookies || {})

  const req = async (url, opts = {}) => {
    const res = await fetch(url, { redirect: 'manual', ...opts, headers: { 'User-Agent': UA, Cookie: jar.header(), ...(opts.headers || {}) } })
    jar.absorb(res)
    return res
  }
  const gwt = async (body) => {
    const res = await req(GWT_URL, { method: 'POST', body, headers: {
      'Content-Type': 'text/x-gwt-rpc; charset=UTF-8', 'X-GWT-Module-Base': MODULE_BASE, 'X-GWT-Permutation': build.permutation,
    } })
    return { status: res.status, text: await res.text() }
  }
  const prefix = (n) => `7|0|${n}|${MODULE_BASE}|${build.header}|${SERVICE}|`
  const authenticate = async () => {
    const r = await gwt(`${prefix(5)}authenticate|${T_INTEGER}|1|2|3|4|1|5|5|${londonOffsetMinutes()}|`)
    const cronId = r.text.startsWith('//OK[') ? (/^\/\/OK\[(\d+),/.exec(r.text) || [])[1] : null
    return cronId || null
  }

  let loggedIn = false
  let cronId = jar.get('sesnonce') ? await authenticate() : null
  if (!cronId) {
    // Fresh login — exactly once. A stale cookie poisons the login page, so
    // start from an empty jar.
    const USER = process.env.CRONOMETER_USERNAME, PASS = process.env.CRONOMETER_PASSWORD
    if (!USER || !PASS) throw new CronometerError('credentials not configured')
    jar.clear()
    const page = await req(`${ORIGIN}/login/`)
    if (!page.ok) throw new CronometerError('login page', page.status)
    const anticsrf = (/name="anticsrf"\s+value="([^"]+)"/.exec(await page.text()) || [])[1]
    if (!anticsrf) throw new CronometerError('login page (anticsrf)')
    const lr = await req(`${ORIGIN}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: ORIGIN, Referer: `${ORIGIN}/login/` },
      body: new URLSearchParams({ anticsrf, username: USER, password: PASS }).toString(),
    })
    let result = null
    try { result = await lr.json() } catch { /* not JSON */ }
    if (!lr.ok || !result || result.error || !(result.success || result.redirect) || !jar.get('sesnonce')) {
      throw new CronometerError('login', lr.status) // never echo the response body
    }
    cronId = await authenticate()
    if (!cronId) throw new CronometerError('authenticate')
    loggedIn = true
  }

  const nonce = () => jar.get('sesnonce')
  const day = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d}|${m}|${y}` }

  return {
    loggedIn,
    // Persist the (possibly refreshed) cookie jar. Service role only.
    async saveSession() {
      const { error: e } = await supabaseServer.from('cronometer_session')
        .upsert({ user_id: userId, cookies: jar.all(), updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      if (e) throw new CronometerError('session save')
    },
    // Daily-summary export for an inclusive date range. ONE export — the
    // caller must have reserved it against the daily budget first.
    async exportDailySummary(startIso, endIso) {
      const t = await gwt(`${prefix(8)}generateAuthorizationToken|${T_STRING}|I|${T_AUTHSCOPE}|${nonce()}|1|2|3|4|4|5|6|6|7|8|${cronId}|3600|7|2|`)
      if (!t.text.startsWith('//OK[')) throw new CronometerError('export token', t.status)
      const token = (/"([^"]+)"/.exec(t.text) || [])[1]
      if (!token) throw new CronometerError('export token')
      const url = `${ORIGIN}/export?` + new URLSearchParams({ nonce: token, generate: 'dailySummary', start: startIso, end: endIso })
      const res = await req(url, { headers: { 'sec-fetch-dest': 'document', 'sec-fetch-mode': 'navigate', 'sec-fetch-site': 'same-origin' } })
      if (!res.ok) throw new CronometerError('export', res.status)
      return parseDailySummary(await res.text())
    },
    // Macro targets for a date, or null when the response is not the expected
    // shape (caller falls back to Cadence's own targets and logs it).
    async macroTargets(iso) {
      const r = await gwt(`${prefix(8)}getDailyMacroTargetTemplate|${T_STRING}|I|${T_DAY}|${nonce()}|1|2|3|4|3|5|6|7|8|${cronId}|7|${day(iso)}|`)
      return { status: r.status, ok: r.text.startsWith('//OK['), targets: parseMacroTargets(r.text) }
    },
  }
}
