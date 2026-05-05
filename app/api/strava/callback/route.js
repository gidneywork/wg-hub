import { redirect } from 'next/navigation'
import { supabaseServer } from '../../../../lib/supabase-server'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const code  = searchParams.get('code')
  const error = searchParams.get('error')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  // User denied access on Strava
  if (error || !code) {
    redirect(`${appUrl}/?strava=denied`)
  }

  try {
    // Exchange code for tokens
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

    if (!tokenData.access_token) {
      console.error('Strava token exchange failed:', tokenData)
      redirect(`${appUrl}/?strava=error`)
    }

    const athlete = tokenData.athlete

    // Store tokens (server-side only, service role bypasses RLS)
    await supabaseServer.from('app_settings').upsert({
      key: 'strava_tokens',
      value: {
        access_token:  tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at:    tokenData.expires_at,  // Unix timestamp
      },
    }, { onConflict: 'key' })

    // Store public connection info (readable client-side)
    await supabaseServer.from('app_settings').upsert({
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
    }, { onConflict: 'key' })

    redirect(`${appUrl}/?strava=connected`)

  } catch (err) {
    console.error('Strava callback error:', err)
    redirect(`${appUrl}/?strava=error`)
  }
}
