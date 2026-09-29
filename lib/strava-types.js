/**
 * lib/strava-types.js — Strava sport_type → Cadence session type. Client-safe
 * (no server imports), shared by the ingest routes (via lib/strava.js) and the
 * session matcher (lib/session-match.js).
 */

export const STRAVA_TYPE_MAP = {
  Run: 'run', TrailRun: 'run', VirtualRun: 'run',
  Walk: 'hike', Hike: 'hike',
  Ride: 'cycle', VirtualRide: 'cycle', MountainBikeRide: 'cycle', GravelRide: 'cycle',
  Swim: 'swim',
  StairStepper: 'stairmaster',
  WeightTraining: 'gym', Crossfit: 'functional',
  Yoga: 'yoga',
  Workout: 'functional', Elliptical: 'functional', HighIntensityIntervalTraining: 'functional',
  Stretching: 'stretch',
  RockClimbing: 'climbing',
  Tennis: 'custom',
}

// Resolves a Cadence session type from a Strava activity.
// Precedence is sport_type ?? type: sport_type is the modern, precise field;
// type is legacy and lossy, used only when sport_type is absent. A present but
// unmapped sport_type resolves to 'custom' — an honest "unknown" the user can
// override via custom_type — rather than silently inheriting the legacy value.
// Type comes from the source; overrides come from the user; never from the
// free-text name (the old name-based guess was a workaround for not trusting
// sport_type, and it misfired on incidental mentions — e.g. a skipping session
// named "maybe yoga and gym instead" became yoga).
export function resolveStravaType(sportType, activityType) {
  const key = sportType ?? activityType
  return STRAVA_TYPE_MAP[key] || 'custom'
}
