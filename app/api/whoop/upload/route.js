import { supabaseServer } from '../../../../lib/supabase-server'
import { resolveUserId } from '../../../../lib/auth-server'

// ── Parse CSV text into array of objects ──────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
  return lines.slice(1).map(line => {
    // Handle quoted fields with commas inside
    const values = []
    let current = '', inQuotes = false
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes }
      else if (ch === ',' && !inQuotes) { values.push(current.trim()); current = '' }
      else { current += ch }
    }
    values.push(current.trim())
    const obj = {}
    headers.forEach((h, i) => { obj[h] = values[i] || '' })
    return obj
  }).filter(row => Object.values(row).some(v => v !== ''))
}

// ── Extract local date (YYYY-MM-DD) from a Whoop timestamp ───────────────────
// Whoop stores times in local timezone — we use the date part directly
function whoopDate(ts) {
  if (!ts) return null
  // Format: "2026-05-04 23:45:55" — take the date part
  return ts.split(' ')[0] || null
}

// ── Format time as HH:MM from a full timestamp ────────────────────────────────
function whoopTime(ts) {
  if (!ts) return null
  const parts = ts.split(' ')
  if (parts.length < 2) return null
  return parts[1].substring(0, 5) // "23:45"
}

// ── Convert minutes to hours ──────────────────────────────────────────────────
const toHours = (mins) => mins ? Math.round((parseFloat(mins) / 60) * 100) / 100 : null
const toNum   = (v)    => v && v !== '' ? parseFloat(v) : null

// ── POST /api/whoop/upload ────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const userId = await resolveUserId(request)
    if (!userId) return Response.json({ error: 'Not signed in' }, { status: 401 })

    const formData = await request.formData()

    // Accept any combination of the 4 Whoop CSV files
    const files = {
      physiological: formData.get('physiological_cycles'),
      sleeps:        formData.get('sleeps'),
      workouts:      formData.get('workouts'),
      journal:       formData.get('journal_entries'),
    }

    // Build a map: date → merged whoop record
    const dayMap = {}

    const getDay = (date) => {
      if (!dayMap[date]) dayMap[date] = { date }
      return dayMap[date]
    }

    // ── Process physiological_cycles.csv (primary source for body metrics) ──
    if (files.physiological) {
      const text = await files.physiological.text()
      const rows = parseCSV(text)
      for (const row of rows) {
        // Use the wake onset date as the "day" — that's when Whoop assigns recovery
        const wakeDate = whoopDate(row['Wake onset'] || row['Cycle start time'])
        if (!wakeDate) continue
        const day = getDay(wakeDate)
        day.recovery_score   = toNum(row['Recovery score %'])
        day.rhr              = toNum(row['Resting heart rate (bpm)'])
        day.hrv              = toNum(row['Heart rate variability (ms)'])
        day.skin_temp        = toNum(row['Skin temp (celsius)'])
        day.blood_oxygen     = toNum(row['Blood oxygen %'])
        day.day_strain       = toNum(row['Day Strain'])
        day.energy_burned    = toNum(row['Energy burned (cal)'])
        day.sleep_score      = toNum(row['Sleep performance %'])
        day.hours_slept      = toHours(row['Asleep duration (min)'])
        day.deep_sleep_mins  = toNum(row['Deep (SWS) duration (min)'])
        day.rem_sleep_mins   = toNum(row['REM duration (min)'])
        day.light_sleep_mins = toNum(row['Light sleep duration (min)'])
        day.sleep_efficiency = toNum(row['Sleep efficiency %'])
        day.sleep_consistency= toNum(row['Sleep consistency %'])
        day.respiratory_rate = toNum(row['Respiratory rate (rpm)'])
        day.bed_time         = whoopTime(row['Sleep onset'])
        day.wake_time        = whoopTime(row['Wake onset'])
      }
    }

    // ── Process sleeps.csv (fills gaps not in physiological) ──────────────────
    if (files.sleeps) {
      const text = await files.sleeps.text()
      const rows = parseCSV(text)
      for (const row of rows) {
        const wakeDate = whoopDate(row['Wake onset'])
        if (!wakeDate) continue
        const day = getDay(wakeDate)
        // Only fill fields not already set by physiological_cycles
        if (!day.sleep_score)      day.sleep_score      = toNum(row['Sleep performance %'])
        if (!day.hours_slept)      day.hours_slept      = toHours(row['Asleep duration (min)'])
        if (!day.deep_sleep_mins)  day.deep_sleep_mins  = toNum(row['Deep (SWS) duration (min)'])
        if (!day.rem_sleep_mins)   day.rem_sleep_mins   = toNum(row['REM duration (min)'])
        if (!day.light_sleep_mins) day.light_sleep_mins = toNum(row['Light sleep duration (min)'])
        if (!day.sleep_efficiency) day.sleep_efficiency = toNum(row['Sleep efficiency %'])
        if (!day.respiratory_rate) day.respiratory_rate = toNum(row['Respiratory rate (rpm)'])
        if (!day.bed_time)         day.bed_time         = whoopTime(row['Sleep onset'])
        if (!day.wake_time)        day.wake_time        = whoopTime(row['Wake onset'])
      }
    }

    if (!Object.keys(dayMap).length) {
      return Response.json({ error: 'No valid data found in uploaded files' }, { status: 400 })
    }

    // ── Upsert all days into whoop_data (stamped to this user, FC-075a) ───────
    const rows = Object.values(dayMap).filter(d => d.date).map(d => ({ ...d, user_id: userId }))
    const { error: upsertError } = await supabaseServer
      .from('whoop_data')
      .upsert(rows, { onConflict: 'user_id,date' })

    if (upsertError) throw upsertError

    // ── Write audit log entry ─────────────────────────────────────────────────
    const datesSorted = Object.keys(dayMap).sort()
    const earliest    = datesSorted[0]
    const latest      = datesSorted[datesSorted.length - 1]

    await supabaseServer.from('audit_log').insert({
      user_id:    userId,
      event_type: 'whoop_upload',
      title:      `Whoop: ${rows.length} days imported`,
      detail:     `${earliest} → ${latest}`,
      metadata:   {
        days_imported: rows.length,
        earliest_date: earliest,
        latest_date:   latest,
        files_uploaded: Object.entries(files).filter(([,v])=>v).map(([k])=>k),
      },
    })

    return Response.json({
      imported: rows.length,
      earliest,
      latest,
      message: `Successfully imported ${rows.length} days of Whoop data (${earliest} → ${latest})`,
    })

  } catch (err) {
    console.error('Whoop upload error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
