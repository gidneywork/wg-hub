/**
 * db.js — all database interactions for WG Hub
 *
 * Two tables in Supabase:
 *   daily_logs   (date TEXT primary key, data JSONB)
 *   app_settings (key  TEXT primary key, value JSONB)
 *
 * This file is the only place that talks to Supabase.
 * Components just call db.loadLogs(), db.saveLog(), etc.
 */

import { supabase } from './supabase'

export const db = {

  // ── Daily Logs ──────────────────────────────────────────────────────────────

  /** Returns all logs as { "YYYY-MM-DD": logObject, ... } */
  async loadLogs() {
    const { data, error } = await supabase
      .from('daily_logs')
      .select('date, data')
      .order('date', { ascending: false })
    if (error) { console.error('loadLogs:', error); return {} }
    const result = {}
    data?.forEach(row => { result[row.date] = row.data })
    return result
  },

  /** Upserts a single day's log */
  async saveLog(date, logData) {
    const { error } = await supabase
      .from('daily_logs')
      .upsert({ date, data: logData }, { onConflict: 'date' })
    if (error) { console.error('saveLog:', error); throw error }
  },

  // ── App Settings ────────────────────────────────────────────────────────────

  /** Returns the parsed settings object, or null if not yet saved */
  async loadSettings() {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'settings')
      .maybeSingle()
    if (error) { console.error('loadSettings:', error); return null }
    return data?.value ?? null
  },

  async saveSettings(settings) {
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'settings', value: settings }, { onConflict: 'key' })
    if (error) { console.error('saveSettings:', error); throw error }
  },

  // ── Training Plan ────────────────────────────────────────────────────────────

  /** Returns the parsed plan array, or null if not yet saved */
  async loadPlan() {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'plan')
      .maybeSingle()
    if (error) { console.error('loadPlan:', error); return null }
    return data?.value ?? null
  },

  async savePlan(plan) {
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'plan', value: plan }, { onConflict: 'key' })
    if (error) { console.error('savePlan:', error); throw error }
  },

  // ── Strava Connection (client-readable, no tokens) ─────────────────────────

  /** Returns public connection info: athlete_name, last_synced_at, activity_count, etc. */
  async loadStravaConnection() {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'strava_connection')
      .maybeSingle()
    if (error) { console.error('loadStravaConnection:', error); return null }
    return data?.value ?? null
  },

  // ── Strava Activities ──────────────────────────────────────────────────────

  /** Returns all activities ordered newest first */
  async loadActivities() {
    const { data, error } = await supabase
      .from('strava_activities')
      .select('id, data, start_date, strava_type, custom_name, custom_type, notes, synced_at')
      .order('start_date', { ascending: false })
    if (error) { console.error('loadActivities:', error); return [] }
    return data || []
  },

  /** Update only the user-editable fields on an activity */
  async updateActivity(id, { custom_name, custom_type, notes }) {
    const { error } = await supabase
      .from('strava_activities')
      .update({
        custom_name:  custom_name  ?? null,
        custom_type:  custom_type  ?? null,
        notes:        notes        ?? null,
        updated_at:   new Date().toISOString(),
      })
      .eq('id', id)
    if (error) { console.error('updateActivity:', error); throw error }
  },

  /** Insert a manually created activity (not from Strava) */
  async insertManualActivity(activity) {
    const id = Date.now() // use timestamp as ID for manual entries
    const { error } = await supabase
      .from('strava_activities')
      .insert({
        id,
        data:        { name: activity.custom_name, type: activity.custom_type, manual: true },
        start_date:  activity.start_date,
        strava_type: activity.custom_type,
        custom_name: activity.custom_name,
        custom_type: activity.custom_type,
        notes:       activity.notes || null,
        synced_at:   new Date().toISOString(),
      })
    if (error) { console.error('insertManualActivity:', error); throw error }
  },

}
