import { supabaseServer } from '../../../../lib/supabase-server'

export async function POST() {
  try {
    // Remove tokens and connection info
    await supabaseServer
      .from('app_settings')
      .delete()
      .in('key', ['strava_tokens', 'strava_connection'])

    return Response.json({ disconnected: true })
  } catch (err) {
    console.error('Disconnect error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
