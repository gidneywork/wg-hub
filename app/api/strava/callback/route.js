import { NextResponse } from 'next/server'
import { supabaseServer } from '../../../../lib/supabase-server'
import { userIdFromState } from '../../../../lib/auth-server'

export async function GET(request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const { searchParams } = new URL(request.url)
  const code          = searchParams.get('code')
  const error         = searchParams.get('error')
  const returnedState = searchParams.get('state')
  const storedState   = request.cookies.get('strava_oauth_state')?.value

  // Compute one outcome, redirect once at the end, and always clear the cookie.
  let outcome = 'connected'

  if (error || !code) {
    outcome = 'denied'
  } else if (!returnedState || !storedState || returnedState !== storedState) {
    // CSRF / no user context — fail closed. Never fall back to a default user.
    outcome = 'error'
  } else {
    const userId = userIdFromState(returnedState)
    if (!userId) {
      outcome = 'error'
    } else {
      try {
        const tokenRes = await fetch('https://www.strava.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id:     process.env.STRAVA_CLIENT_ID,
            client_secret: process.env.STRAVA_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
          }),
        })
        const tokenData = await tokenRes.json()
        if (!tokenData.access_token) throw new Error('token exchange returned no access token')

        const athlete = tokenData.athlete

        // Tokens (server-side only). Scoped to this user (FC-075a).
        await supabaseServer.from('app_settings').upsert({
          user_id: userId,
          key: 'strava_tokens',
          value: {
            access_token:  tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at:    tokenData.expires_at,  // Unix timestamp
          },
        }, { onConflict: 'user_id,key' })

        // Public connection info. athlete_id is the key the webhook maps back to
        // this user, so it must be stored.
        await supabaseServer.from('app_settings').upsert({
          user_id: userId,
          key: 'strava_connection',
          value: {
            athlete_id:      athlete.id,
            athlete_name:    `${athlete.firstname} ${athlete.lastname}`,
            athlete_city:    athlete.city || '',
            athlete_country: athlete.country || '',
            profile_pic:     athlete.profile_medium || '',
            connected_at:    new Date().toISOString(),
            last_synced_at:  null,
            activity_count:  0,
          },
        }, { onConflict: 'user_id,key' })
      } catch (err) {
        console.error('Strava callback error:', err)
        outcome = 'error'
      }
    }
  }

  const res = NextResponse.redirect(`${appUrl}/?strava=${outcome}`)
  res.cookies.set('strava_oauth_state', '', { path: '/', maxAge: 0 })
  return res
}
