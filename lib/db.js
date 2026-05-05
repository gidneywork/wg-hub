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

}
