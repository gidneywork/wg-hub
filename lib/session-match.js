/**
 * lib/session-match.js — which of a day's planned sessions have been done
 * (FC-082). Client-safe and pure. Used by TV Mode's tick indicators; built to
 * be shared so TodayCards and adherence can adopt it later (adherence is
 * unchanged for now).
 *
 * Matching is on activity TYPE only — distance never matters. Each activity
 * ticks at most one session. Activities are taken in start-time order and fill
 * sessions in plan order, so two sessions of the same type tick in order.
 * Activities are dated by their UTC start_date, the same convention as
 * kmByDateMap (a known open item), so ticks and km figures always agree.
 */
import { resolveStravaType } from './strava-types'

// Session type → the activity types that complete it. A session type not
// listed here (rest, climbing, custom, …) gets no tick box at all.
const MATCHES = {
  run:         ['run'],            // Run, TrailRun, VirtualRun via STRAVA_TYPE_MAP
  gym:         ['gym'],            // WeightTraining
  stretch:     ['yoga', 'stretch'], // Yoga
  stairmaster: ['stairmaster'],    // StairStepper, plus the fallback below
}

// A WHOOP Stairmaster may reach Strava as a generic Workout. Ratified fallback
// (T2): "stair" in the WHOOP external_id slug or the activity name counts as a
// Stairmaster. This is the one deliberate name-based rule; ingest typing stays
// sport_type-only (see resolveStravaType).
const STAIR_RE = /stair/i

// The Cadence type an activity counts as. A user override (custom_type) wins.
export function activityMatchType(activity) {
  if (activity?.custom_type) return activity.custom_type
  const d = activity?.data || {}
  if (STAIR_RE.test(d.external_id || '') || STAIR_RE.test(d.name || '')) return 'stairmaster'
  return resolveStravaType(d.sport_type, d.type)
}

// True when a session type can be ticked at all.
export function isMatchableSession(session) {
  return !!MATCHES[session?.type]
}

// For each session: true (done), false (not yet) or null (no tick box).
export function matchSessionsToActivities(sessions, activities, isoDate) {
  const dayActs = (activities || [])
    .filter(a => (a?.start_date || '').split('T')[0] === isoDate)
    .sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)))
    .map(a => activityMatchType(a))
  const used = new Array(dayActs.length).fill(false)
  return (sessions || []).map(s => {
    const accepts = MATCHES[s?.type]
    if (!accepts) return null
    const i = dayActs.findIndex((t, j) => !used[j] && accepts.includes(t))
    if (i < 0) return false
    used[i] = true
    return true
  })
}
