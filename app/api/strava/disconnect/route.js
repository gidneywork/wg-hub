import { supabaseServer } from '../../../../lib/supabase-server'
import { resolveUserId } from '../../../../lib/auth-server'

export async function POST(request) {
  try {
    const userId = await resolveUserId(request)
    if (!userId) return Response.json({ error: 'Not signed in' }, { status: 401 })

    // Remove this user's tokens and connection info
    await supabaseServer
      .from('app_settings')
      .delete()
      .eq('user_id', userId)
      .in('key', ['strava_tokens', 'strava_connection'])

    return Response.json({ disconnected: true })
  } catch (err) {
    console.error('Disconnect error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
