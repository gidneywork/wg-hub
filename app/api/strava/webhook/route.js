import { supabaseServer } from '../../../../lib/supabase-server'
import { getValidToken, upsertSingleActivity, updateSyncMeta, isExcludedStravaActivity } from '../../../../lib/strava'
import { resolveUserByStravaAthlete } from '../../../../lib/auth-server'
import { runAfterResponse, claimWebhookEvent } from '../../../../lib/webhook-events'

// ── GET — Strava one-time verification handshake ─────────────────────────────
// When you register a webhook, Strava immediately hits this endpoint with a
// challenge code. We echo it back to confirm the URL is ours.
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN) {
    // Echo the challenge — Strava confirms webhook is live
    return Response.json({ 'hub.challenge': challenge })
  }

  return new Response('Forbidden', { status: 403 })
}

// ── POST — Live activity event from Strava ───────────────────────────────────
// Strava calls this within ~30 seconds of an activity being uploaded.
// Payload example:
//   { object_type: "activity", object_id: 12345678, aspect_type: "create",
//     owner_id: ..., event_time: 1727600000 }
//
// Strava retries any delivery not acknowledged within 2 s, which produced
// every event three times (FC-079). The route now acks 200 immediately and
// processes after the response; retries that still arrive are dropped by the
// de-dupe ledger on (object_id, aspect_type, event_time).
export async function POST(request) {
  let event
  try {
    event = await request.json()
  } catch {
    return Response.json({ received: true }) // unparseable — nothing to retry
  }

  // We only care about activity events (not athlete profile updates)
  if (event?.object_type === 'activity') {
    await runAfterResponse(() => processActivityEvent(event))
  }

  // Always 200 — an error makes Strava retry for 2 days.
  return Response.json({ received: true })
}

async function processActivityEvent(event) {
  const { aspect_type, object_id: activityId } = event

  // Map the Strava athlete (owner_id) to a Cadence user (FC-075a). No match →
  // drop the event and log it. NEVER fall back to a default user: a second
  // athlete's activity must not land in someone else's history.
  const userId = await resolveUserByStravaAthlete(event.owner_id)
  if (!userId) {
    console.warn(`Strava webhook: no user for owner_id ${event.owner_id} — event dropped`)
    return
  }

  // Retried delivery of an event already handled → drop.
  const first = await claimWebhookEvent('strava', `${activityId}:${aspect_type}:${event.event_time}`, userId)
  if (!first) {
    console.log(`Webhook: duplicate ${aspect_type} for activity ${activityId} — dropped`)
    return
  }

  if (aspect_type === 'create' || aspect_type === 'update') {
    // Get a valid access token (auto-refreshes if expired)
    const accessToken = await getValidToken(userId)
    if (!accessToken) return

    // Fetch the full activity detail from Strava
    const res = await fetch(
      `https://www.strava.com/api/v3/activities/${activityId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!res.ok) {
      console.error(`Webhook: failed to fetch activity ${activityId} — ${res.status}`)
      return
    }
    const activity = await res.json()

    // Excluded (Walk) — never ingested, never audited. An activity
    // re-typed to Walk on Strava drops its existing row (FC-079).
    if (isExcludedStravaActivity(activity)) {
      const { data: removed } = await supabaseServer
        .from('strava_activities')
        .delete()
        .eq('user_id', userId)
        .eq('id', activityId)
        .select('id')
      if (removed?.length) await updateSyncMeta(userId)
      console.log(`Webhook: skipped excluded activity ${activityId}`)
      return
    }

    await upsertSingleActivity(activity, userId)
    await updateSyncMeta(userId)

    // Audit write — only on `create` events, never on `update` or
    // `delete`, to avoid log spam from re-sync churn. Failures are
    // swallowed so a bad audit insert can't sink the rest of the work.
    if (aspect_type === 'create') {
      try {
        const distanceKm = activity.distance ? activity.distance / 1000 : null
        const distanceLabel = distanceKm != null ? `${distanceKm.toFixed(1)}km` : '—'
        await supabaseServer.from('audit_log').insert({
          user_id:    userId,
          event_type: 'strava_sync',
          title:      `Strava: ${activity.name}`,
          detail:     `${activity.name} · ${distanceLabel}`,
          metadata:   {
            activity_id:   activity.id,
            source:        'webhook',
            activity_name: activity.name,
            distance_km:   distanceKm,
          },
        })
      } catch (auditErr) {
        console.error('Webhook audit_log write failed:', auditErr)
      }
    }

    console.log(`Webhook: ${aspect_type}d activity ${activityId} — ${activity.name}`)

  } else if (aspect_type === 'delete') {
    // Remove the activity from this user's data
    await supabaseServer
      .from('strava_activities')
      .delete()
      .eq('user_id', userId)
      .eq('id', activityId)

    await updateSyncMeta(userId)
    console.log(`Webhook: deleted activity ${activityId}`)
  }
}
