/**
 * lib/webhook-events.js — shared webhook plumbing (FC-079 c2, reused by the
 * WHOOP webhook in FC-080 c1b). Server-only.
 *
 * Providers retry any delivery not acknowledged fast enough (Strava: 2 s), so
 * the routes ack with 200 immediately and do the work after the response.
 * Retries that still arrive are dropped by the de-dupe ledger.
 */
import { waitUntil } from '@vercel/functions'
import { supabaseServer } from './supabase-server'

// Run `work` after the response has been sent. On Vercel (VERCEL=1) the
// function is kept alive via waitUntil. Elsewhere waitUntil has no request
// context and would silently do nothing, so local dev awaits the work inline
// instead. Errors inside `work` are the caller's to handle — this never throws.
export async function runAfterResponse(work) {
  const promise = Promise.resolve().then(work).catch(() => {
    console.error('Webhook background work failed')
  })
  if (process.env.VERCEL === '1') {
    waitUntil(promise)
    return
  }
  await promise
}

// Record a delivery. Returns true only for the FIRST delivery of an event.
// Fails OPEN: if the ledger insert errors (e.g. the table is missing), the
// event is processed anyway and the error is logged so it shows in Vercel logs.
export async function claimWebhookEvent(source, dedupeKey, userId = null) {
  const { data, error } = await supabaseServer
    .from('webhook_events')
    .upsert(
      { source, dedupe_key: dedupeKey, user_id: userId },
      { onConflict: 'source,dedupe_key', ignoreDuplicates: true },
    )
    .select('dedupe_key')
  if (error) {
    console.error(`Webhook de-dupe insert failed (${source}) — processing anyway: ${error.message}`)
    return true
  }
  return (data?.length ?? 0) > 0
}
