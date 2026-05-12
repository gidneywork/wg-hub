'use client'

const MOOD_PIPS = [
  { mood: 1, word: 'rough' },
  { mood: 2, word: 'flat'  },
  { mood: 3, word: 'okay'  },
  { mood: 4, word: 'good'  },
  { mood: 5, word: 'strong'},
]

export default function FeelingsSection({ form = {}, onField }) {
  const feelings = form.feelings || {}
  const selectedMood = feelings.mood ?? null
  const journal      = feelings.journal ?? ''

  const moodWord = MOOD_PIPS.find(p => p.mood === selectedMood)?.word ?? ''

  function handlePipClick(mood) {
    // Clicking the active pip deselects
    onField?.('feelings', 'mood', selectedMood === mood ? null : mood)
  }

  return (
    <section className="section r r-9">
      <div className="section-head">
        <span className="title">How it landed</span>
        <span className="meta">Optional · pulls into your journal</span>
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
                  className={`mood-pip${selectedMood === p.mood ? ' selected' : ''}`}
                  data-mood={p.mood}
                  data-word={p.word}
                  aria-label={p.word}
                  onClick={() => handlePipClick(p.mood)}
                />
              ))}
            </div>
            <span className="anchor right">Strong</span>
          </div>
          <span className={`mood-word${moodWord ? '' : ' empty'}`}>
            {moodWord || 'Not logged'}
          </span>
        </div>

        <div className="journal-row">
          <span className="label">Note</span>
          <input
            className="journal-input"
            type="text"
            placeholder="A line on the day."
            value={journal}
            onChange={e => onField?.('feelings', 'journal', e.target.value)}
          />
        </div>

      </div>
    </section>
  )
}
