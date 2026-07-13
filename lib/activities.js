/**
 * lib/activities.js — shared, client-safe activity helpers.
 *
 * WHOOP auto-detected walks (device_name 'WHOOP', sport_type 'Walk') are pushed
 * WHOOP → Strava → Cadence and are noise: a stroll is not a training session,
 * and its physiological cost is already captured in whoop_data (cycle strain /
 * kilojoule). They stay in strava_activities but are hidden from every view.
 *
 * The predicate lives here, ONCE, and is applied at db.loadActivities() so every
 * consumer inherits it — no per-surface copies (the drift bug FI-002/FI-003 paid
 * for). Removing the single excludeAutoWalks() call fully reverses this.
 */

// True when an activity is a WHOOP auto-walk that should be hidden. A user
// override — custom_type OR custom_name set — means they touched it
// deliberately, so it is no longer noise and must surface.
export function isWhoopAutoWalk(a) {
  const hasOverride =
    (a?.custom_type != null && a.custom_type !== '') ||
    (a?.custom_name != null && a.custom_name !== '')
  if (hasOverride) return false
  return a?.data?.device_name === 'WHOOP' && a?.data?.sport_type === 'Walk'
}

export function excludeAutoWalks(activities) {
  return (activities || []).filter(a => !isWhoopAutoWalk(a))
}
