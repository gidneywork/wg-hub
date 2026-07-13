import { supabaseServer } from '../../../lib/supabase-server'
import { resolveUserId } from '../../../lib/auth-server'

// GET /api/audit — fetch audit log with optional filtering
export async function GET(request) {
  try {
    const userId = await resolveUserId(request)
    if (!userId) return Response.json({ error: 'Not signed in' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const type   = searchParams.get('type')
    const search = searchParams.get('search')
    const limit  = parseInt(searchParams.get('limit') || '200')

    let query = supabaseServer
      .from('audit_log')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (type && type !== 'all') query = query.eq('event_type', type)
    if (search) query = query.or(`title.ilike.%${search}%,detail.ilike.%${search}%`)

    const { data, error } = await query
    if (error) throw error

    return Response.json({ entries: data || [] })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/audit — write a new audit entry
export async function POST(request) {
  try {
    const userId = await resolveUserId(request)
    if (!userId) return Response.json({ error: 'Not signed in' }, { status: 401 })

    const body = await request.json()
    const { error } = await supabaseServer.from('audit_log').insert({
      user_id:    userId,
      event_type: body.event_type,
      title:      body.title,
      detail:     body.detail || null,
      metadata:   body.metadata || null,
    })
    if (error) throw error
    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
