import { supabaseServer } from '../../../../lib/supabase-server'
import { resolveUserId } from '../../../../lib/auth-server'

// POST /api/whoop/disconnect
// Removes this user's stored tokens and public connection record. The whoop_data
// table (CSV import) is untouched.
export async function POST(request) {
  try {
    const userId = await resolveUserId(request)
    if (!userId) return Response.json({ error: 'Not signed in' }, { status: 401 })

    await supabaseServer.from('whoop_tokens').delete().eq('user_id', userId)
    await supabaseServer.from('app_settings').delete().eq('user_id', userId).eq('key', 'whoop_connection')
    return Response.json({ disconnected: true })
  } catch {
    // Static message — never echo an error that could carry token material.
    console.error('WHOOP disconnect failed')
    return Response.json({ error: 'Disconnect failed' }, { status: 500 })
  }
}
