import { supabaseServer } from '../../../lib/supabase-server'

// POST /api/assistant — proxy to Anthropic Messages API
export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (token) {
      const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token)
      if (authError || !user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const { messages, systemPrompt } = await request.json()
    if (!Array.isArray(messages)) {
      return Response.json({ error: 'messages must be an array' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemPrompt || '',
        messages,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      return Response.json({ error: data?.error?.message || 'Anthropic API error' }, { status: res.status })
    }

    const reply = data.content?.[0]?.text || ''
    return Response.json({ reply })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
