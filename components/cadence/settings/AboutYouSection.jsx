'use client'

import { useState } from 'react'

const EMPTY_PROFILE = {
  identity:       { displayName: '', dateOfBirth: null, biologicalSex: null, heightCm: null, baselineWeightKg: null },
  training:       { primarySport: null, experience: null, yearsTraining: null, goals: '' },
  lifestyle:      { occupation: '', workHoursPerWeek: null, travelFrequency: null, stressLevel: null, coffeeUnitsPerDay: null, alcoholUnitsPerWeek: null, diet: null },
  health:         { currentInjuries: '', medications: '', allergies: '', sleepEnvironmentNotes: '' },
  longFormContext: '',
}

function cloneProfile(p) {
  return JSON.parse(JSON.stringify(p ?? EMPTY_PROFILE))
}

// ── Field primitives ───────────────────────────────────────────────────────────

function AyField({ label, children }) {
  return (
    <div className="ay-field">
      <div className="ay-label">{label}</div>
      {children}
    </div>
  )
}

function AyInputUnit({ value, onChange, unit, placeholder }) {
  return (
    <div className="ay-input-unit">
      <input
        type="number"
        value={value ?? ''}
        min={0}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
      />
      <span className="ay-unit">{unit}</span>
    </div>
  )
}

function SubHead({ title }) {
  return <div className="ay-sub-head">{title}</div>
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AboutYouSection({ userProfile, saveUserProfile }) {
  const [open,      setOpen     ] = useState(false)
  const [local,     setLocal    ] = useState(() => cloneProfile(userProfile))
  const [saveState, setSaveState] = useState('idle') // idle | saving | saved

  const update = (section, key, value) => {
    if (section === 'root') {
      setLocal(p => ({ ...p, [key]: value }))
    } else {
      setLocal(p => ({ ...p, [section]: { ...p[section], [key]: value } }))
    }
  }

  const handleSave = async () => {
    setSaveState('saving')
    try {
      await saveUserProfile(local)
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2000)
    } catch {
      setSaveState('idle')
    }
  }

  const preview = userProfile?.identity?.displayName

  return (
    <section className="settings-section r r-2">
      <div
        className="section-head ay-toggle"
        onClick={() => setOpen(o => !o)}
        role="button"
        aria-expanded={open}
      >
        <div className="ay-toggle-left">
          <span className="section-label">About you</span>
          {preview && !open && (
            <span className="section-sub ay-preview">{preview}</span>
          )}
        </div>
        <svg
          className={`ay-chevron${open ? ' ay-chevron--open' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </div>

      {open && (
        <div className="section-body">

          {/* ── Identity ──────────────────────────────────────────── */}
          <SubHead title="Identity" />

          <div className="ay-field-row">
            <AyField label="Name">
              <input
                type="text"
                value={local.identity.displayName}
                placeholder="Your name"
                onChange={e => update('identity', 'displayName', e.target.value)}
              />
            </AyField>
            <AyField label="Date of birth">
              <input
                type="date"
                value={local.identity.dateOfBirth ?? ''}
                onChange={e => update('identity', 'dateOfBirth', e.target.value || null)}
              />
            </AyField>
          </div>

          <div className="ay-field-row ay-field-row--3">
            <AyField label="Biological sex">
              <select
                value={local.identity.biologicalSex ?? ''}
                onChange={e => update('identity', 'biologicalSex', e.target.value || null)}
              >
                <option value="">Not set</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other / prefer not to say</option>
              </select>
            </AyField>
            <AyField label="Height">
              <AyInputUnit value={local.identity.heightCm} unit="cm" placeholder="175" onChange={v => update('identity', 'heightCm', v)} />
            </AyField>
            <AyField label="Starting weight">
              <AyInputUnit value={local.identity.baselineWeightKg} unit="kg" placeholder="75" onChange={v => update('identity', 'baselineWeightKg', v)} />
            </AyField>
          </div>

          {/* ── Training context ──────────────────────────────────── */}
          <SubHead title="Training context" />

          <div className="ay-field-row ay-field-row--3">
            <AyField label="Primary sport">
              <select
                value={local.training.primarySport ?? ''}
                onChange={e => update('training', 'primarySport', e.target.value || null)}
              >
                <option value="">Not set</option>
                <option value="ultra">Ultra-running</option>
                <option value="road-running">Road running</option>
                <option value="cycling">Cycling</option>
                <option value="lifting">Lifting</option>
                <option value="swimming">Swimming</option>
                <option value="mixed">Mixed</option>
              </select>
            </AyField>
            <AyField label="Experience level">
              <select
                value={local.training.experience ?? ''}
                onChange={e => update('training', 'experience', e.target.value || null)}
              >
                <option value="">Not set</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="elite">Elite</option>
              </select>
            </AyField>
            <AyField label="Years training">
              <AyInputUnit value={local.training.yearsTraining} unit="yrs" placeholder="5" onChange={v => update('training', 'yearsTraining', v)} />
            </AyField>
          </div>

          <AyField label="Goals">
            <textarea
              value={local.training.goals}
              placeholder="What are you training for?"
              rows={3}
              onChange={e => update('training', 'goals', e.target.value)}
            />
          </AyField>

          {/* ── Lifestyle ─────────────────────────────────────────── */}
          <SubHead title="Lifestyle" />

          <div className="ay-field-row">
            <AyField label="Occupation">
              <input
                type="text"
                value={local.lifestyle.occupation}
                placeholder="What do you do?"
                onChange={e => update('lifestyle', 'occupation', e.target.value)}
              />
            </AyField>
            <AyField label="Work hours per week">
              <AyInputUnit value={local.lifestyle.workHoursPerWeek} unit="hrs" placeholder="40" onChange={v => update('lifestyle', 'workHoursPerWeek', v)} />
            </AyField>
          </div>

          <div className="ay-field-row ay-field-row--3">
            <AyField label="Travel frequency">
              <select
                value={local.lifestyle.travelFrequency ?? ''}
                onChange={e => update('lifestyle', 'travelFrequency', e.target.value || null)}
              >
                <option value="">Not set</option>
                <option value="rare">Rare</option>
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="frequent">Frequent</option>
              </select>
            </AyField>
            <AyField label="Stress level">
              <select
                value={local.lifestyle.stressLevel ?? ''}
                onChange={e => update('lifestyle', 'stressLevel', e.target.value || null)}
              >
                <option value="">Not set</option>
                <option value="low">Low</option>
                <option value="moderate">Moderate</option>
                <option value="high">High</option>
              </select>
            </AyField>
            <AyField label="Diet">
              <select
                value={local.lifestyle.diet ?? ''}
                onChange={e => update('lifestyle', 'diet', e.target.value || null)}
              >
                <option value="">Not set</option>
                <option value="omnivore">Omnivore</option>
                <option value="vegetarian">Vegetarian</option>
                <option value="vegan">Vegan</option>
                <option value="pescatarian">Pescatarian</option>
                <option value="other">Other</option>
              </select>
            </AyField>
          </div>

          <div className="ay-field-row">
            <AyField label="Coffee">
              <AyInputUnit value={local.lifestyle.coffeeUnitsPerDay} unit="cups/day" placeholder="2" onChange={v => update('lifestyle', 'coffeeUnitsPerDay', v)} />
            </AyField>
            <AyField label="Alcohol">
              <AyInputUnit value={local.lifestyle.alcoholUnitsPerWeek} unit="units/week" placeholder="4" onChange={v => update('lifestyle', 'alcoholUnitsPerWeek', v)} />
            </AyField>
          </div>

          {/* ── Health context ────────────────────────────────────── */}
          <SubHead title="Health context" />

          <AyField label="Current injuries">
            <textarea
              value={local.health.currentInjuries}
              placeholder="Anything Cadence should work around…"
              rows={2}
              onChange={e => update('health', 'currentInjuries', e.target.value)}
            />
          </AyField>

          <AyField label="Medications">
            <textarea
              value={local.health.medications}
              placeholder="Any that affect training, sleep, or recovery."
              rows={2}
              onChange={e => update('health', 'medications', e.target.value)}
            />
          </AyField>

          <div className="ay-field-row">
            <AyField label="Allergies">
              <input
                type="text"
                value={local.health.allergies}
                placeholder="Food, environment…"
                onChange={e => update('health', 'allergies', e.target.value)}
              />
            </AyField>
            <AyField label="Sleep environment">
              <input
                type="text"
                value={local.health.sleepEnvironmentNotes}
                placeholder="Hot room, noisy street…"
                onChange={e => update('health', 'sleepEnvironmentNotes', e.target.value)}
              />
            </AyField>
          </div>

          {/* ── Long-form context ─────────────────────────────────── */}
          <SubHead title="Long-form context" />

          <AyField label="Context">
            <textarea
              value={local.longFormContext}
              placeholder="Add anything else that would help Cadence understand you better."
              rows={5}
              onChange={e => update('root', 'longFormContext', e.target.value)}
            />
          </AyField>

          {/* ── Save ──────────────────────────────────────────────── */}
          <div className="ay-save-row">
            <button
              type="button"
              className={`btn ${saveState === 'saved' ? 'btn-ghost' : 'btn-primary'}`}
              onClick={handleSave}
              disabled={saveState === 'saving'}
            >
              {saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving…' : 'Save'}
            </button>
          </div>

        </div>
      )}
    </section>
  )
}
