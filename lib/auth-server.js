/**
 * lib/auth-server.js — server-side user resolution for the API routes (FC-075a).
 *
 * The routes run under the service role (which bypasses RLS), so they must
 * resolve WHICH Cadence user they act for by themselves. There are three
 * strategies, one per request origin:
 *   - in-app POST/GET  → resolveUserId(request): the client sends its session
 *     access token as a Bearer header; we validate it against auth.users.
 *   - OAuth callback   → userIdFromState(state): no session reaches a provider
 *     redirect, so the user id rides in the OAuth `state` (set at connect).
 *   - provider webhook → resolveUserByStravaAthlete / resolveUserByWhoopUser:
 *     no session ever; map the provider's own id to a Cadence user via the
 *     stored connection. NO MATCH → return null; the caller drops the event and
 *     never falls back to a default user.
 *
 * Server-only. Never import into a client component.
 */
import { randomBytes } from 'crypto'
import { supabaseServer } from './supabase-server'

// ── In-app: resolve from the Bearer session token ───────────────────────────
export async function resolveUserId(request) {
  const header = request.headers.get('authorization') || ''
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return null
  const { data, error } = await supabaseServer.auth.getUser(token)
  if (error) return null
  return data?.user?.id ?? null
}

// ── OAuth: carry the user id through the `state` param ──────────────────────
// state = "<uuid>.<nonce>". The nonce is the CSRF value stored in the cookie;
// the uuid is the Cadence user the connection belongs to.
export function buildOAuthState(userId) {
  return `${userId}.${randomBytes(16).toString('hex')}`
}
export function userIdFromState(state) {
  if (!state || typeof state !== 'string') return null
  const id = state.split('.')[0]
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null
}

// ── Webhooks: provider id → Cadence user_id (null on no match) ──────────────
export async function resolveUserByStravaAthlete(ownerId) {
  if (ownerId == null) return null
  const { data, error } = await supabaseServer
    .from('app_settings')
    .select('user_id')
    .eq('key', 'strava_connection')
    .filter('value->>athlete_id', 'eq', String(ownerId))
    .maybeSingle()
  if (error) return null
  return data?.user_id ?? null
}

export async function resolveUserByWhoopUser(whoopUserId) {
  if (whoopUserId == null) return null
  const { data, error } = await supabaseServer
    .from('app_settings')
    .select('user_id')
    .eq('key', 'whoop_connection')
    .filter('value->>whoop_user_id', 'eq', String(whoopUserId))
    .maybeSingle()
  if (error) return null
  return data?.user_id ?? null
}
