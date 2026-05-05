import { redirect } from 'next/navigation'

export async function GET() {
  const clientId     = process.env.STRAVA_CLIENT_ID
  const appUrl       = process.env.NEXT_PUBLIC_APP_URL
  const redirectUri  = `${appUrl}/api/strava/callback`
  const scope        = 'read,activity:read_all'

  const stravaAuthUrl =
    `https://www.strava.com/oauth/authorize` +
    `?client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&approval_prompt=auto` +
    `&scope=${scope}`

  redirect(stravaAuthUrl)
}
