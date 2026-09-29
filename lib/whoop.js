/**
 * lib/whoop.js — shared server-side WHOOP API v2 helpers.
 *
 * Server-only: reads/writes whoop_tokens via the service role. NEVER import
 * this into a client component. Token values are never logged, returned, or
 * echoed — not in errors, not anywhere.
 *
 * Endpoints are the ones verified against the official WHOOP v2 reference:
 * the developer base path composed with /v2/... resource segments, and the
 * OAuth2 auth/token URLs under api.prod.whoop.com/oauth/oauth2.
 */
import { supabaseServer } from './supabase-server'

export const WHOOP_API_BASE  = 'https://api.prod.whoop.com/developer'
export const WHOOP_AUTH_URL  = 'https://api.prod.whoop.com/oauth/oauth2/auth'
export const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token'

// Space-separated per the OAuth spec. `offline` is required to receive a
// refresh token; `read:profile` supplies the display name for the connection
// card. The remaining five are the data resources the probe reads.
export const WHOOP_SCOPES =
  'read:recovery read:cycles read:sleep read:workout read:body_measurement read:profile offline'

// Map a WHOOP token response onto our row shape. `expires_in` is seconds from
// now. WHOOP rotates refresh_token on every refresh; if a response ever omits
// it, keep the previous one rather than nulling the column.
function tokenRowFromResponse(tokenData, previousRefresh = null) {
  const expiresInMs = (Number(tokenData.expires_in) || 0) * 1000
  return {
    id:            true,
    access_token:  tokenData.access_token,
    refresh_token: tokenData.refresh_token || previousRefresh,
    expires_at:    new Date(Date.now() + expiresInMs).toISOString(),
    scope:         tokenData.scope ?? null,
    updated_at:    new Date().toISOString(),
  }
}

// Persist one user's token row (FC-075a: identity is now user_id, via the
// whoop_tokens_user_uniq constraint from B1). The id column and its singleton
// CHECK still exist until B3, so the row keeps id = true — one row per user, all
// with id = true, distinguished by user_id. Throws if a token is missing.
export async function saveWhoopTokens(tokenData, previousRefresh = null, userId) {
  const row = { ...tokenRowFromResponse(tokenData, previousRefresh), user_id: userId }
  if (!row.access_token || !row.refresh_token) {
    throw new Error('WHOOP token response missing access or refresh token')
  }
  const { error } = await supabaseServer
    .from('whoop_tokens')
    .upsert(row, { onConflict: 'user_id' })
  if (error) throw error
}

// Typed token failure. `stage` is where it failed; `reconnect` is true when
// WHOOP rejected the refresh token itself (400/401) — only a reconnect fixes
// that. The message is static: never a response body, never token material.
export class WhoopTokenError extends Error {
  constructor(stage, status = null) {
    super(`WHOOP token ${stage} failed${status ? ` (${status})` : ''}`)
    this.name      = 'WhoopTokenError'
    this.stage     = stage
    this.status    = status
    this.reconnect = status === 400 || status === 401
  }
}

const FRESH_MARGIN_MS = 5 * 60_000
const CLAIM_POLLS     = 6   // a losing claimant re-reads up to 6 times…
const CLAIM_POLL_MS   = 500 // …at 500 ms — ~3 s for the winner to finish

const isFresh = (row) => !!row && new Date(row.expires_at).getTime() > Date.now() + FRESH_MARGIN_MS
const sleep   = (ms) => new Promise(r => setTimeout(r, ms))

async function readTokenRow(userId) {
  const { data, error } = await supabaseServer
    .from('whoop_tokens')
    .select('access_token, refresh_token, expires_at, updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

// Return a valid access token, refreshing (and persisting the rotated refresh
// token) when the stored one is within five minutes of expiry. Returns null
// when WHOOP is not connected. Never logs or returns the token values.
//
// Single-flight (FC-080). WHOOP rotates the refresh token on every refresh, and
// recovery.updated + sleep.updated arrive together — two concurrent refreshes
// with the same token lost the rotation and killed the connection in Jul 2026.
//   1. Claim: bump updated_at only WHERE updated_at is still the value read.
//      The loser makes no WHOOP call; it waits for the winner's token.
//   2. Refresh. On failure, re-read first — if another request already rotated
//      the token, that is not a failure.
//   3. Persist only WHERE refresh_token is still the one used. 0 rows → someone
//      else saved first; re-read and use the stored token.
export async function getValidWhoopToken(userId) {
  if (!userId) return null
  const row = await readTokenRow(userId)
  if (!row) return null
  if (isFresh(row)) return row.access_token

  // 1. Claim the refresh.
  const { data: claimed, error: claimErr } = await supabaseServer
    .from('whoop_tokens')
    .update({ updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('updated_at', row.updated_at)
    .select('user_id')
  if (claimErr) throw claimErr
  if (!claimed?.length) {
    for (let i = 0; i < CLAIM_POLLS; i++) {
      await sleep(CLAIM_POLL_MS)
      const now = await readTokenRow(userId)
      if (isFresh(now)) return now.access_token
    }
    throw new WhoopTokenError('refresh_contended')
  }

  // 2. Refresh. WHOOP's token endpoint is standard form-urlencoded, and the
  // refresh must re-request `offline` to keep receiving a rotated token.
  const res = await fetch(WHOOP_TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: row.refresh_token,
      client_id:     process.env.WHOOP_CLIENT_ID,
      client_secret: process.env.WHOOP_CLIENT_SECRET,
      scope:         'offline',
    }),
  })
  // Never surface the response body — it can carry token material.
  const fresh = res.ok ? await res.json() : null
  if (!fresh?.access_token) {
    const now = await readTokenRow(userId)
    if (now && now.refresh_token !== row.refresh_token && isFresh(now)) return now.access_token
    throw new WhoopTokenError('refresh', res.status)
  }

  // 3. Persist the rotated pair, preserving the old refresh token if WHOOP
  // omitted a new one — only if nobody else has rotated it since we read.
  const { id: _id, ...next } = tokenRowFromResponse(fresh, row.refresh_token)
  const { data: saved, error: saveErr } = await supabaseServer
    .from('whoop_tokens')
    .update(next)
    .eq('user_id', userId)
    .eq('refresh_token', row.refresh_token)
    .select('user_id')
  if (saveErr) throw saveErr
  if (!saved?.length) {
    const now = await readTokenRow(userId)
    if (isFresh(now)) return now.access_token
    throw new WhoopTokenError('save')
  }
  return fresh.access_token
}
