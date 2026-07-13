import { supabaseServer } from '../../../../lib/supabase-server'

// POST /api/whoop/disconnect
// Removes the stored tokens and the public connection record. The whoop_data
// table (CSV import) is untouched.
export async function POST() {
  try {
    await supabaseServer.from('whoop_tokens').delete().eq('id', true)
    await supabaseServer.from('app_settings').delete().eq('key', 'whoop_connection')
    return Response.json({ disconnected: true })
  } catch {
    // Static message — never echo an error that could carry token material.
    console.error('WHOOP disconnect failed')
    return Response.json({ error: 'Disconnect failed' }, { status: 500 })
  }
}
