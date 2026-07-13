import { NextResponse } from 'next/server'
import { resolveUserId, buildOAuthState } from '../../../../lib/auth-server'

// GET /api/strava/connect
// Called in-app with the session Bearer token (via apiFetch). Resolves the
// user, mints an OAuth `state` carrying that user id (FC-075a — Strava had no
// state at all before), stashes the state in a short-lived httpOnly cookie for
// CSRF, and returns the authorization URL as JSON. The client performs the
// redirect. The callback reads the user id back out of `state`.
export async function GET(request) {
  const userId = await resolveUserId(request)
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const clientId     = process.env.STRAVA_CLIENT_ID
  const appUrl       = process.env.NEXT_PUBLIC_APP_URL
  const redirectUri  = `${appUrl}/api/strava/callback`
  const scope        = 'read,activity:read_all'
  const state        = buildOAuthState(userId)

  const stravaAuthUrl =
    `https://www.strava.com/oauth/authorize` +
    `?client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&approval_prompt=auto` +
    `&scope=${scope}` +
    `&state=${encodeURIComponent(state)}`

  const res = NextResponse.json({ url: stravaAuthUrl })
  res.cookies.set('strava_oauth_state', state, {
    httpOnly: true,
    secure:   true,
    sameSite: 'lax',
    path:     '/',
    maxAge:   600, // 10 minutes to complete the round-trip
  })
  return res
}
