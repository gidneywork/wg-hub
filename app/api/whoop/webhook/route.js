import crypto from 'crypto'
import { getValidWhoopToken } from '../../../../lib/whoop'
import { ingestWindow } from '../../../../lib/whoop-ingest'
import { resolveUserByWhoopUser } from '../../../../lib/auth-server'
import { recordWhoopFailure, recordWhoopSync, failureFromError } from '../../../../lib/whoop-status'
import { runAfterResponse, claimWebhookEvent } from '../../../../lib/webhook-events'

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
//
// FC-080 c1b: signature and replay checks run before the ack (cheap, no
// network). A valid recovery/sleep update is then acked 200 at once and
// processed after the response; retried deliveries are dropped by the
// de-dupe ledger on (type, id, trace_id).
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
    await runAfterResponse(() => processWhoopEvent(payload))
  }

  return new Response('ok', { status: 200 })
}

async function processWhoopEvent(payload) {
  // Map the WHOOP user to a Cadence user (FC-075a). No match → drop and log;
  // never fall back to a default user.
  const userId = await resolveUserByWhoopUser(payload?.user_id)
  if (!userId) {
    console.warn(`WHOOP webhook: no user for whoop user_id ${payload?.user_id} — event dropped`)
    return
  }

  // De-dupe on (type, id, trace_id). WHOOP re-sends recovery.updated for the
  // same id when a score changes, each with a new trace_id — so without a
  // trace_id there is no safe key, and the event is processed (G1).
  if (payload?.trace_id) {
    const first = await claimWebhookEvent('whoop', `${payload.type}:${payload.id}:${payload.trace_id}`, userId)
    if (!first) {
      console.log(`WHOOP webhook: duplicate ${payload.type} ${payload.trace_id} — dropped`)
      return
    }
  }

  try {
    const token = await getValidWhoopToken(userId)
    if (token) {
      await ingestWindow(token, userId, 7)
      await recordWhoopSync(userId)
    }
  } catch (err) {
    // Already acked — never silently (FC-080): the failure goes to audit_log
    // and the Settings card's error state.
    console.error('WHOOP webhook re-ingest failed')
    await recordWhoopFailure(userId, { ...failureFromError(err), source: 'webhook' })
  }
}
