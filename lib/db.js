/**
 * db.js — all database interactions for WG Hub
 */
import { supabase } from './supabase'
import { excludeAutoWalks } from './activities'

// Current signed-in user's id, for stamping every write (FC-075a). Explicit
// stamping — not DEFAULT auth.uid(), which isn't set until B3. Any row written
// without a user_id becomes orphaned the moment B3 flips the policies, so every
// insert/upsert below carries it. getUser() validates the token; memoised and
// invalidated on auth change so writes don't each round-trip. Null when signed
// out (writes then fail closed under RLS, which is correct).
let _userIdCache
export async function currentUserId() {
  if (_userIdCache !== undefined) return _userIdCache
  const { data, error } = await supabase.auth.getUser()
  _userIdCache = error ? null : (data?.user?.id ?? null)
  return _userIdCache
}
supabase.auth.onAuthStateChange(() => { _userIdCache = undefined })

export const db = {

  async loadLogs() {
    const { data, error } = await supabase.from('daily_logs').select('date, data').order('date', { ascending: false })
    if (error) { console.error('loadLogs:', error); return {} }
    const result = {}
    data?.forEach(row => { result[row.date] = row.data })
    return result
  },

  async saveLog(date, logData) {
    const { error } = await supabase.from('daily_logs').upsert({ user_id: await currentUserId(), date, data: logData }, { onConflict: 'user_id,date' })
    if (error) { console.error('saveLog:', error); throw error }
  },

  async loadSettings() {
    const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'settings').maybeSingle()
    if (error) { console.error('loadSettings:', error); return null }
    return data?.value ?? null
  },

  async saveSettings(settings) {
    const { error } = await supabase.from('app_settings').upsert({ user_id: await currentUserId(), key: 'settings', value: settings }, { onConflict: 'user_id,key' })
    if (error) { console.error('saveSettings:', error); throw error }
  },

  async loadPlan() {
    const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'plan').maybeSingle()
    if (error) { console.error('loadPlan:', error); return null }
    return data?.value ?? null
  },

  async savePlan(plan) {
    const { error } = await supabase.from('app_settings').upsert({ user_id: await currentUserId(), key: 'plan', value: plan }, { onConflict: 'user_id,key' })
    if (error) { console.error('savePlan:', error); throw error }
  },

  async loadUserProfile() {
    const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'user_profile').maybeSingle()
    if (error) { console.error('loadUserProfile:', error); return null }
    return data?.value ?? null
  },

  async saveUserProfile(profile) {
    const { error } = await supabase.from('app_settings').upsert({ user_id: await currentUserId(), key: 'user_profile', value: profile }, { onConflict: 'user_id,key' })
    if (error) { console.error('saveUserProfile:', error); throw error }
  },

  async loadAssistantConfig() {
    const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'assistant_config').maybeSingle()
    if (error) { console.error('loadAssistantConfig:', error); return null }
    return data?.value ?? null
  },

  async saveAssistantConfig(config) {
    const { error } = await supabase.from('app_settings').upsert({ user_id: await currentUserId(), key: 'assistant_config', value: config }, { onConflict: 'user_id,key' })
    if (error) { console.error('saveAssistantConfig:', error); throw error }
  },

  async loadStravaConnection() {
    const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'strava_connection').maybeSingle()
    if (error) { console.error('loadStravaConnection:', error); return null }
    return data?.value ?? null
  },

  // Public, non-secret WHOOP connection info (name, connected-at). The tokens
  // live in whoop_tokens, which the anon key cannot read.
  async loadWhoopConnection() {
    const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'whoop_connection').maybeSingle()
    if (error) { console.error('loadWhoopConnection:', error); return null }
    return data?.value ?? null
  },

  // ── Calendar events ──────────────────────────────────────────────────────
  // Events overlapping [startIso, endIso]. One range query serves single- and
  // multi-day events, so a future event surfaces when its week arrives.

  async loadEventsInRange(startIso, endIso) {
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .lte('start_date', endIso)
      .gte('end_date', startIso)
      .order('start_date', { ascending: true })
    if (error) { console.error('loadEventsInRange:', error); return [] }
    return data || []
  },

  async createEvent({ title, notes, start_date, end_date, all_day = true, start_time = null, end_time = null }) {
    const { data, error } = await supabase
      .from('calendar_events')
      .insert({
        user_id:    await currentUserId(),
        title,
        notes:      notes || null,
        start_date,
        end_date:   end_date || start_date,   // single-day defaults to start
        all_day,
        start_time: all_day ? null : (start_time || null),
        end_time:   all_day ? null : (end_time || null),
      })
      .select()
      .single()
    if (error) { console.error('createEvent:', error); throw error }
    return data
  },

  async updateEvent(id, fields) {
    const { error } = await supabase.from('calendar_events').update(fields).eq('id', id)
    if (error) { console.error('updateEvent:', error); throw error }
  },

  async deleteEvent(id) {
    const { error } = await supabase.from('calendar_events').delete().eq('id', id)
    if (error) { console.error('deleteEvent:', error); throw error }
  },

  subscribeToEvents(callback) {
    // Unique channel per subscriber — the week strip and year calendar both subscribe.
    const channel = supabase.channel(`calendar_events_rt_${Math.random().toString(36).slice(2)}`).on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, callback).subscribe()
    return () => supabase.removeChannel(channel)
  },

  async loadActivities() {
    const { data, error } = await supabase.from('strava_activities').select('id, data, start_date, strava_type, custom_name, custom_type, notes, synced_at').order('start_date', { ascending: false })
    if (error) { console.error('loadActivities:', error); return [] }
    // WHOOP auto-walks are ingested but hidden from every view (see lib/activities).
    return excludeAutoWalks(data || [])
  },

  async updateActivity(id, { custom_name, custom_type, notes }) {
    const { error } = await supabase.from('strava_activities').update({ custom_name: custom_name ?? null, custom_type: custom_type ?? null, notes: notes ?? null, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) { console.error('updateActivity:', error); throw error }
  },

  async insertManualActivity(activity) {
    const id = Date.now()
    const { error } = await supabase.from('strava_activities').insert({ user_id: await currentUserId(), id, data: { name: activity.custom_name, type: activity.custom_type, manual: true }, start_date: activity.start_date, strava_type: activity.custom_type, custom_name: activity.custom_name, custom_type: activity.custom_type, notes: activity.notes || null, synced_at: new Date().toISOString() })
    if (error) { console.error('insertManualActivity:', error); throw error }
  },

  async loadWhoopData() {
    const { data, error } = await supabase.from('whoop_data').select('*').order('date', { ascending: false })
    if (error) { console.error('loadWhoopData:', error); return {} }
    const result = {}
    data?.forEach(row => { result[row.date] = row })
    return result
  },

  async loadAuditLog({ type, search, limit = 200 } = {}) {
    let query = supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(limit)
    if (type && type !== 'all') query = query.eq('event_type', type)
    if (search) query = query.or(`title.ilike.%${search}%,detail.ilike.%${search}%`)
    const { data, error } = await query
    if (error) { console.error('loadAuditLog:', error); return [] }
    return data || []
  },

  async writeAuditLog(event_type, title, detail = null, metadata = null) {
    await supabase.from('audit_log').insert({ user_id: await currentUserId(), event_type, title, detail, metadata })
  },

  async loadAnnotations() {
    const { data, error } = await supabase
      .from('chart_annotations')
      .select('*')
      .order('start_date', { ascending: false })
    if (error) { console.error('loadAnnotations:', error); return [] }
    return data || []
  },

  async saveAnnotation({ id, kind, title, note, start_date, end_date }) {
    if (id) {
      const { error } = await supabase
        .from('chart_annotations')
        .update({ kind, title, note: note || null, start_date, end_date: end_date || null })
        .eq('id', id)
      if (error) { console.error('saveAnnotation update:', error); throw error }
    } else {
      const { error } = await supabase
        .from('chart_annotations')
        .insert({ user_id: await currentUserId(), kind, title, note: note || null, start_date, end_date: end_date || null })
      if (error) { console.error('saveAnnotation insert:', error); throw error }
    }
  },

  async deleteAnnotation(id) {
    const { error } = await supabase
      .from('chart_annotations')
      .delete()
      .eq('id', id)
    if (error) { console.error('deleteAnnotation:', error); throw error }
  },

  subscribeToAnnotations(callback) {
    const channel = supabase.channel('annotations_rt').on('postgres_changes', { event: '*', schema: 'public', table: 'chart_annotations' }, callback).subscribe()
    return () => supabase.removeChannel(channel)
  },

  subscribeToActivities(callback) {
    const channel = supabase.channel('strava_rt').on('postgres_changes', { event: '*', schema: 'public', table: 'strava_activities' }, callback).subscribe()
    return () => supabase.removeChannel(channel)
  },

  subscribeToLogs(callback) {
    const channel = supabase.channel('logs_rt').on('postgres_changes', { event: '*', schema: 'public', table: 'daily_logs' }, callback).subscribe()
    return () => supabase.removeChannel(channel)
  },

  subscribeToWhoop(callback) {
    const channel = supabase.channel('whoop_rt').on('postgres_changes', { event: '*', schema: 'public', table: 'whoop_data' }, callback).subscribe()
    return () => supabase.removeChannel(channel)
  },

  // ── Targeted daily log fetch ───────────────────────────────────────────────
  // Used by session completion to avoid loading all logs.

  async loadLogByDate(date) {
    const { data, error } = await supabase
      .from('daily_logs')
      .select('data')
      .eq('date', date)
      .maybeSingle()
    if (error) { console.error('loadLogByDate:', error); return null }
    return data?.data ?? null
  },

  // ── Workout templates ──────────────────────────────────────────────────────
  //
  // PARKED pending FC-035 (Workout Plan Builder). FC-076 retired ad-hoc
  // scheduling and its Templates UI, so these methods are currently
  // unreferenced. The workout_templates table is intentionally NOT dropped —
  // FC-035 will reuse it as the store for reusable session definitions. Leave
  // these in place; do not delete on the grounds that they are dead code.

  async listTemplates() {
    const { data, error } = await supabase
      .from('workout_templates')
      .select('*')
      .order('is_seed', { ascending: false })
      .order('name', { ascending: true })
    if (error) { console.error('listTemplates:', error); return [] }
    return data || []
  },

  async createTemplate({ name, notes, lifts }) {
    const { error } = await supabase
      .from('workout_templates')
      .insert({ user_id: await currentUserId(), name, notes: notes || null, lifts, is_seed: false })
    if (error) { console.error('createTemplate:', error); throw error }
  },

  async updateTemplate(id, fields) {
    const { error } = await supabase
      .from('workout_templates')
      .update(fields)
      .eq('id', id)
      .eq('is_seed', false)
    if (error) { console.error('updateTemplate:', error); throw error }
  },

  async deleteTemplate(id) {
    const { error } = await supabase
      .from('workout_templates')
      .delete()
      .eq('id', id)
      .eq('is_seed', false)
    if (error) { console.error('deleteTemplate:', error); throw error }
  },

  // ── User exercises ─────────────────────────────────────────────────────────

  async loadUserExercises() {
    const { data, error } = await supabase
      .from('user_exercises')
      .select('id, name, muscle_groups')
      .order('created_at', { ascending: true })
    if (error) { console.error('loadUserExercises:', error); return [] }
    return data || []
  },

  async saveUserExercise({ name, muscle_groups }) {
    const { error } = await supabase
      .from('user_exercises')
      .insert({ name, muscle_groups })
    if (error) { console.error('saveUserExercise:', error); throw error }
  },

  // ── Scheduled sessions ─────────────────────────────────────────────────────

  async listScheduledSessions(startDate, endDate) {
    const { data, error } = await supabase
      .from('scheduled_sessions')
      .select('*')
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate)
      .order('scheduled_date', { ascending: true })
    if (error) { console.error('listScheduledSessions:', error); return [] }
    return data || []
  },

  async scheduleSession({ scheduledDate, templateId }) {
    const { data: template, error: tErr } = await supabase
      .from('workout_templates')
      .select('name, lifts')
      .eq('id', templateId)
      .single()
    if (tErr) { console.error('scheduleSession fetch:', tErr); throw tErr }
    const { error } = await supabase
      .from('scheduled_sessions')
      .insert({ user_id: await currentUserId(), scheduled_date: scheduledDate, template_name: template.name, lifts: template.lifts })
    if (error) { console.error('scheduleSession insert:', error); throw error }
  },

  async updateScheduledSession(id, fields) {
    const { error } = await supabase
      .from('scheduled_sessions')
      .update(fields)
      .eq('id', id)
    if (error) { console.error('updateScheduledSession:', error); throw error }
  },

  async deleteScheduledSession(id) {
    const { error } = await supabase
      .from('scheduled_sessions')
      .delete()
      .eq('id', id)
    if (error) { console.error('deleteScheduledSession:', error); throw error }
  },

  // ── Todos ──────────────────────────────────────────────────────────────────

  async listTodos() {
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .is('deleted_at', null)
      .order('start_date', { ascending: true })
    if (error) { console.error('listTodos:', error); return [] }
    return data || []
  },

  async listTodoCompletions() {
    const { data, error } = await supabase
      .from('todo_completions')
      .select('todo_id, completion_date')
      .order('completion_date', { ascending: false })
    if (error) { console.error('listTodoCompletions:', error); return [] }
    return data || []
  },

  async createTodo({ title, notes, repeat_kind, repeat_weekday, repeat_day_of_month, start_date, end_date }) {
    const { data, error } = await supabase
      .from('todos')
      .insert({ user_id: await currentUserId(), title, notes: notes || null, repeat_kind, repeat_weekday: repeat_weekday ?? null, repeat_day_of_month: repeat_day_of_month ?? null, start_date, end_date: end_date || null })
      .select()
      .single()
    if (error) { console.error('createTodo:', error); throw error }
    return data
  },

  async updateTodo(id, fields) {
    const { error } = await supabase
      .from('todos')
      .update(fields)
      .eq('id', id)
    if (error) { console.error('updateTodo:', error); throw error }
  },

  async deleteTodo(id) {
    const { error } = await supabase
      .from('todos')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
    if (error) { console.error('deleteTodo:', error); throw error }
  },

  async completeTodo(todoId, isoDate) {
    const { error } = await supabase
      .from('todo_completions')
      .upsert({ user_id: await currentUserId(), todo_id: todoId, completion_date: isoDate }, { onConflict: 'todo_id,completion_date' })
    if (error) { console.error('completeTodo:', error); throw error }
  },

  async uncompleteTodo(todoId, isoDate) {
    const { error } = await supabase
      .from('todo_completions')
      .delete()
      .eq('todo_id', todoId)
      .eq('completion_date', isoDate)
    if (error) { console.error('uncompleteTodo:', error); throw error }
  },

  // ── Biomarkers ─────────────────────────────────────────────────────────────

  async loadBiomarkerDefinitions() {
    const { data, error } = await supabase
      .from('biomarker_definitions')
      .select('*')
      .order('display_order', { ascending: true })
    if (error) { console.error('loadBiomarkerDefinitions:', error); return [] }
    return data || []
  },

  async loadBiomarkerResults() {
    const { data, error } = await supabase
      .from('biomarker_results')
      .select('id, biomarker_key, sub_marker_key, measured_date, value, value_text, notes, source_document_id, cadence_override_months')
      .order('measured_date', { ascending: false })
    if (error) { console.error('loadBiomarkerResults:', error); return [] }
    return data || []
  },

  async loadBiomarkerDocuments() {
    const { data, error } = await supabase
      .from('biomarker_documents')
      .select('id, uploaded_date, measured_date, provider, provider_other_text, file_url, file_name, notes')
      .order('measured_date', { ascending: false })
    if (error) { console.error('loadBiomarkerDocuments:', error); return [] }
    return data || []
  },

  async insertBiomarkerResult({ biomarker_key, sub_marker_key, measured_date, value, value_text, notes, source_document_id }) {
    const { error } = await supabase.from('biomarker_results').insert({
      user_id:            await currentUserId(),
      biomarker_key,
      sub_marker_key:     sub_marker_key     || null,
      measured_date,
      value:              value != null && value !== '' ? Number(value) : null,
      value_text:         value_text          || null,
      notes:              notes               || null,
      source_document_id: source_document_id  || null,
    })
    if (error) { console.error('insertBiomarkerResult:', error); throw error }
  },

  async updateBiomarkerResultCadence(id, months) {
    const { error } = await supabase.from('biomarker_results')
      .update({ cadence_override_months: months })
      .eq('id', id)
    if (error) { console.error('updateBiomarkerResultCadence:', error); throw error }
  },

  async insertBiomarkerDocument({ file, measured_date, provider, provider_other_text, notes }) {
    const ext  = file.name.split('.').pop().toLowerCase()
    const path = `${measured_date}_${crypto.randomUUID()}.${ext}`

    const { error: upErr } = await supabase.storage
      .from('biomarker-documents')
      .upload(path, file)
    if (upErr) { console.error('biomarkerDocument upload:', upErr); throw upErr }

    const { data: docData, error: insErr } = await supabase.from('biomarker_documents').insert({
      user_id: await currentUserId(),
      measured_date,
      provider,
      provider_other_text: provider_other_text || null,
      file_url:            path,
      file_name:           file.name,
      notes:               notes               || null,
    }).select('id').single()

    if (insErr) {
      await supabase.storage.from('biomarker-documents').remove([path]).catch(() => {})
      console.error('biomarkerDocument insert:', insErr)
      throw insErr
    }

    return docData.id
  },

}
