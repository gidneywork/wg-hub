/**
 * db.js — all database interactions for WG Hub
 */
import { supabase } from './supabase'

export const db = {

  async loadLogs() {
    const { data, error } = await supabase.from('daily_logs').select('date, data').order('date', { ascending: false })
    if (error) { console.error('loadLogs:', error); return {} }
    const result = {}
    data?.forEach(row => { result[row.date] = row.data })
    return result
  },

  async saveLog(date, logData) {
    const { error } = await supabase.from('daily_logs').upsert({ date, data: logData }, { onConflict: 'date' })
    if (error) { console.error('saveLog:', error); throw error }
  },

  async loadSettings() {
    const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'settings').maybeSingle()
    if (error) { console.error('loadSettings:', error); return null }
    return data?.value ?? null
  },

  async saveSettings(settings) {
    const { error } = await supabase.from('app_settings').upsert({ key: 'settings', value: settings }, { onConflict: 'key' })
    if (error) { console.error('saveSettings:', error); throw error }
  },

  async loadPlan() {
    const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'plan').maybeSingle()
    if (error) { console.error('loadPlan:', error); return null }
    return data?.value ?? null
  },

  async savePlan(plan) {
    const { error } = await supabase.from('app_settings').upsert({ key: 'plan', value: plan }, { onConflict: 'key' })
    if (error) { console.error('savePlan:', error); throw error }
  },

  async loadUserProfile() {
    const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'user_profile').maybeSingle()
    if (error) { console.error('loadUserProfile:', error); return null }
    return data?.value ?? null
  },

  async saveUserProfile(profile) {
    const { error } = await supabase.from('app_settings').upsert({ key: 'user_profile', value: profile }, { onConflict: 'key' })
    if (error) { console.error('saveUserProfile:', error); throw error }
  },

  async loadAssistantConfig() {
    const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'assistant_config').maybeSingle()
    if (error) { console.error('loadAssistantConfig:', error); return null }
    return data?.value ?? null
  },

  async saveAssistantConfig(config) {
    const { error } = await supabase.from('app_settings').upsert({ key: 'assistant_config', value: config }, { onConflict: 'key' })
    if (error) { console.error('saveAssistantConfig:', error); throw error }
  },

  async loadStravaConnection() {
    const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'strava_connection').maybeSingle()
    if (error) { console.error('loadStravaConnection:', error); return null }
    return data?.value ?? null
  },

  async loadActivities() {
    const { data, error } = await supabase.from('strava_activities').select('id, data, start_date, strava_type, custom_name, custom_type, notes, synced_at').order('start_date', { ascending: false })
    if (error) { console.error('loadActivities:', error); return [] }
    return data || []
  },

  async updateActivity(id, { custom_name, custom_type, notes }) {
    const { error } = await supabase.from('strava_activities').update({ custom_name: custom_name ?? null, custom_type: custom_type ?? null, notes: notes ?? null, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) { console.error('updateActivity:', error); throw error }
  },

  async insertManualActivity(activity) {
    const id = Date.now()
    const { error } = await supabase.from('strava_activities').insert({ id, data: { name: activity.custom_name, type: activity.custom_type, manual: true }, start_date: activity.start_date, strava_type: activity.custom_type, custom_name: activity.custom_name, custom_type: activity.custom_type, notes: activity.notes || null, synced_at: new Date().toISOString() })
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
    await supabase.from('audit_log').insert({ event_type, title, detail, metadata })
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
        .insert({ kind, title, note: note || null, start_date, end_date: end_date || null })
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
      .insert({ name, notes: notes || null, lifts, is_seed: false })
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
      .insert({ scheduled_date: scheduledDate, template_name: template.name, lifts: template.lifts })
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
      .insert({ title, notes: notes || null, repeat_kind, repeat_weekday: repeat_weekday ?? null, repeat_day_of_month: repeat_day_of_month ?? null, start_date, end_date: end_date || null })
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
      .upsert({ todo_id: todoId, completion_date: isoDate }, { onConflict: 'todo_id,completion_date' })
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

}
