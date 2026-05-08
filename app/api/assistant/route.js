export async function POST(request) {
  try {
    const { messages, systemPrompt } = await request.json()

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':            'application/json',
        'x-api-key':               process.env.ANTHROPIC_API_KEY,
        'anthropic-version':       '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system:     systemPrompt,
        messages,
      }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message || 'API error')

    return Response.json({ reply: data.content?.[0]?.text || 'No response generated.' })

  } catch (err) {
    console.error('Assistant error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
