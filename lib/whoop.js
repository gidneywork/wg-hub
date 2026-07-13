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

// Persist the single token row (upsert on the singleton id). Throws if the
// resulting row would be missing either token.
export async function saveWhoopTokens(tokenData, previousRefresh = null) {
  const row = tokenRowFromResponse(tokenData, previousRefresh)
  if (!row.access_token || !row.refresh_token) {
    throw new Error('WHOOP token response missing access or refresh token')
  }
  const { error } = await supabaseServer
    .from('whoop_tokens')
    .upsert(row, { onConflict: 'id' })
  if (error) throw error
}

// Return a valid access token, refreshing (and persisting the rotated refresh
// token) when the stored one is within five minutes of expiry. Returns null
// when WHOOP is not connected. Never logs or returns the token values.
export async function getValidWhoopToken() {
  const { data, error } = await supabaseServer
    .from('whoop_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('id', true)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  const expiresMs = new Date(data.expires_at).getTime()
  if (expiresMs > Date.now() + 5 * 60_000) return data.access_token

  // Expired or nearly — refresh. WHOOP's token endpoint is standard
  // form-urlencoded, and the refresh must re-request `offline` to keep
  // receiving a rotated refresh token.
  const res = await fetch(WHOOP_TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: data.refresh_token,
      client_id:     process.env.WHOOP_CLIENT_ID,
      client_secret: process.env.WHOOP_CLIENT_SECRET,
      scope:         'offline',
    }),
  })
  // Never surface the response body — it can carry token material.
  if (!res.ok) throw new Error(`WHOOP token refresh failed (${res.status})`)

  const fresh = await res.json()
  if (!fresh.access_token) throw new Error('WHOOP token refresh returned no access token')

  // Persist the rotated pair, preserving the old refresh token if WHOOP
  // omitted a new one. This is the line that keeps the integration alive.
  await saveWhoopTokens(fresh, data.refresh_token)
  return fresh.access_token
}
