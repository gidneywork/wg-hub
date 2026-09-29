import { getValidWhoopToken } from '../../../../lib/whoop'
import { ingestFromWhoop } from '../../../../lib/whoop-ingest'
import { resolveUserId } from '../../../../lib/auth-server'
import { recordWhoopFailure, recordWhoopSync, recordWhoopBackfill, failureFromError } from '../../../../lib/whoop-status'

// POST /api/whoop/backfill
// Manual-trigger only (no cron, no on-load run). Pages the full WHOOP history
// and upserts whoop_data on (user_id, date), idempotently and without clobbering
// existing non-null values. Returns a summary; never returns a token.
export async function POST(request) {
  const userId = await resolveUserId(request)
  if (!userId) return Response.json({ error: 'Not signed in' }, { status: 401 })

  let token
  try {
    token = await getValidWhoopToken(userId)
  } catch (err) {
    await recordWhoopFailure(userId, { ...failureFromError(err), source: 'backfill' })
    return Response.json({ error: 'WHOOP token error' }, { status: 500 })
  }
  if (!token) return Response.json({ error: 'WHOOP not connected' }, { status: 401 })

  try {
    const summary = await ingestFromWhoop(token, userId)
    await recordWhoopSync(userId)
    await recordWhoopBackfill(userId, summary)
    return Response.json(summary)
  } catch (err) {
    console.error('WHOOP backfill failed')
    await recordWhoopFailure(userId, { ...failureFromError(err), source: 'backfill' })
    return Response.json({ error: 'Backfill failed' }, { status: 500 })
  }
}
