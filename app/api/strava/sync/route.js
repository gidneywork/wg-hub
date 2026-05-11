import { supabaseServer } from '../../../../lib/supabase-server'
import { getValidToken, updateSyncMeta, resolveStravaType } from '../../../../lib/strava'

async function upsertBatch(activities) {
  if (!activities.length) return 0

  const ids = activities.map(a => a.id)
  const { data: existing } = await supabaseServer
    .from('strava_activities')
    .select('id')
    .in('id', ids)

  const existingIds = new Set((existing || []).map(r => Number(r.id)))
  const newOnes     = activities.filter(a => !existingIds.has(a.id))
  const updates     = activities.filter(a =>  existingIds.has(a.id))

  if (newOnes.length) {
    await supabaseServer.from('strava_activities').insert(
      newOnes.map(a => ({
        id:          a.id,
        data:        a,
        start_date:  a.start_date,
        strava_type: resolveStravaType(a.sport_type, a.type, a.name),
        synced_at:   new Date().toISOString(),
      }))
    )
  }

  for (const a of updates) {
    await supabaseServer
      .from('strava_activities')
      .update({ data: a, synced_at: new Date().toISOString() })
      .eq('id', a.id)
  }

  return newOnes.length
}

export async function POST() {
  try {
    const accessToken = await getValidToken()
    if (!accessToken) return Response.json({ error: 'Strava not connected' }, { status: 401 })

    const { data: connRow } = await supabaseServer
      .from('app_settings')
      .select('value')
      .eq('key', 'strava_connection')
      .maybeSingle()

    const lastSync = connRow?.value?.last_synced_at
    const afterTs  = lastSync ? Math.floor(new Date(lastSync).getTime() / 1000) : 0

    let allActivities = [], page = 1
    while (true) {
      const url =
        `https://www.strava.com/api/v3/athlete/activities` +
        `?per_page=200&page=${page}` +
        (afterTs ? `&after=${afterTs}` : '')

      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
      if (!res.ok) throw new Error(`Strava API error: ${res.status}`)

      const batch = await res.json()
      if (!batch.length) break
      allActivities = [...allActivities, ...batch]
      if (batch.length < 200) break
      page++
    }

    const newCount = await upsertBatch(allActivities)
    await updateSyncMeta()

    const { count } = await supabaseServer
      .from('strava_activities')
      .select('*', { count: 'exact', head: true })

    // Write audit log — always, regardless of newCount, so the
    // activity log shows that a sync ran even when nothing new came
    // through. The detail string distinguishes the two cases.
    const detail = newCount > 0
      ? `Synced ${newCount} activit${newCount === 1 ? 'y' : 'ies'} from Strava`
      : 'Strava sync · no new activities'

    await supabaseServer.from('audit_log').insert({
      event_type: 'strava_sync',
      title:      'Strava sync',
      detail,
      metadata: {
        source:   'manual_sync',
        new:      newCount,
        newCount,
        total:    count,
        synced:   allActivities.length,
      },
    })

    return Response.json({ synced: allActivities.length, new: newCount, total: count })

  } catch (err) {
    console.error('Sync error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
