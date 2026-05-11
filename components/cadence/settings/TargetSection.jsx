'use client'

import TargetRow from './TargetRow'

/**
 * One settings-section card containing N target rows.
 * Section card chrome (moss left-border, mono eyebrow) comes from the
 * shared .settings-section CSS class.
 */
export default function TargetSection({
  label,
  rN,
  keys,
  local,
  currents,
  setTarget,
  baseRowIndex,
}) {
  return (
    <section className={`settings-section r ${rN}`}>
      <div className="section-head">
        <span className="section-label">{label}</span>
      </div>
      <div className="section-body">
        {keys.map((k, i) => (
          <TargetRow
            key={k}
            targetKey={k}
            def={local[k]}
            actual={currents[k]}
            rowIndex={baseRowIndex + i}
            onChange={v => setTarget(k, v)}
          />
        ))}
      </div>
    </section>
  )
}
