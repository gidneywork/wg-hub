'use client'

import { useId, useState } from 'react'
import { CLIP_PROVIDERS, ENGAGEMENT_OPTIONS, STATUS_LABELS } from '../../lib/clipping'

/**
 * One page's card for the selected day (FC-090). Edits in place; every change
 * goes straight to onChange(patch) — the parent owns state and saving.
 */

export function StatusPill({ status }) {
  return <span className={`clip-pill is-${status}`}>{STATUS_LABELS[status]}</span>
}

function EngagementControl({ value, onChange, labelId }) {
  const known = ENGAGEMENT_OPTIONS.includes(value)
  const onKeyDown = (e) => {
    const i = ENGAGEMENT_OPTIONS.indexOf(value)
    let next = null
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = ENGAGEMENT_OPTIONS[Math.min(ENGAGEMENT_OPTIONS.length - 1, i + 1)]
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = ENGAGEMENT_OPTIONS[Math.max(0, i - 1)]
    if (next == null) return
    e.preventDefault()
    onChange(next)
    const group = e.currentTarget
    requestAnimationFrame(() => group.querySelector('[aria-checked="true"]')?.focus())
  }
  return (
    <>
      <div className="clip-seg" role="radiogroup" aria-labelledby={labelId} onKeyDown={onKeyDown}>
        {ENGAGEMENT_OPTIONS.map(opt => (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={value === opt}
            tabIndex={value === opt || (!known && opt === 0) ? 0 : -1}
            className={value === opt ? 'on' : ''}
            onClick={() => onChange(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
      {!known && <div className="clip-hint">Logged: {value} min</div>}
    </>
  )
}

const filled = v => !!(v ?? '').trim()
const OTHER = 'Other'

// Provider chips: Whop / Clipit / Clipfy / Other. Tapping the selected chip
// clears it. Other reveals a free-text input that saves to provider; a stored
// value outside CLIP_PROVIDERS shows as Other with its text.
function ProviderPicker({ value, otherOpen, setOtherOpen, onPick, labelId }) {
  const v = value ?? ''
  const otherSelected = otherOpen || (filled(v) && !CLIP_PROVIDERS.includes(v))
  const options = [...CLIP_PROVIDERS, OTHER]
  const selected = otherSelected ? OTHER : (CLIP_PROVIDERS.includes(v) ? v : null)

  const choose = (opt) => {
    if (opt === selected) { setOtherOpen(false); onPick(null); return }
    if (opt === OTHER) { setOtherOpen(true); onPick(null); return }
    setOtherOpen(false)
    onPick(opt)
  }

  const onKeyDown = (e) => {
    const i = options.indexOf(selected)
    let next = null
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = options[Math.min(options.length - 1, i + 1)]
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = options[Math.max(0, i - 1)]
    if (next == null || next === selected) return
    e.preventDefault()
    choose(next)
    const group = e.currentTarget
    requestAnimationFrame(() => group.querySelector('[aria-checked="true"]')?.focus())
  }

  return (
    <>
      <div className="clip-chips" role="radiogroup" aria-labelledby={labelId} onKeyDown={onKeyDown}>
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={selected === opt}
            tabIndex={selected === opt || (selected == null && opt === options[0]) ? 0 : -1}
            className={selected === opt ? 'on' : ''}
            onClick={() => choose(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
      {otherSelected && (
        <input
          type="text"
          className="clip-text"
          aria-label="Other provider"
          maxLength={40}
          autoComplete="off"
          value={v}
          onChange={e => { setOtherOpen(true); onPick(e.target.value) }}
        />
      )}
    </>
  )
}

export default function ClipPageCard({ page, row, target, status, dateKey, carriedCampaign, onChange, className = '' }) {
  const uid = useId()
  const posts = row?.posts || 0
  const mins = row?.engagement_mins || 0
  const pct = target > 0 ? Math.min(100, (posts / target) * 100) : 100
  const isClip = page.kind === 'clip'
  const kindLabel = isClip ? 'Clip page' : 'Themed'

  // "Other" stays open for the day it was opened on, even before any text.
  const [otherFor, setOtherFor] = useState(null)
  const otherOpen = otherFor === dateKey
  const setOtherOpen = open => setOtherFor(open ? dateKey : null)

  // Picking a provider while the campaign is empty carries the last campaign
  // forward in the same patch. Clearing the provider never clears the text.
  const pickProvider = (value) => {
    const patch = { provider: value }
    if (filled(value) && !filled(row?.campaign) && carriedCampaign) patch.campaign = carriedCampaign
    onChange(patch)
  }

  const onViews = (e) => {
    const digits = e.target.value.replace(/\D/g, '')
    onChange({ views: digits === '' ? null : Number(digits) })
  }

  return (
    <section className={`card clip-card ${className}`}>
      <div className="clip-card-head">
        <div>
          <div className="clip-card-name">{page.name}</div>
          <div className="clip-card-kind">{kindLabel}</div>
        </div>
        <StatusPill status={status} />
      </div>

      <div className="clip-field">
        <div className="clip-label" id={`${uid}-posts`}>Posts</div>
        <div className="clip-stepper" role="group" aria-labelledby={`${uid}-posts`}>
          <button type="button" aria-label="One fewer post" disabled={posts === 0} onClick={() => onChange({ posts: Math.max(0, posts - 1) })}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M6 12h12"/></svg>
          </button>
          <output className="clip-stepper-value" aria-live="polite">
            <span className="n">{posts}</span><span className="of"> / {target}</span>
          </output>
          <button type="button" aria-label="One more post" onClick={() => onChange({ posts: posts + 1 })}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M6 12h12M12 6v12"/></svg>
          </button>
        </div>
        <div className="clip-meter" aria-hidden="true">
          <span className={posts >= target ? 'met' : ''} style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="clip-field">
        <div className="clip-label" id={`${uid}-eng`}>Engagement · min</div>
        <EngagementControl value={mins} onChange={v => onChange({ engagement_mins: v })} labelId={`${uid}-eng`} />
      </div>

      {isClip && (
        <div className="clip-field">
          <div className="clip-label" id={`${uid}-prov`}>Provider</div>
          <ProviderPicker
            value={row?.provider}
            otherOpen={otherOpen}
            setOtherOpen={setOtherOpen}
            onPick={pickProvider}
            labelId={`${uid}-prov`}
          />
          <input
            type="text"
            className="clip-text"
            aria-label="Campaign summary"
            maxLength={120}
            autoComplete="off"
            value={row?.campaign ?? ''}
            placeholder={carriedCampaign || 'Campaign name or summary'}
            onChange={e => onChange({ campaign: e.target.value })}
          />
        </div>
      )}

      <label className="clip-views">
        <span className="clip-label">Views so far</span>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          value={row?.views ?? ''}
          onChange={onViews}
        />
      </label>
    </section>
  )
}
