'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Generic Daily Data field card — used 6 times across Body + Nutrition.
 *
 *   label       short uppercase mono label, e.g. "Weight"
 *   targetRef   right-side mono ref text, e.g. "Target 70 kg"
 *   sourcePill  optional source attribution pill, e.g. "From Whoop", rendered
 *               between the input shell and the progress bar
 *   value       controlled input value (string)
 *   onChange    (newStr) => void
 *   unit        right-side unit, e.g. "kg"
 *   inputMode   default 'decimal' (matches mockup for numeric fields)
 *   placeholder placeholder text
 *   disabled    if true, the input is read-only and saved/saving classes
 *               don't apply
 *   stub        Phase 2 stub — applies .field-card.stub for the italic
 *               Fraunces helper styling
 *   progress    { pct, variant } — pct 0..100, variant 'sand'|'clay'|
 *               'slate'|null (null = default moss)
 *   helper      { chevron, tone, text } or { stubText } for stubs
 *   rowIndex    absolute row index across the page; drives the 60ms
 *               stagger on the first-paint bar entrance
 *   saved       drives the .saved class (shows the moss save-tick)
 *   saving      drives the .input-shell.saving border (sand)
 */
export default function FieldCard({
  label,
  targetRef,
  sourcePill = null,
  value,
  onChange,
  unit,
  inputMode = 'decimal',
  placeholder,
  disabled = false,
  stub = false,
  progress,
  helper,
  rowIndex = 0,
  saved = false,
  saving = false,
}) {
  // First-paint bar entrance: 0% → real pct after 400ms + 60ms stagger.
  // Subsequent prop changes update the bar width via the CSS transition
  // without re-triggering the entrance timer.
  const targetPct = progress?.pct ?? 0
  const [renderedPct, setRenderedPct] = useState(0)
  const firstPaintRef = useRef(false)
  useEffect(() => {
    if (!firstPaintRef.current) {
      const id = setTimeout(() => {
        setRenderedPct(targetPct)
        firstPaintRef.current = true
      }, 400 + rowIndex * 60)
      return () => clearTimeout(id)
    }
    setRenderedPct(targetPct)
  }, [targetPct, rowIndex])

  const fillClass = `fill${progress?.variant ? ` ${progress.variant}` : ''}`
  const shellClass = `input-shell${saving ? ' saving' : ''}${saved ? ' saved' : ''}`
  const cardClass = `field-card${saved ? ' saved' : ''}${stub ? ' stub' : ''}`

  return (
    <div className={cardClass}>
      <div className="row">
        <span className="label">{label}</span>
        {targetRef ? <span className="target">{targetRef}</span> : null}
      </div>
      <div className={shellClass}>
        <input
          type="text"
          inputMode={inputMode}
          value={value ?? ''}
          onChange={e => onChange?.(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
        />
        {unit ? <span className="unit">{unit}</span> : null}
        <svg className="save-tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12l5 5L20 7" />
        </svg>
      </div>
      {sourcePill ? <div className="field-source-pill">{sourcePill}</div> : null}
      <div className="progress">
        <div className={fillClass} style={{ width: `${renderedPct}%` }} />
      </div>
      <div className="helper">
        {stub ? (
          <span>{helper?.stubText || 'From Whoop — sync coming soon'}</span>
        ) : helper ? (
          <>
            {helper.chevron ? (
              <span className={`pct ${helper.tone || 'flat'}`}>{helper.chevron}</span>
            ) : null}
            <span>{helper.text}</span>
          </>
        ) : null}
      </div>
    </div>
  )
}
