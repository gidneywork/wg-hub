import { NextResponse } from 'next/server'
import { supabaseServer } from '../../../../lib/supabase-server'
import { saveWhoopTokens, WHOOP_API_BASE, WHOOP_TOKEN_URL } from '../../../../lib/whoop'
import { userIdFromState } from '../../../../lib/auth-server'

// GET /api/whoop/callback
// OAuth redirect target. Validates the CSRF `state` against the cookie,
// exchanges the code for tokens, stores them (server-side, service role), and
// records non-secret connection info in app_settings.
//
// The outcome is computed here and used in a SINGLE redirect returned at the
// end — redirect() is never called mid-flow inside a try/catch (that footgun
// swallows the success redirect; see the WH-001a audit).
export async function GET(request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const { searchParams } = new URL(request.url)
  const code          = searchParams.get('code')
  const error         = searchParams.get('error')
  const returnedState = searchParams.get('state')
  const storedState   = request.cookies.get('whoop_oauth_state')?.value

  let outcome = 'connected'

  if (error || !code) {
    outcome = 'denied'
  } else if (!returnedState || !storedState || returnedState !== storedState) {
    // CSRF check failed — do not exchange the code.
    outcome = 'error'
  } else if (!userIdFromState(returnedState)) {
    // No user context in the state — fail closed. Never a default user.
    outcome = 'error'
  } else {
    const userId = userIdFromState(returnedState)
    try {
      const tokenRes = await fetch(WHOOP_TOKEN_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type:    'authorization_code',
          code,
          client_id:     process.env.WHOOP_CLIENT_ID,
          client_secret: process.env.WHOOP_CLIENT_SECRET,
          redirect_uri:  `${appUrl}/api/whoop/callback`,
        }),
      })
      // Never surface the response body — it can carry token material.
      if (!tokenRes.ok) throw new Error(`token exchange failed (${tokenRes.status})`)

      const tokenData = await tokenRes.json()
      if (!tokenData.access_token) throw new Error('token exchange returned no access token')

      await saveWhoopTokens(tokenData, null, userId)

      // Non-secret connection info for the Settings card. The display name
      // comes from read:profile; a failure here is cosmetic, not fatal. The
      // WHOOP user_id is NOT cosmetic — it is the key the webhook maps back to
      // this Cadence user (FC-075a). Without it, this user's webhooks can't be
      // routed and get dropped.
      const connection = { connected_at: new Date().toISOString(), last_probe_at: null, whoop_user_id: null }
      try {
        const profRes = await fetch(`${WHOOP_API_BASE}/v2/user/profile/basic`, {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        })
        if (profRes.ok) {
          const prof = await profRes.json()
          connection.first_name    = prof.first_name ?? null
          connection.last_name     = prof.last_name  ?? null
          connection.whoop_user_id = prof.user_id ?? null
        }
      } catch { /* name is cosmetic; whoop_user_id best-effort here */ }

      await supabaseServer
        .from('app_settings')
        .upsert({ user_id: userId, key: 'whoop_connection', value: connection }, { onConflict: 'user_id,key' })
    } catch {
      // Static message only — no error object, which could echo token material.
      console.error('WHOOP callback: token exchange failed')
      outcome = 'error'
    }
  }

  const res = NextResponse.redirect(`${appUrl}/?whoop=${outcome}`)
  res.cookies.set('whoop_oauth_state', '', { path: '/', maxAge: 0 })
  return res
}
