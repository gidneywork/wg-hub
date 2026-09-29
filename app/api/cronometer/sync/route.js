import crypto from 'crypto'
import { supabaseServer } from '../../../../lib/supabase-server'
import { resolveUserId } from '../../../../lib/auth-server'
import { openSession, londonParts, shiftDate, isScheduledHour, mergeConsumed, CronometerError } from '../../../../lib/cronometer'
import {
  reserveExport, scheduledUserId, readConnection, mergeConnection, exportsUsed, refreshesLeft, syncedWithin, EXPORT_LIMIT_DAILY,
  recordCronometerSync, recordCronometerFailure, recordTargetsFallback,
} from '../../../../lib/cronometer-status'

export const maxDuration = 60

const UUID_RE  = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function secretMatches(header, secret) {
  if (!secret) return false
  const a = Buffer.from(header || ''), b = Buffer.from(`Bearer ${secret}`)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// POST /api/cronometer/sync
//   Scheduled: Authorization: Bearer <CRON_SECRET> (pg_cron). Acts only at
//     07, 10, 13, 16, 19, 22 London, and skips (no export) if any sync
//     succeeded in the previous 60 minutes. `force=1` skips both checks (the
//     daily budget still applies); `user=<uuid>` names the user when no
//     cronometer_connection row exists yet. Secret holder only.
//   Manual (Refresh / Sync now): the signed-in user's session; up to 4 a day.
// Refreshes yesterday and today. Returns 200 with a summary; never returns a
// credential, cookie or response body.
export async function POST(request) {
  const url = new URL(request.url)
  let userId, source
  if (secretMatches(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    source = 'scheduled'
    if (url.searchParams.get('force') !== '1' && !isScheduledHour(londonParts().hour)) {
      return Response.json({ skipped: 'outside schedule' })
    }
    const named = url.searchParams.get('user')
    userId = named && UUID_RE.test(named) ? named : await scheduledUserId()
    if (!userId) return Response.json({ skipped: 'no Cronometer user yet — run Sync now once' })
    if (url.searchParams.get('force') !== '1' && syncedWithin(await readConnection(userId), 60)) {
      return Response.json({ skipped: 'synced within the last hour' })
    }
  } else {
    userId = await resolveUserId(request)
    if (!userId) return Response.json({ error: 'Not signed in' }, { status: 401 })
    source = 'manual'
  }

  const { date: today } = londonParts()
  const yesterday = shiftDate(today, -1)
  let session = null
  let stage = 'session'
  try {
    session = await openSession(userId)

    stage = 'budget'
    if (!(await reserveExport(userId, today, { scheduled: source === 'scheduled' }))) {
      const c = await readConnection(userId)
      return Response.json({ skipped: 'No refreshes left today', exports_used: exportsUsed(c, today), refreshes_left: refreshesLeft(c, today) },
        { status: source === 'manual' ? 429 : 200 })
    }

    stage = 'export'
    const rows = (await session.exportDailySummary(yesterday, today)).filter(r => r.date === yesterday || r.date === today)

    stage = 'store'
    const { data: existingRows, error: readErr } = await supabaseServer
      .from('cronometer_data').select('*').eq('user_id', userId).in('date', [yesterday, today])
    if (readErr) throw new CronometerError('store read')
    const existing = Object.fromEntries((existingRows || []).map(r => [r.date, r]))
    const nowIso = new Date().toISOString()
    const upserts = rows.map(r => ({
      user_id: userId, date: r.date,
      ...mergeConsumed(r, existing[r.date], r.date === today),
      nutrients: r.nutrients, synced_at: nowIso,
    }))
    if (upserts.length) {
      const { error: upErr } = await supabaseServer.from('cronometer_data').upsert(upserts, { onConflict: 'user_id,date' })
      if (upErr) throw new CronometerError('store write')
    }

    // Targets: set once per date (the first successful run of the London day),
    // then reused. They come from this run's authenticate reply, so no extra
    // call. If unreadable: Cadence's own targets apply at read time, and the
    // fallback is logged.
    stage = 'targets'
    let targetsNote = null
    const targets = session.targets()
    for (const date of [yesterday, today]) {
      if (existing[date]?.targets_fetched_at) continue
      if (targets) {
        const { error: tErr } = await supabaseServer.from('cronometer_data').upsert(
          { user_id: userId, date, ...targets, targets_fetched_at: nowIso, synced_at: nowIso },
          { onConflict: 'user_id,date' })
        if (tErr) throw new CronometerError('store targets')
      } else {
        targetsNote = 'Cronometer targets unavailable — Cadence targets used'
        // Retried every run (self-heals), but logged once per London day.
        const c = await readConnection(userId)
        if (c?.targets_fallback_day !== today) {
          await recordTargetsFallback(userId, { status: null, source })
          await mergeConnection(userId, { targets_fallback_day: today })
        }
        break
      }
    }

    await recordCronometerSync(userId, { source, dates: rows.map(r => r.date), targetsNote })
    const c = await readConnection(userId)
    return Response.json({ synced: rows.map(r => r.date), targets: targetsNote ? 'fallback' : 'cronometer', exports_used: exportsUsed(c, today), refreshes_left: refreshesLeft(c, today), exports_limit: EXPORT_LIMIT_DAILY })
  } catch (err) {
    const f = err?.name === 'CronometerError' ? { stage: err.stage, status: err.status } : { stage, status: null }
    console.error(`Cronometer sync failed at ${f.stage}`)
    await recordCronometerFailure(userId, { ...f, source })
    return Response.json({ error: 'Cronometer sync failed', stage: f.stage }, { status: 502 })
  } finally {
    // Keep the session (fresh login or refreshed cookies) for the next run.
    if (session) await session.saveSession().catch(() => console.error('Cronometer session save failed'))
  }
}
