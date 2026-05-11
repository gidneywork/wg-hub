/**
 * Settings helpers — pure functions for the Settings page.
 *
 * Subsequent commits flesh out:
 *  - targetState (band: on/amber/off + pct)
 *  - currentValues collector (logs + whoopData + activities → live numbers)
 *  - diffTargets (for the target_updated audit writes)
 *  - timeAgo and fmtUploadDate
 *
 * This file is created in commit 1 so the scaffold compiles and the
 * downstream commits have a stable import path.
 */

// Relative time for Strava sync / connected timestamps. Mirrors the
// formatter in the legacy StravaConnectionCard so the wording stays the
// same as the existing app while we rebrand the visual frame.
export function timeAgo(iso) {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(hours / 24)
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}
