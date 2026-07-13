import { getValidWhoopToken } from '../../../../lib/whoop'
import { ingestFromWhoop } from '../../../../lib/whoop-ingest'

// POST /api/whoop/backfill
// Manual-trigger only (no cron, no on-load run). Pages the full WHOOP history
// and upserts whoop_data on the date key, idempotently and without clobbering
// existing non-null values. Returns a summary; never returns a token.
export async function POST() {
  let token
  try {
    token = await getValidWhoopToken()
  } catch {
    return Response.json({ error: 'WHOOP token error' }, { status: 500 })
  }
  if (!token) return Response.json({ error: 'WHOOP not connected' }, { status: 401 })

  try {
    const summary = await ingestFromWhoop(token)
    return Response.json(summary)
  } catch {
    console.error('WHOOP backfill failed')
    return Response.json({ error: 'Backfill failed' }, { status: 500 })
  }
}
