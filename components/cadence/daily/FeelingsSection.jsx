'use client'

/**
 * How it landed — Phase 2 stub.
 *
 * Phase 2 will:
 *   - flip FEELINGS_ENABLED to true
 *   - wire the mood pip click handler + selected-pip state
 *   - wire the journal input as a controlled field with onChange
 *   - restore the mockup-verbatim section meta "Optional · pulls
 *     into your journal"
 *
 * Until then this renders the mood row (5 inert pips at .stub
 * styling, "Not logged" word in italic Fraunces var(--text-faint))
 * and the journal row with a disabled input carrying the mockup
 * placeholder verbatim. The mood-word and journal-input keep their
 * normal markup so flipping the flag is a one-line change.
 */
const FEELINGS_ENABLED = false

const MOOD_PIPS = [
  { mood: 1, word: 'rough' },
  { mood: 2, word: 'flat' },
  { mood: 3, word: 'okay' },
  { mood: 4, word: 'good' },
  { mood: 5, word: 'strong' },
]

export default function FeelingsSection() {
  const stub = !FEELINGS_ENABLED

  return (
    <section className="section r r-8">
      <div className="section-head">
        <span className="title">How it landed</span>
        <span className="meta">Optional</span>
      </div>
      <div className="feelings-card">

        <div className="mood-row">
          <span className="mood-label">Mood</span>
          <div className="mood-pips">
            <span className="anchor">Rough</span>
            <div className="pips">
              {MOOD_PIPS.map(p => (
                <button
                  key={p.mood}
                  type="button"
                  className={`mood-pip${stub ? ' stub' : ''}`}
                  data-mood={p.mood}
                  data-word={p.word}
                  aria-label={p.word}
                  disabled={stub}
                />
              ))}
            </div>
            <span className="anchor right">Strong</span>
          </div>
          <span className={`mood-word${stub ? ' empty' : ''}`}>
            {stub ? 'Not logged' : ''}
          </span>
        </div>

        <div className="journal-row">
          <span className="label">Note</span>
          <input
            className="journal-input"
            type="text"
            placeholder="A line on the day."
            disabled={stub}
          />
        </div>

      </div>
    </section>
  )
}
