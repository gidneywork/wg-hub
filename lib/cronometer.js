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
 *   targets      read from the authenticate reply's settings map: the standing
 *                target settings the diary's Targets panel uses (verified live
 *                2026-09-29 against 3000 kcal / 188 / 405 / 70). No extra call.
 *                (getDailyMacroTargetTemplate returns an empty reply for an
 *                account without per-day templates, so it is not used.)
 *   water        GWT getDayInfo (the diary's servings: food id + grams) and
 *                getFood (names). Logged drinks only, not water inside food.
 *                No export cost. Grams of water = ml.
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
import { londonParts, SCHEDULED_HOURS, isScheduledHour } from './cronometer-shared'

// Re-exported so existing server callers keep their imports.
export { londonParts, SCHEDULED_HOURS, isScheduledHour }

const ORIGIN      = 'https://cronometer.com'
const MODULE_BASE = `${ORIGIN}/cronometer/`
const GWT_URL     = `${ORIGIN}/cronometer/app`
const SERVICE     = 'com.cronometer.shared.rpc.CronometerService'
const T_STRING    = 'java.lang.String/2004016611'
const T_AUTHSCOPE = 'com.cronometer.shared.user.AuthScope/2065601159'
const T_DAY       = 'com.cronometer.shared.entries.models.Day/782579793'
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
export const CONSUMED = ['calories', 'protein', 'carbs', 'net_carbs', 'fat', 'fibre', 'water_ml']

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

// Targets from the authenticate reply. Its settings map is serialised as
// string pairs, each value two tokens before its key. Returns null (never
// zeros) unless all four are present and numeric; the caller then falls back
// to Cadence's own targets.
const TARGET_KEYS = {
  target_calories:  'targets.custom.energy.target',
  target_protein:   'targets.fixed.protein',
  target_net_carbs: 'targets.fixed.net.carbs',
  target_fat:       'targets.fixed.fats',
}
export function parseAuthTargets(raw) {
  if (!raw?.startsWith('//OK[')) return null
  const table = gwtStringTable(raw), tokens = gwtTokens(raw)
  const out = {}
  for (const [field, key] of Object.entries(TARGET_KEYS)) {
    const ref = table.indexOf(key) + 1
    if (!ref) return null
    const p = tokens.indexOf(String(ref))
    const valueRef = p >= 2 ? Number(tokens[p - 2]) : NaN
    const v = Number(table[valueRef - 1])
    if (!Number.isFinite(v) || v < 0) return null
    out[field] = v
  }
  return out
}

// ── Logged water (FC-084) ─────────────────────────────────────────────────────
// getDayInfo servings: each Serving's food id and grams sit just before the
// Cronometer user id in its token run (layout confirmed live 2026-09-29).
export function parseServings(raw, cronId) {
  if (!raw?.startsWith('//OK[')) return null
  const table = gwtStringTable(raw), tokens = gwtTokens(raw)
  const ref = table.findIndex(v => v.startsWith('com.cronometer.shared.entries.models.Serving/')) + 1
  if (!ref) return [] // a day with no servings
  // A plain number can equal the type ref, so each user-id anchor is claimed
  // once: a stray match never re-counts the previous serving.
  const out = [], claimed = new Set()
  tokens.forEach((t, p) => {
    if (t !== String(ref)) return
    const start = Math.max(0, p - 16)
    const ui = tokens.slice(start, p).lastIndexOf(String(cronId))
    if (ui < 2) return
    const anchor = start + ui
    if (claimed.has(anchor)) return
    const foodId = tokens[anchor - 2], grams = Number(tokens[anchor - 1])
    if (/^\d+$/.test(foodId) && Number.isFinite(grams) && grams >= 0) { claimed.add(anchor); out.push({ foodId, grams }) }
  })
  return out
}

// getFood: the food's display name follows the locale strings in the string
// table ("en", "English", then a flag-image URL, then "<name>" — live layout).
// Takes the first string after "English" that isn't a URL, a type name or a
// two-letter locale code. Null when not found.
export function foodNameFrom(raw) {
  if (!raw?.startsWith('//OK[')) return null
  const table = gwtStringTable(raw)
  const i = table.indexOf('English')
  if (i < 0) return null
  const name = table.slice(i + 1).find(v => typeof v === 'string' && v.trim() &&
    !/^https?:/i.test(v) && !/^(com|java)\./.test(v) && !/^[a-z]{2}$/.test(v))
  return name ? name.trim() : null
}

// Approved rule: "Water", "Water, …" (e.g. "Water, tap"), or a brand's plain
// water ("Brand, Sparkling Water"). Water as an ingredient never counts
// ("Tuna Steak in Spring Water", "Coconut Water", "Watermelon").
const PLAIN_WATER = /^((still|sparkling|mineral|spring|tap|bottled|filtered|carbonated|natural)\s+)*water$/i
export function isWaterFoodName(name) {
  const n = String(name || '').trim()
  if (!n) return false
  if (/^water\s*(,|\(|$)/i.test(n)) return true
  const product = n.includes(',') ? n.slice(n.lastIndexOf(',') + 1).trim() : n
  return PLAIN_WATER.test(product)
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
  let authRaw = null // the latest authenticate reply (carries the target settings)
  const authenticate = async () => {
    const r = await gwt(`${prefix(5)}authenticate|${T_INTEGER}|1|2|3|4|1|5|5|${londonOffsetMinutes()}|`)
    const cronId = r.text.startsWith('//OK[') ? (/^\/\/OK\[(\d+),/.exec(r.text) || [])[1] : null
    if (cronId) authRaw = r.text
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
    // Logged water for a date, in ml. `known` maps food id → water verdict
    // (cached between runs); new verdicts come back in `verdicts`. A food
    // whose name can't be read is treated as not water and is not cached, so
    // it is retried next run. Throws CronometerError('water') if the diary
    // call fails.
    async loggedWater(iso, known = {}) {
      const [y, m, d] = iso.split('-').map(Number)
      const r = await gwt(`${prefix(8)}getDayInfo|${T_STRING}|${T_DAY}|I|${nonce()}|1|2|3|4|3|5|6|7|8|6|${d}|${m}|${y}|${cronId}|`)
      const servings = parseServings(r.text, cronId)
      if (!servings) throw new CronometerError('water', r.status)
      const verdicts = {}
      let ml = 0
      for (const s of servings) {
        let isWater = known[s.foodId] ?? verdicts[s.foodId]
        if (isWater == null) {
          const f = await gwt(`${prefix(7)}getFood|${T_STRING}|I|${nonce()}|1|2|3|4|2|5|6|7|${s.foodId}|`)
          const name = foodNameFrom(f.text)
          if (name != null) { isWater = isWaterFoodName(name); verdicts[s.foodId] = isWater }
        }
        if (isWater) ml += s.grams
      }
      return { ml: Math.round(ml * 10) / 10, verdicts }
    },
    // The standing macro targets, from this run's authenticate reply (no extra
    // call). Null when not readable; the caller falls back and logs it.
    targets() {
      return parseAuthTargets(authRaw)
    },
  }
}
