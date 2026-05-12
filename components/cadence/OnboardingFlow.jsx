'use client'

import { useState } from 'react'
import './onboarding.css'

// Skip is the intended path, not an error. When a user skips a section
// its fields remain at their null/empty defaults and are stored as-is.
// First-login detection is row-presence only — any completed Step 1 unlocks the app.
const DEFAULT_PROFILE = {
  identity:       { displayName: '', dateOfBirth: null, biologicalSex: null, heightCm: null, baselineWeightKg: null },
  training:       { primarySport: null, experience: null, yearsTraining: null, goals: null },
  lifestyle:      { occupation: null, workHoursPerWeek: null, travelFrequency: null, stressLevel: null, coffeeUnitsPerDay: null, alcoholUnitsPerWeek: null, diet: null },
  health:         { currentInjuries: null, medications: null, allergies: null, sleepEnvironmentNotes: null },
  longFormContext: null,
}

// ── Shared primitives ──────────────────────────────────────────────────────────

function ProgressDots({ step }) {
  return (
    <div className="ob-dots" aria-hidden="true">
      {[1, 2, 3, 4, 5].map(n => (
        <div
          key={n}
          className={`ob-dot${n === step ? ' ob-dot--active' : n < step ? ' ob-dot--done' : ''}`}
        />
      ))}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="ob-field">
      <div className="ob-label">{label}</div>
      {children}
    </div>
  )
}

function InputUnit({ value, onChange, unit, min = 0, placeholder }) {
  return (
    <div className="ob-input-unit">
      <input
        type="number"
        value={value ?? ''}
        min={min}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
      />
      <span className="ob-unit">{unit}</span>
    </div>
  )
}

// ── Step 0 — Welcome ───────────────────────────────────────────────────────────

function WelcomeStep({ onNext }) {
  return (
    <div className="ob-step ob-step--welcome">
      <div className="ob-welcome-title">A few questions<br />to get started.</div>
      <p className="ob-welcome-sub">
        Cadence uses this to personalise your assistant and your view of your data. Takes about two minutes.
      </p>
      <button type="button" className="ob-btn-primary" onClick={onNext}>
        Begin
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 5l7 7-7 7"/>
        </svg>
      </button>
    </div>
  )
}

// ── Step 1 — Identity (required, no Skip) ─────────────────────────────────────

function IdentityStep({ profile, update, onNext, onBack }) {
  const { identity } = profile
  const canAdvance = identity.displayName.trim().length > 0

  return (
    <div className="ob-step">
      <h2 className="ob-title">Identity</h2>
      <p className="ob-tagline">Who you are.</p>

      <Field label="Name">
        <input
          type="text"
          value={identity.displayName}
          placeholder="What should Cadence call you?"
          autoFocus
          onChange={e => update('identity', 'displayName', e.target.value)}
        />
      </Field>

      <Field label="Date of birth">
        <input
          type="date"
          value={identity.dateOfBirth ?? ''}
          onChange={e => update('identity', 'dateOfBirth', e.target.value || null)}
        />
      </Field>

      <Field label="Biological sex">
        <select
          value={identity.biologicalSex ?? ''}
          onChange={e => update('identity', 'biologicalSex', e.target.value || null)}
        >
          <option value="">Select…</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other / prefer not to say</option>
        </select>
      </Field>

      <div className="ob-field-row">
        <Field label="Height">
          <InputUnit
            value={identity.heightCm}
            unit="cm"
            placeholder="175"
            onChange={v => update('identity', 'heightCm', v)}
          />
        </Field>
        <Field label="Starting weight">
          <InputUnit
            value={identity.baselineWeightKg}
            unit="kg"
            placeholder="75"
            onChange={v => update('identity', 'baselineWeightKg', v)}
          />
        </Field>
      </div>

      <div className="ob-nav">
        <button type="button" className="ob-btn-ghost" onClick={onBack}>← Back</button>
        <div className="ob-nav-right">
          <button type="button" className="ob-btn-primary" onClick={onNext} disabled={!canAdvance}>
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Step 2 — Training context ──────────────────────────────────────────────────

function TrainingStep({ profile, update, onNext, onBack, onSkip }) {
  const { training } = profile

  return (
    <div className="ob-step">
      <h2 className="ob-title">Training context</h2>
      <p className="ob-tagline">What you're training for.</p>

      <Field label="Primary sport">
        <select
          value={training.primarySport ?? ''}
          onChange={e => update('training', 'primarySport', e.target.value || null)}
        >
          <option value="">Select…</option>
          <option value="ultra">Ultra-running</option>
          <option value="road-running">Road running</option>
          <option value="cycling">Cycling</option>
          <option value="lifting">Lifting</option>
          <option value="swimming">Swimming</option>
          <option value="mixed">Mixed</option>
        </select>
      </Field>

      <div className="ob-field-row">
        <Field label="Experience level">
          <select
            value={training.experience ?? ''}
            onChange={e => update('training', 'experience', e.target.value || null)}
          >
            <option value="">Select…</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
            <option value="elite">Elite</option>
          </select>
        </Field>
        <Field label="Years training">
          <InputUnit
            value={training.yearsTraining}
            unit="yrs"
            placeholder="5"
            onChange={v => update('training', 'yearsTraining', v)}
          />
        </Field>
      </div>

      <Field label="Goals">
        <textarea
          value={training.goals ?? ''}
          placeholder="What are you training for? A race, a number, a feeling…"
          rows={3}
          onChange={e => update('training', 'goals', e.target.value)}
        />
      </Field>

      <div className="ob-nav">
        <button type="button" className="ob-btn-ghost" onClick={onBack}>← Back</button>
        <div className="ob-nav-right">
          <button type="button" className="ob-btn-skip" onClick={onSkip}>Skip</button>
          <button type="button" className="ob-btn-primary" onClick={onNext}>Next →</button>
        </div>
      </div>
    </div>
  )
}

// ── Step 3 — Lifestyle ─────────────────────────────────────────────────────────

function LifestyleStep({ profile, update, onNext, onBack, onSkip }) {
  const { lifestyle } = profile

  return (
    <div className="ob-step">
      <h2 className="ob-title">Lifestyle</h2>
      <p className="ob-tagline">How your days run.</p>

      <div className="ob-field-row">
        <Field label="Occupation">
          <input
            type="text"
            value={lifestyle.occupation ?? ''}
            placeholder="What do you do?"
            onChange={e => update('lifestyle', 'occupation', e.target.value)}
          />
        </Field>
        <Field label="Work hours per week">
          <InputUnit
            value={lifestyle.workHoursPerWeek}
            unit="hrs"
            placeholder="40"
            onChange={v => update('lifestyle', 'workHoursPerWeek', v)}
          />
        </Field>
      </div>

      <div className="ob-field-row">
        <Field label="Travel frequency">
          <select
            value={lifestyle.travelFrequency ?? ''}
            onChange={e => update('lifestyle', 'travelFrequency', e.target.value || null)}
          >
            <option value="">Select…</option>
            <option value="rare">Rare</option>
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
            <option value="frequent">Frequent</option>
          </select>
        </Field>
        <Field label="Stress level">
          <select
            value={lifestyle.stressLevel ?? ''}
            onChange={e => update('lifestyle', 'stressLevel', e.target.value || null)}
          >
            <option value="">Select…</option>
            <option value="low">Low</option>
            <option value="moderate">Moderate</option>
            <option value="high">High</option>
          </select>
        </Field>
      </div>

      <div className="ob-field-row">
        <Field label="Coffee">
          <InputUnit
            value={lifestyle.coffeeUnitsPerDay}
            unit="cups/day"
            placeholder="2"
            onChange={v => update('lifestyle', 'coffeeUnitsPerDay', v)}
          />
        </Field>
        <Field label="Alcohol">
          <InputUnit
            value={lifestyle.alcoholUnitsPerWeek}
            unit="units/week"
            placeholder="4"
            onChange={v => update('lifestyle', 'alcoholUnitsPerWeek', v)}
          />
        </Field>
      </div>

      <Field label="Diet">
        <select
          value={lifestyle.diet ?? ''}
          onChange={e => update('lifestyle', 'diet', e.target.value || null)}
        >
          <option value="">Select…</option>
          <option value="omnivore">Omnivore</option>
          <option value="vegetarian">Vegetarian</option>
          <option value="vegan">Vegan</option>
          <option value="pescatarian">Pescatarian</option>
          <option value="other">Other</option>
        </select>
      </Field>

      <div className="ob-nav">
        <button type="button" className="ob-btn-ghost" onClick={onBack}>← Back</button>
        <div className="ob-nav-right">
          <button type="button" className="ob-btn-skip" onClick={onSkip}>Skip</button>
          <button type="button" className="ob-btn-primary" onClick={onNext}>Next →</button>
        </div>
      </div>
    </div>
  )
}

// ── Step 4 — Health context ────────────────────────────────────────────────────

function HealthStep({ profile, update, onNext, onBack, onSkip }) {
  const { health } = profile

  return (
    <div className="ob-step">
      <h2 className="ob-title">Health context</h2>
      <p className="ob-tagline">Anything worth knowing.</p>

      <Field label="Current injuries">
        <textarea
          value={health.currentInjuries ?? ''}
          placeholder="Nothing you'd rather Cadence didn't suggest working around…"
          rows={2}
          onChange={e => update('health', 'currentInjuries', e.target.value)}
        />
      </Field>

      <Field label="Medications">
        <textarea
          value={health.medications ?? ''}
          placeholder="Any that affect training, sleep, or recovery."
          rows={2}
          onChange={e => update('health', 'medications', e.target.value)}
        />
      </Field>

      <div className="ob-field-row">
        <Field label="Allergies">
          <input
            type="text"
            value={health.allergies ?? ''}
            placeholder="Food, environment…"
            onChange={e => update('health', 'allergies', e.target.value)}
          />
        </Field>
        <Field label="Sleep environment">
          <input
            type="text"
            value={health.sleepEnvironmentNotes ?? ''}
            placeholder="Hot room, noisy street…"
            onChange={e => update('health', 'sleepEnvironmentNotes', e.target.value)}
          />
        </Field>
      </div>

      <div className="ob-nav">
        <button type="button" className="ob-btn-ghost" onClick={onBack}>← Back</button>
        <div className="ob-nav-right">
          <button type="button" className="ob-btn-skip" onClick={onSkip}>Skip</button>
          <button type="button" className="ob-btn-primary" onClick={onNext}>Next →</button>
        </div>
      </div>
    </div>
  )
}

// ── Step 5 — Long-form context ─────────────────────────────────────────────────

function LongFormStep({ profile, update, onNext, onBack, onSkip }) {
  return (
    <div className="ob-step">
      <h2 className="ob-title">Long-form context</h2>
      <p className="ob-tagline">Anything else.</p>

      <Field label="Context">
        <textarea
          className="tall"
          value={profile.longFormContext ?? ''}
          placeholder="Add any context that would help Cadence understand you better — training history, why you're doing this, what matters most."
          rows={6}
          onChange={e => update('root', 'longFormContext', e.target.value)}
        />
      </Field>

      <div className="ob-nav">
        <button type="button" className="ob-btn-ghost" onClick={onBack}>← Back</button>
        <div className="ob-nav-right">
          <button type="button" className="ob-btn-skip" onClick={onSkip}>Skip</button>
          <button type="button" className="ob-btn-primary" onClick={onNext}>Finish</button>
        </div>
      </div>
    </div>
  )
}

// ── Step 6 — Done ──────────────────────────────────────────────────────────────

function DoneStep({ onBegin, saving }) {
  return (
    <div className="ob-step ob-step--done">
      <div className="ob-done-title">All set.</div>
      <p className="ob-done-sub">Time to begin.</p>
      <button
        type="button"
        className={`ob-btn-primary${saving ? ' ob-btn-loading' : ''}`}
        onClick={onBegin}
        disabled={saving}
      >
        {!saving && 'Begin'}
        {!saving && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 5l7 7-7 7"/>
          </svg>
        )}
      </button>
    </div>
  )
}

// ── Root ───────────────────────────────────────────────────────────────────────

export default function OnboardingFlow({ onComplete }) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState(DEFAULT_PROFILE)

  const update = (section, key, value) => {
    if (section === 'root') {
      setProfile(p => ({ ...p, [key]: value }))
    } else {
      setProfile(p => ({ ...p, [section]: { ...p[section], [key]: value } }))
    }
  }

  const next = () => setStep(s => s + 1)
  const back = () => setStep(s => s - 1)
  // Skip advances without modifying the profile — section stays at null defaults.
  // No "incomplete profile" warning or gate. Skip is a first-class action.
  const skip = () => setStep(s => s + 1)

  const handleBegin = async () => {
    setSaving(true)
    await onComplete(profile)
  }

  const showDots = step >= 1 && step <= 5

  return (
    <div className="onboarding-page">
      <div className="ob-ambient" />
      <div className="onboarding-shell">
        <div className="onboarding-wordmark">
          cadence<span className="dot" />
        </div>

        {showDots && <ProgressDots step={step} />}

        {step === 0 && <WelcomeStep onNext={next} />}
        {step === 1 && <IdentityStep  profile={profile} update={update} onNext={next} onBack={back} />}
        {step === 2 && <TrainingStep  profile={profile} update={update} onNext={next} onBack={back} onSkip={skip} />}
        {step === 3 && <LifestyleStep profile={profile} update={update} onNext={next} onBack={back} onSkip={skip} />}
        {step === 4 && <HealthStep    profile={profile} update={update} onNext={next} onBack={back} onSkip={skip} />}
        {step === 5 && <LongFormStep  profile={profile} update={update} onNext={next} onBack={back} onSkip={skip} />}
        {step === 6 && <DoneStep onBegin={handleBegin} saving={saving} />}
      </div>
    </div>
  )
}
