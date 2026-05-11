'use client'

/**
 * Lifts section — Phase 2 stub.
 *
 * Phase 2 will:
 *   - flip LIFTS_ENABLED to true
 *   - render the real lifts list from a new schema (no lift PB store
 *     exists today)
 *   - restore the mockup-verbatim section meta "Optional · N logged today"
 *   - show the .lift-add-trigger / .lift-add-row inline add flow
 *
 * Until then this renders the .section-head, the .lifts-card chrome,
 * and the .lift-empty italic Fraunces line. The add-row + add-trigger
 * markup live behind the LIFTS_ENABLED flag so future commits can swap
 * the data binding without restructuring.
 */
const LIFTS_ENABLED = false

const EXERCISE_OPTIONS = [
  'Back squat',
  'Front squat',
  'Deadlift',
  'Bench press',
  'Overhead press',
  'Pull-up · weighted',
  'Pull-up · bodyweight',
  'Romanian deadlift',
  'Hip thrust',
  'Bulgarian split squat',
]

export default function LiftsSection() {
  return (
    <section className="section r r-6">
      <div className="section-head">
        <span className="title">Lifts</span>
        <span className="meta">Optional</span>
      </div>
      <div className="lifts-card">

        <div className="lift-empty">No lifts logged yet</div>

        {LIFTS_ENABLED ? (
          <>
            <div className="lift-add-row">
              <select aria-label="Exercise">
                <option value="">Choose exercise…</option>
                {EXERCISE_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
              <span />
              <input type="text" inputMode="decimal" placeholder="kg" aria-label="Weight" />
              <input type="text" inputMode="numeric" placeholder="reps" aria-label="Reps" />
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="btn">Save</button>
                <button type="button" className="btn ghost">×</button>
              </div>
            </div>
            <button type="button" className="lift-add-trigger">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add lift
            </button>
          </>
        ) : null}

      </div>
    </section>
  )
}
