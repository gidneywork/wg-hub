import { NextResponse } from 'next/server'
import { WHOOP_AUTH_URL, WHOOP_SCOPES } from '../../../../lib/whoop'
import { resolveUserId, buildOAuthState } from '../../../../lib/auth-server'

// GET /api/whoop/connect
// Called in-app with the session Bearer token (via apiFetch). Resolves the user,
// mints a CSRF `state` that ALSO carries the user id (FC-075a), stashes it in a
// short-lived httpOnly cookie, and returns WHOOP's authorization URL as JSON.
// The client performs the redirect; the callback reads the user id from `state`.
export async function GET(request) {
  const userId = await resolveUserId(request)
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const clientId    = process.env.WHOOP_CLIENT_ID
  const appUrl      = process.env.NEXT_PUBLIC_APP_URL
  const redirectUri = `${appUrl}/api/whoop/callback`

  // "<uuid>.<nonce>" — the nonce is the CSRF value (well above WHOOP's 8-char
  // minimum); the uuid tells the callback whose connection this is.
  const state = buildOAuthState(userId)

  const authUrl = `${WHOOP_AUTH_URL}?` + new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         WHOOP_SCOPES,
    state,
  }).toString()

  const res = NextResponse.json({ url: authUrl })
  res.cookies.set('whoop_oauth_state', state, {
    httpOnly: true,
    secure:   true,
    sameSite: 'lax',
    path:     '/',
    maxAge:   600, // 10 minutes to complete the round-trip
  })
  return res
}
