import { getValidWhoopToken, WHOOP_API_BASE } from '../../../../lib/whoop'
import { resolveUserId } from '../../../../lib/auth-server'

// One page per resource. WHOOP's collection max is limit=25; for the
// roughly-one-per-day resources that is about 25 days — well over the 7-day
// floor this probe needs to show.
const COLLECTIONS = [
  { key: 'cycle',    path: '/v2/cycle?limit=25' },
  { key: 'recovery', path: '/v2/recovery?limit=25' },
  { key: 'sleep',    path: '/v2/activity/sleep?limit=25' },
  { key: 'workout',  path: '/v2/activity/workout?limit=25' },
]

// GET /api/whoop/probe
//
// Diagnostic only. Fetches ONE page of each WHOOP v2 resource and returns the
// RAW, UNMODIFIED JSON — the { records, next_token } envelope intact, every
// timestamp exactly as WHOOP sent it, no rounding, no conversion, no filtering.
// It is evidence, not a product.
//
// Writes NOTHING to the database. The whoop_data table and the CSV import path
// are untouched. Never logs, returns, or echoes any token.
//
// Mapping caveats for the future mapping session — recorded here so they are
// not rediscovered:
//   - Sleep records[] include NAPS (record.nap === true). Hours slept, sleep
//     score, and sleep/wake times must be read from the MAIN night sleep, not
//     from a nap record.
//   - Recovery and sleep records may be unscored: record.score_state can be
//     'PENDING_SCORE' or 'UNSCORABLE', in which case record.score is null.
export async function GET(request) {
  const userId = await resolveUserId(request)
  if (!userId) return Response.json({ error: 'Not signed in' }, { status: 401 })

  let accessToken
  try {
    accessToken = await getValidWhoopToken(userId)
  } catch {
    return Response.json({ error: 'WHOOP token error' }, { status: 500 })
  }
  if (!accessToken) return Response.json({ error: 'WHOOP not connected' }, { status: 401 })

  const auth = { headers: { Authorization: `Bearer ${accessToken}` } }
  const out = {}

  try {
    // Four paginated collections — one raw envelope each. A single resource
    // failing (e.g. a scope gap) is reported inline rather than sinking the
    // whole probe, so the other resources still yield evidence.
    for (const { key, path } of COLLECTIONS) {
      const res = await fetch(`${WHOOP_API_BASE}${path}`, auth)
      out[key] = res.ok
        ? await res.json()
        : { error: `WHOOP ${key} request failed (${res.status})` }
    }

    // Body measurement is a single object, not a paginated collection.
    const bodyRes = await fetch(`${WHOOP_API_BASE}/v2/user/measurement/body`, auth)
    out.body_measurement = bodyRes.ok
      ? await bodyRes.json()
      : { error: `WHOOP body_measurement request failed (${bodyRes.status})` }

    return Response.json(out)
  } catch {
    // Never echo an error that could carry token or response material.
    return Response.json({ error: 'WHOOP probe failed' }, { status: 502 })
  }
}
