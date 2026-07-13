/**
 * lib/strava.js — shared server-side Strava helpers
 * Used by: /api/strava/sync, /api/strava/webhook
 */

import { supabaseServer } from './supabase-server'

export const STRAVA_TYPE_MAP = {
  Run: 'run', TrailRun: 'run', VirtualRun: 'run',
  Walk: 'hike', Hike: 'hike',
  Ride: 'cycle', VirtualRide: 'cycle', MountainBikeRide: 'cycle', GravelRide: 'cycle',
  Swim: 'swim',
  WeightTraining: 'gym', Crossfit: 'functional',
  Yoga: 'yoga',
  Workout: 'functional', Elliptical: 'functional', HighIntensityIntervalTraining: 'functional',
  Stretching: 'stretch',
  RockClimbing: 'climbing',
  Tennis: 'custom',
}

// Resolves a Cadence session type from a Strava activity.
// Precedence is sport_type ?? type: sport_type is the modern, precise field;
// type is legacy and lossy, used only when sport_type is absent. A present but
// unmapped sport_type resolves to 'custom' — an honest "unknown" the user can
// override via custom_type — rather than silently inheriting the legacy value.
// Type comes from the source; overrides come from the user; never from the
// free-text name (the old name-based guess was a workaround for not trusting
// sport_type, and it misfired on incidental mentions — e.g. a skipping session
// named "maybe yoga and gym instead" became yoga).
export function resolveStravaType(sportType, activityType) {
  const key = sportType ?? activityType
  return STRAVA_TYPE_MAP[key] || 'custom'
}

// ── Get a valid access token, refreshing if expired ──────────────────────────
// Scoped to one user (FC-075a) — the token lives in that user's strava_tokens
// row, no longer "the one row".
export async function getValidToken(userId) {
  if (!userId) return null
  const { data } = await supabaseServer
    .from('app_settings')
    .select('value')
    .eq('key', 'strava_tokens')
    .eq('user_id', userId)
    .maybeSingle()

  if (!data?.value) return null

  const stored  = data.value
  const nowSecs = Math.floor(Date.now() / 1000)

  // Still valid — return as-is
  if (stored.expires_at > nowSecs + 300) return stored.access_token

  // Expired — refresh
  const res = await fetch('https://www.strava.com/oauth/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: stored.refresh_token,
      grant_type:    'refresh_token',
    }),
  })

  const fresh = await res.json()
  if (!fresh.access_token) throw new Error('Strava token refresh failed')

  await supabaseServer
    .from('app_settings')
    .update({ value: { access_token: fresh.access_token, refresh_token: fresh.refresh_token, expires_at: fresh.expires_at } })
    .eq('key', 'strava_tokens')
    .eq('user_id', userId)

  return fresh.access_token
}

// ── Upsert a single activity (preserves custom_name / custom_type / notes) ──
// Scoped to one user (FC-075a); new rows are stamped with user_id.
export async function upsertSingleActivity(activity, userId) {
  const { data: existing } = await supabaseServer
    .from('strava_activities')
    .select('id')
    .eq('id', activity.id)
    .maybeSingle()

  const resolvedType = resolveStravaType(activity.sport_type, activity.type)

  if (existing) {
    await supabaseServer
      .from('strava_activities')
      .update({ data: activity, synced_at: new Date().toISOString() })
      .eq('id', activity.id)
  } else {
    await supabaseServer
      .from('strava_activities')
      .insert({
        user_id:     userId,
        id:          activity.id,
        data:        activity,
        start_date:  activity.start_date,
        strava_type: resolvedType,
        synced_at:   new Date().toISOString(),
      })
  }
}

// ── Update the connection record's sync metadata ─────────────────────────────
// Scoped to one user (FC-075a): reads and writes that user's strava_connection,
// and counts only that user's activities.
export async function updateSyncMeta(userId) {
  const { data: conn } = await supabaseServer
    .from('app_settings')
    .select('value')
    .eq('key', 'strava_connection')
    .eq('user_id', userId)
    .maybeSingle()

  if (!conn?.value) return

  const { count } = await supabaseServer
    .from('strava_activities')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  await supabaseServer
    .from('app_settings')
    .update({ value: { ...conn.value, last_synced_at: new Date().toISOString(), activity_count: count || 0 } })
    .eq('key', 'strava_connection')
    .eq('user_id', userId)
}
