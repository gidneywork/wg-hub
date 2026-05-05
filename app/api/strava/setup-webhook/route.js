// ── GET /api/strava/setup-webhook ─────────────────────────────────────────────
// Visit this URL once in your browser after deploying to register the webhook.
// Safe to call multiple times — it checks first and won't create duplicates.

export async function GET() {
  const clientId     = process.env.STRAVA_CLIENT_ID
  const clientSecret = process.env.STRAVA_CLIENT_SECRET
  const appUrl       = process.env.NEXT_PUBLIC_APP_URL
  const verifyToken  = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN
  const callbackUrl  = `${appUrl}/api/strava/webhook`

  // ── Check if already registered ─────────────────────────────────────────────
  const checkRes = await fetch(
    `https://www.strava.com/api/v3/push_subscriptions` +
    `?client_id=${clientId}&client_secret=${clientSecret}`
  )
  const existing = await checkRes.json()

  if (Array.isArray(existing) && existing.length > 0) {
    return Response.json({
      status:  'already_active',
      message: 'Webhook already registered — activities will sync automatically.',
      details: existing[0],
    })
  }

  // ── Register new subscription ────────────────────────────────────────────────
  const res = await fetch('https://www.strava.com/api/v3/push_subscriptions', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     clientId,
      client_secret: clientSecret,
      callback_url:  callbackUrl,
      verify_token:  verifyToken,
    }),
  })

  const data = await res.json()

  if (data.id) {
    return Response.json({
      status:  'registered',
      message: `Webhook live. Subscription ID: ${data.id}. Activities will now sync within ~30 seconds of upload.`,
      details: data,
    })
  }

  return Response.json({
    status:  'error',
    message: 'Registration failed — check your env variables.',
    details: data,
  }, { status: 400 })
}
