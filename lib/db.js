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

}
