import crypto from 'crypto'
import { getValidWhoopToken } from '../../../../lib/whoop'
import { ingestWindow } from '../../../../lib/whoop-ingest'
import { resolveUserByWhoopUser } from '../../../../lib/auth-server'

// POST /api/whoop/webhook
//
// WHOOP v2 webhook receiver. Validates the HMAC-SHA256 signature over the RAW
// request body, then re-ingests a bounded recent window (recovery-anchored
// join preserved). Writes only to whoop_data.
//
// Raw-body trap: the signature is computed over the exact bytes WHOOP sent, so
// we read request.text() ONCE and hash that — never request.json(), which
// would reparse and could reorder the bytes.
//
// v2 event set: recovery.updated/deleted, sleep.updated/deleted,
// workout.updated/deleted. There is NO cycle.updated in v2 — cycle data flows
// in via the recovery/sleep re-ingest and via manual backfill.
export async function POST(request) {
  const raw       = await request.text()
  const signature = request.headers.get('x-whoop-signature')
  const timestamp = request.headers.get('x-whoop-signature-timestamp')
  const secret    = process.env.WHOOP_CLIENT_SECRET

  if (!signature || !timestamp || !secret) {
    return new Response('unauthorized', { status: 401 })
  }

  // Replay guard — timestamp is ms since epoch; reject anything older than 5 min.
  const tsMs = Number(timestamp)
  if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > 5 * 60_000) {
    return new Response('stale', { status: 401 })
  }

  // base64( HMAC_SHA256( timestamp + rawBody, clientSecret ) )
  const expected = crypto.createHmac('sha256', secret).update(timestamp + raw).digest('base64')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return new Response('invalid signature', { status: 401 })
  }

  let payload
  try {
    payload = JSON.parse(raw)
  } catch {
    return new Response('bad request', { status: 400 })
  }

  const type = payload?.type

  // Only recovery/sleep updates trigger a re-ingest. workout.* and *.deleted
  // are acknowledged and ignored (Strava owns workouts; delete semantics are
  // out of scope for WH-001b).
  if (type === 'recovery.updated' || type === 'sleep.updated') {
    // Map the WHOOP user to a Cadence user (FC-075a). No match → drop and log;
    // never fall back to a default user. (Will's connection gains whoop_user_id
    // on his next WHOOP reconnect; manual backfill covers the gap meanwhile.)
    const userId = await resolveUserByWhoopUser(payload?.user_id)
    if (!userId) {
      console.warn(`WHOOP webhook: no user for whoop user_id ${payload?.user_id} — event dropped`)
      return new Response('ok (no user)', { status: 200 })
    }
    try {
      const token = await getValidWhoopToken(userId)
      if (token) await ingestWindow(token, userId, 7)
    } catch {
      // Acknowledge receipt regardless — the windowed re-ingest is self-healing
      // (the next event or a manual backfill reconciles). Returning non-2xx
      // would only trigger WHOOP retry storms.
      console.error('WHOOP webhook re-ingest failed')
      return new Response('ok (ingest deferred)', { status: 200 })
    }
  }

  return new Response('ok', { status: 200 })
}
