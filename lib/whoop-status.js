/**
 * lib/whoop-status.js — WHOOP sync status + failure logging (FC-080).
 *
 * Server-only. Every WHOOP path (webhook, backfill, probe) reports here so a
 * failure is never silent: an audit_log row plus last_error on the user's
 * whoop_connection, which the Settings card reads. Success stamps
 * last_synced_at and clears last_error.
 *
 * Never records a token or a response body — stage and HTTP status only. Each
 * helper swallows its own errors: logging must never break the caller.
 */
import { supabaseServer } from './supabase-server'

// Read-merge-write the non-secret whoop_connection value. No row → not
// connected; nothing to stamp.
async function mergeConnection(userId, patch) {
  const { data, error } = await supabaseServer
    .from('app_settings')
    .select('value')
    .eq('key', 'whoop_connection')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data?.value) return
  const { error: upErr } = await supabaseServer
    .from('app_settings')
    .update({ value: { ...data.value, ...patch } })
    .eq('key', 'whoop_connection')
    .eq('user_id', userId)
  if (upErr) throw upErr
}

// Map a thrown error onto a failure record. WhoopTokenError carries its own
// stage, status and reconnect flag; anything else failed during the data sync.
export function failureFromError(err) {
  if (err?.name === 'WhoopTokenError') {
    return { stage: err.stage, status: err.status, reconnect: err.reconnect }
  }
  return { stage: 'sync', status: null, reconnect: false }
}

const TOKEN_STAGES = new Set(['refresh', 'refresh_contended', 'save'])

export async function recordWhoopFailure(userId, { stage, status = null, source, reconnect = false }) {
  if (!userId) return
  const at = new Date().toISOString()
  try {
    const { error } = await supabaseServer.from('audit_log').insert({
      user_id:    userId,
      event_type: 'whoop_error',
      title:      TOKEN_STAGES.has(stage) ? 'WHOOP: token refresh failed' : 'WHOOP: sync failed',
      metadata:   { stage, status, source, reconnect },
    })
    if (error) throw error
  } catch {
    console.error('WHOOP status: failure audit write failed')
  }
  try {
    await mergeConnection(userId, { last_error: { at, stage, status, reconnect } })
  } catch {
    console.error('WHOOP status: last_error write failed')
  }
}

export async function recordWhoopSync(userId) {
  if (!userId) return
  try {
    await mergeConnection(userId, { last_synced_at: new Date().toISOString(), last_error: null })
  } catch {
    console.error('WHOOP status: last_synced_at write failed')
  }
}

// Backfill is user-initiated, so it leaves an audit trace (webhook successes
// do not — same no-spam rule as Strava).
export async function recordWhoopBackfill(userId, summary) {
  if (!userId) return
  const range = summary?.dateRange
  try {
    const { error } = await supabaseServer.from('audit_log').insert({
      user_id:    userId,
      event_type: 'whoop_sync',
      title:      `WHOOP: backfilled ${summary?.upserted ?? 0} dates`,
      detail:     range ? `${range[0]} → ${range[1]}` : null,
      metadata:   { source: 'backfill', upserted: summary?.upserted ?? 0, fetched: summary?.fetched ?? null, dateRange: range ?? null },
    })
    if (error) throw error
  } catch {
    console.error('WHOOP status: backfill audit write failed')
  }
}
