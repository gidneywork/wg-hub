'use client'

const MOOD_PIPS = [
  { mood: 1, word: 'rough' },
  { mood: 2, word: 'flat'  },
  { mood: 3, word: 'okay'  },
  { mood: 4, word: 'good'  },
  { mood: 5, word: 'strong'},
]

function ReflectionTextarea({ value, onChange, placeholder, rows = 2 }) {
  return (
    <textarea
      className="reflection-textarea"
      rows={rows}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
    />
  )
}

export default function FeelingsSection({ form = {}, onField }) {
  const feelings     = form.feelings || {}
  const selectedMood = feelings.mood        ?? null
  const journal      = feelings.journal     ?? ''
  const injuries     = feelings.injuries    ?? ''
  const moodNote     = feelings.moodNote    ?? ''
  const productivity = feelings.productivity ?? ''
  const gratitude    = feelings.gratitude   ?? ''

  const moodWord = MOOD_PIPS.find(p => p.mood === selectedMood)?.word ?? ''

  function handlePipClick(mood) {
    onField?.('feelings', 'mood', selectedMood === mood ? null : mood)
  }

  return (
    <section className="section r r-9">
      <div className="section-head">
        <span className="title">Reflection</span>
        <span className="meta">Optional</span>
      </div>
      <div className="feelings-card">

        {/* Notes */}
        <div className="reflection-subsection">
          <div className="reflection-label">Notes</div>
          <ReflectionTextarea
            value={journal}
            onChange={e => onField?.('feelings', 'journal', e.target.value)}
            placeholder="A line on the day."
          />
        </div>

        {/* Injuries */}
        <div className="reflection-divider" />
        <div className="reflection-subsection">
          <div className="reflection-label">Injuries</div>
          <ReflectionTextarea
            value={injuries}
            onChange={e => onField?.('feelings', 'injuries', e.target.value)}
            placeholder="Anything to note?"
          />
        </div>

        {/* Mood */}
        <div className="reflection-divider" />
        <div className="reflection-subsection">
          <div className="reflection-label">Mood</div>
          <div className="mood-row">
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
          <div className="reflection-inner-label">Mood note</div>
          <ReflectionTextarea
            value={moodNote}
            onChange={e => onField?.('feelings', 'moodNote', e.target.value)}
            placeholder="Anything behind it?"
            rows={1}
          />
        </div>

        {/* Productivity */}
        <div className="reflection-divider" />
        <div className="reflection-subsection">
          <div className="reflection-label">Productivity</div>
          <ReflectionTextarea
            value={productivity}
            onChange={e => onField?.('feelings', 'productivity', e.target.value)}
            placeholder="Work, focus, output."
          />
        </div>

        {/* Gratitude */}
        <div className="reflection-divider" />
        <div className="reflection-subsection">
          <div className="reflection-label">Gratitude</div>
          <ReflectionTextarea
            value={gratitude}
            onChange={e => onField?.('feelings', 'gratitude', e.target.value)}
            placeholder="One thing."
          />
        </div>

      </div>
    </section>
  )
}
