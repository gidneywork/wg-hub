import { supabaseServer } from '../../../../lib/supabase-server'
import { getValidToken, upsertSingleActivity, updateSyncMeta } from '../../../../lib/strava'
import { resolveUserByStravaAthlete } from '../../../../lib/auth-server'

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
//   { object_type: "activity", object_id: 12345678, aspect_type: "create", owner_id: ... }
export async function POST(request) {
  try {
    const event = await request.json()

    // We only care about activity events (not athlete profile updates)
    if (event.object_type !== 'activity') {
      return Response.json({ received: true })
    }

    const { aspect_type, object_id: activityId } = event

    // Map the Strava athlete (owner_id) to a Cadence user (FC-075a). No match →
    // drop the event and log it. NEVER fall back to a default user: a second
    // athlete's activity must not land in someone else's history.
    const userId = await resolveUserByStravaAthlete(event.owner_id)
    if (!userId) {
      console.warn(`Strava webhook: no user for owner_id ${event.owner_id} — event dropped`)
      return Response.json({ received: true })
    }

    if (aspect_type === 'create' || aspect_type === 'update') {
      // Get a valid access token (auto-refreshes if expired)
      const accessToken = await getValidToken(userId)

      if (accessToken) {
        // Fetch the full activity detail from Strava
        const res = await fetch(
          `https://www.strava.com/api/v3/activities/${activityId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )

        if (res.ok) {
          const activity = await res.json()
          await upsertSingleActivity(activity, userId)
          await updateSyncMeta(userId)

          // Audit write — only on `create` events, never on `update` or
          // `delete`, to avoid log spam from re-sync churn. Failures are
          // swallowed so a bad audit insert can't fail the webhook ack.
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
        } else {
          console.error(`Webhook: failed to fetch activity ${activityId} — ${res.status}`)
        }
      }

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

    // Always return 200 — if we return an error Strava will retry for 2 days
    return Response.json({ received: true })

  } catch (err) {
    console.error('Webhook error:', err)
    // Still return 200 to stop Strava retrying
    return Response.json({ received: true })
  }
}
