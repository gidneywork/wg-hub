'use client'

import FieldCard from './FieldCard'
import {
  targetBand,
  fillVariantForBand,
  buildWeightHelper,
  weeklyWeightDelta,
} from './dailyHelpers'

/**
 * Body section — three field cards.
 *   Weight        real, target-driven (settings.weightTarget)
 *   Steps         Phase 2 stub — disabled, "From Whoop — sync coming soon"
 *   Calories burnt Phase 2 stub — same pattern
 */
export default function BodySection({
  date,
  form,
  logs,
  settings,
  onField,
  recentlySaved,
  saveState,
}) {
  const weightTarget = settings?.weightTarget
  const weightVal = form?.body?.weight
  const weightBand = targetBand(weightVal, weightTarget)
  const weightHelper = buildWeightHelper(
    weightVal,
    weightTarget,
    weeklyWeightDelta(date, logs)
  )
  const weightHasValue = weightVal != null && weightVal !== ''
  const saving = saveState === 'saving'

  return (
    <section className="section r r-4">
      <div className="section-head">
        <span className="title">Body</span>
        <span className="meta">3 fields · manual entry</span>
      </div>
      <div className="field-grid">

        <FieldCard
          label="Weight"
          targetRef={weightTarget?.value ? `Target ${weightTarget.value} kg` : null}
          value={weightVal}
          onChange={v => onField('body', 'weight', v)}
          unit="kg"
          inputMode="decimal"
          placeholder="—"
          progress={{
            pct:     weightBand?.pct ?? 0,
            variant: fillVariantForBand(weightBand?.band),
          }}
          helper={weightHelper}
          rowIndex={0}
          saved={recentlySaved && weightHasValue && !saving}
          saving={saving && weightHasValue}
        />

        <FieldCard
          label="Steps"
          targetRef="From Whoop"
          value=""
          unit="steps"
          disabled
          stub
          progress={{ pct: 0, variant: 'slate' }}
          helper={{ stubText: 'From Whoop — sync coming soon' }}
          rowIndex={1}
        />

        <FieldCard
          label="Calories burnt"
          targetRef="From Whoop"
          value=""
          unit="kcal"
          disabled
          stub
          progress={{ pct: 0, variant: 'slate' }}
          helper={{ stubText: 'From Whoop — sync coming soon' }}
          rowIndex={2}
        />

      </div>
    </section>
  )
}
