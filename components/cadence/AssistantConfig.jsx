'use client'

import { useState } from 'react'

const DEFAULT_CONFIG = {
  identity:        { name: 'Cadence', voiceGender: 'neutral', accent: 'british' },
  personality:     { style: 'direct-and-brief', verbosity: 'medium', firstNameUse: 'occasional' },
  behavioural:     { proactiveNudges: true, reminderStyle: 'text-only', timeWindowStart: '07:00', timeWindowEnd: '21:00', timezone: '' },
  forbiddenTopics: '',
}

function cloneConfig(c) {
  return JSON.parse(JSON.stringify(c ?? DEFAULT_CONFIG))
}

// ── Field primitives ───────────────────────────────────────────────────────────

function AcField({ label, children }) {
  return (
    <div className="ac-field">
      <div className="ac-label">{label}</div>
      {children}
    </div>
  )
}

function AcFieldRow({ children, cols3 = false }) {
  return (
    <div className={`ac-field-row${cols3 ? ' ac-field-row--3' : ''}`}>
      {children}
    </div>
  )
}

function AcToggle({ checked, onChange, label }) {
  return (
    <label className="ac-toggle-label">
      <input
        type="checkbox"
        className="ac-toggle-input"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
      />
      <span className="ac-toggle-track"><span className="ac-toggle-thumb" /></span>
      <span className="ac-toggle-text">{checked ? 'Enabled' : 'Disabled'}</span>
    </label>
  )
}

function SaveRow({ saveState, onSave }) {
  return (
    <div className="ac-save-row">
      <button
        type="button"
        className={`btn ${saveState === 'saved' ? 'btn-ghost' : 'btn-primary'}`}
        onClick={onSave}
        disabled={saveState === 'saving'}
      >
        {saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}

function useSectionSave(getLocal, saveAssistantConfig) {
  const [state, setState] = useState('idle')
  const handleSave = async () => {
    setState('saving')
    try {
      await saveAssistantConfig(getLocal())
      setState('saved')
      setTimeout(() => setState('idle'), 2000)
    } catch {
      setState('idle')
    }
  }
  return [state, handleSave]
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AssistantConfig({ assistantConfig, saveAssistantConfig }) {
  const [local, setLocal] = useState(() => cloneConfig(assistantConfig))

  const update = (section, key, value) => {
    if (section === 'root') {
      setLocal(p => ({ ...p, [key]: value }))
    } else {
      setLocal(p => ({ ...p, [section]: { ...p[section], [key]: value } }))
    }
  }

  const getLocal = () => local

  const [idSave,   handleIdSave  ] = useSectionSave(getLocal, saveAssistantConfig)
  const [persSave, handlePersSave] = useSectionSave(getLocal, saveAssistantConfig)
  const [behSave,  handleBehSave ] = useSectionSave(getLocal, saveAssistantConfig)
  const [forbSave, handleForbSave] = useSectionSave(getLocal, saveAssistantConfig)

  const { identity, personality, behavioural } = local

  return (
    <div className="ac-page">

      <header className="page-header r r-1">
        <div>
          <h1 className="page-title">Assistant <em>configuration.</em></h1>
          <div className="page-sub">How Cadence speaks and behaves</div>
        </div>
      </header>

      {/* ── Identity ──────────────────────────────────────────────────────── */}
      <section className="settings-section r r-2">
        <div className="section-head">
          <span className="section-label">Identity</span>
        </div>
        <div className="section-body">

          <AcField label="Name">
            <input
              type="text"
              value={identity.name}
              placeholder="Cadence"
              onChange={e => update('identity', 'name', e.target.value)}
            />
          </AcField>

          <AcFieldRow>
            <AcField label="Voice gender">
              <select
                value={identity.voiceGender ?? ''}
                onChange={e => update('identity', 'voiceGender', e.target.value || null)}
              >
                <option value="neutral">Neutral</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </AcField>
            <AcField label="Accent">
              <select
                value={identity.accent ?? ''}
                onChange={e => update('identity', 'accent', e.target.value || null)}
              >
                <option value="british">British</option>
                <option value="american">American</option>
                <option value="australian">Australian</option>
              </select>
            </AcField>
          </AcFieldRow>

          <SaveRow saveState={idSave} onSave={handleIdSave} />
        </div>
      </section>

      {/* ── Personality ───────────────────────────────────────────────────── */}
      <section className="settings-section r r-3">
        <div className="section-head">
          <span className="section-label">Personality</span>
        </div>
        <div className="section-body">

          <AcField label="Style">
            <select
              value={personality.style ?? ''}
              onChange={e => update('personality', 'style', e.target.value || null)}
            >
              <option value="direct-and-brief">Direct and brief</option>
              <option value="conversational">Conversational</option>
              <option value="coaching">Coaching</option>
            </select>
          </AcField>

          <AcFieldRow>
            <AcField label="Verbosity">
              <select
                value={personality.verbosity ?? ''}
                onChange={e => update('personality', 'verbosity', e.target.value || null)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </AcField>
            <AcField label="Use my first name">
              <select
                value={personality.firstNameUse ?? ''}
                onChange={e => update('personality', 'firstNameUse', e.target.value || null)}
              >
                <option value="never">Never</option>
                <option value="occasional">Occasionally</option>
                <option value="often">Often</option>
              </select>
            </AcField>
          </AcFieldRow>

          <SaveRow saveState={persSave} onSave={handlePersSave} />
        </div>
      </section>

      {/* ── Behavioural preferences ───────────────────────────────────────── */}
      <section className="settings-section r r-4">
        <div className="section-head">
          <span className="section-label">Behavioural preferences</span>
        </div>
        <div className="section-body">

          <AcField label="Proactive nudges">
            <AcToggle
              checked={behavioural.proactiveNudges}
              onChange={v => update('behavioural', 'proactiveNudges', v)}
            />
          </AcField>

          <AcField label="Reminder style">
            <select
              value={behavioural.reminderStyle ?? ''}
              onChange={e => update('behavioural', 'reminderStyle', e.target.value || null)}
            >
              <option value="text-only">Text only</option>
              <option value="push">Push notifications</option>
              <option value="both">Both</option>
            </select>
          </AcField>

          <AcFieldRow>
            <AcField label="Quiet hours start">
              <input
                type="time"
                value={behavioural.timeWindowStart ?? ''}
                onChange={e => update('behavioural', 'timeWindowStart', e.target.value || null)}
              />
            </AcField>
            <AcField label="Quiet hours end">
              <input
                type="time"
                value={behavioural.timeWindowEnd ?? ''}
                onChange={e => update('behavioural', 'timeWindowEnd', e.target.value || null)}
              />
            </AcField>
          </AcFieldRow>

          <AcField label="Timezone">
            <input
              type="text"
              value={behavioural.timezone ?? ''}
              placeholder="Europe/London"
              onChange={e => update('behavioural', 'timezone', e.target.value || null)}
            />
          </AcField>

          <SaveRow saveState={behSave} onSave={handleBehSave} />
        </div>
      </section>

      {/* ── Forbidden topics ──────────────────────────────────────────────── */}
      <section className="settings-section r r-5">
        <div className="section-head">
          <span className="section-label">Forbidden topics</span>
        </div>
        <div className="section-body">

          <AcField label="Topics to avoid">
            <textarea
              value={local.forbiddenTopics}
              placeholder="Anything Cadence should never bring up or comment on."
              rows={4}
              onChange={e => update('root', 'forbiddenTopics', e.target.value)}
            />
          </AcField>

          <SaveRow saveState={forbSave} onSave={handleForbSave} />
        </div>
      </section>

    </div>
  )
}
