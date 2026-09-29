/**
 * lib/cronometer-status.js — Cronometer sync status, export budget and
 * failure logging (FC-084). Server-only. Same pattern as lib/whoop-status.js.
 *
 * Non-secret status lives in app_settings 'cronometer_connection' so the
 * Settings card can read it: last_synced_at, last_error, the export budget
 * for the current London day, and any targets fallback note.
 *
 * Export budget: Cronometer allows 10 exports a day. Scheduled runs may use 9
 * (07:00–23:00 every 2 hours), leaving 1 for a manual Sync now. An export is
 * counted when it is ATTEMPTED — Cronometer counts the request, not success.
 *
 * Never records a credential, cookie, nonce or response body.
 */
import { supabaseServer } from './supabase-server'

export const EXPORT_LIMIT_DAILY     = 10
export const EXPORT_LIMIT_SCHEDULED = 9

export async function readConnection(userId) {
  const { data, error } = await supabaseServer
    .from('app_settings').select('value')
    .eq('key', 'cronometer_connection').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data?.value || null
}

export async function mergeConnection(userId, patch) {
  const current = (await readConnection(userId)) || {}
  const { error } = await supabaseServer.from('app_settings').upsert(
    { user_id: userId, key: 'cronometer_connection', value: { ...current, ...patch } },
    { onConflict: 'user_id,key' },
  )
  if (error) throw error
}

// The single Cadence user the scheduler acts for: the owner of the one
// cronometer_connection row (created by the first manual Sync now).
export async function scheduledUserId() {
  const { data, error } = await supabaseServer
    .from('app_settings').select('user_id').eq('key', 'cronometer_connection')
  if (error || !data?.length) return null
  return data.length === 1 ? data[0].user_id : null
}

// Exports used on `londonDate` (0 when the stored count is for another day).
export function exportsUsed(conn, londonDate) {
  return conn?.exports_day === londonDate ? (conn.exports_used || 0) : 0
}

// Reserve one export before attempting it. Returns false when the budget for
// this kind of run is spent.
export async function reserveExport(userId, londonDate, { scheduled }) {
  const conn = await readConnection(userId)
  const used = exportsUsed(conn, londonDate)
  const limit = scheduled ? EXPORT_LIMIT_SCHEDULED : EXPORT_LIMIT_DAILY
  if (used >= limit) return false
  await mergeConnection(userId, { exports_day: londonDate, exports_used: used + 1 })
  return true
}

export async function recordCronometerSync(userId, { source, dates, targetsNote = null }) {
  try {
    await mergeConnection(userId, { last_synced_at: new Date().toISOString(), last_error: null, targets_note: targetsNote })
  } catch { console.error('Cronometer status: sync stamp failed') }
  if (source === 'manual') {
    try {
      const { error } = await supabaseServer.from('audit_log').insert({
        user_id: userId, event_type: 'cronometer_sync',
        title: 'Cronometer: synced',
        detail: dates?.length ? dates.join(' · ') : null,
        metadata: { source, dates: dates || [] },
      })
      if (error) throw error
    } catch { console.error('Cronometer status: sync audit write failed') }
  }
}

export async function recordCronometerFailure(userId, { stage, status = null, source }) {
  if (!userId) return
  const at = new Date().toISOString()
  try {
    const { error } = await supabaseServer.from('audit_log').insert({
      user_id: userId, event_type: 'cronometer_error',
      title: 'Cronometer: sync failed',
      metadata: { stage, status, source },
    })
    if (error) throw error
  } catch { console.error('Cronometer status: failure audit write failed') }
  try {
    await mergeConnection(userId, { last_error: { at, stage, status } })
  } catch { console.error('Cronometer status: last_error write failed') }
}

// Targets could not be read from Cronometer: the sync still counts (consumed
// totals are in), Cadence's own settings targets apply at read time, and the
// fallback is logged — never guessed around.
export async function recordTargetsFallback(userId, { status = null, source }) {
  try {
    const { error } = await supabaseServer.from('audit_log').insert({
      user_id: userId, event_type: 'cronometer_error',
      title: 'Cronometer: targets unavailable — using Cadence targets',
      metadata: { stage: 'targets', status, source },
    })
    if (error) throw error
  } catch { console.error('Cronometer status: targets fallback audit write failed') }
}
