import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { WHOOP_AUTH_URL, WHOOP_SCOPES } from '../../../../lib/whoop'

// GET /api/whoop/connect
// Kicks off the WHOOP OAuth flow. Generates a CSRF `state`, stashes it in a
// short-lived httpOnly cookie, and redirects to WHOOP's authorization URL.
export async function GET() {
  const clientId    = process.env.WHOOP_CLIENT_ID
  const appUrl      = process.env.NEXT_PUBLIC_APP_URL
  const redirectUri = `${appUrl}/api/whoop/callback`

  // 32 hex chars — comfortably above WHOOP's 8-character minimum.
  const state = randomBytes(16).toString('hex')

  const authUrl = `${WHOOP_AUTH_URL}?` + new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         WHOOP_SCOPES,
    state,
  }).toString()

  const res = NextResponse.redirect(authUrl)
  res.cookies.set('whoop_oauth_state', state, {
    httpOnly: true,
    secure:   true,
    sameSite: 'lax',
    path:     '/',
    maxAge:   600, // 10 minutes to complete the round-trip
  })
  return res
}
