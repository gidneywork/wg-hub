import { getCurrentWeek } from './plan'

// ─── Parser ──────────────────────────────────────────────────────────────────
// Parses one line of session details into a structured lift suggestion.
// Pattern: "ExerciseName · NxR @ Wkg"
// The · separator is only treated as a delimiter when the next non-space
// character is a digit — prevents splitting on "Pull-up · weighted" etc.
// Returns null if the line doesn't match the pattern.
function parseLine(line) {
  const trimmed = line.trim()
  if (!trimmed) return null

  // Exercise · sets×reps @ weight — separator · must be followed by digit
  const m = trimmed.match(
    /^(.+?)\s*·\s*(\d+)\s*[xX×]\s*(\d+)(?:\s*@?\s*(\d+(?:\.\d+)?)\s*kg)?/i
  )
  if (m) {
    return {
      exercise: m[1].trim(),
      sets:     parseInt(m[2], 10),
      reps:     parseInt(m[3], 10),
      weight:   m[4] ? parseFloat(m[4]) : 0,
      raw:      trimmed,
      isPrompt: false,
    }
  }
  return null
}

// Takes the sessions array for one plan day and returns an array of lift
// suggestions. Only sessions with type === 'gym' are processed.
// Unstructured gym sessions (e.g. "Chest / Triceps") produce a soft-prompt
// row with isPrompt: true — a cue to open the add-lift form.
export function parsePlanLifts(sessions) {
  const gymSessions = (sessions || []).filter(s => s.type === 'gym')
  const results = []

  for (const session of gymSessions) {
    const details = String(session.details || '').trim()
    if (!details) continue

    const lines  = details.split('\n').map(l => l.trim()).filter(Boolean)
    const parsed = lines.map(parseLine).filter(Boolean)

    if (parsed.length > 0) {
      results.push(...parsed)
    } else {
      // Unstructured — one soft-prompt row per session
      results.push({
        exercise: null,
        sets:     null,
        reps:     null,
        weight:   0,
        raw:      details,
        isPrompt: true,
      })
    }
  }

  return results
}

// Returns the lift suggestions for a given date and plan, filtered by already-
// skipped entries. Skipped entries are identified by their `raw` string.
// Returns [] if the date is outside the plan, or no gym sessions exist.
export function buildSuggestions(plan, date, skippedLifts = []) {
  if (!plan || !date) return []

  const d   = new Date(date + 'T00:00:00')
  const dow = d.getDay() === 0 ? 6 : d.getDay() - 1 // Mon=0 … Sun=6

  const week = getCurrentWeek(plan, d)
  if (!week) return []

  const planDay = week[dow]
  if (!planDay?.sessions?.length) return []

  const all = parsePlanLifts(planDay.sessions)
  return all.filter(s => !skippedLifts.includes(s.raw))
}
