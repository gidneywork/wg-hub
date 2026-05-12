'use client'

import FieldCard from './FieldCard'
import {
  targetBand,
  fillVariantForBand,
  buildWeightHelper,
  buildMacroHelper,
  buildVitalsHelper,
  weeklyWeightDelta,
} from './dailyHelpers'

/**
 * Body section — four manual-entry field cards.
 *   Weight          settings.weightTarget — ±0.5 band, weekly delta helper
 *   Steps           settings.dailySteps — macro-style band + helper
 *   Calories burnt  settings.dailyCaloriesOut — macro-style band + helper
 *   Resting HR      settings.rhr — lowerIsBetter, vitals-style ▼ chevron
 *
 * The data field is body.rhr; the UI label uses the warmer "Resting HR"
 * phrasing rather than the engineering "RHR".
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
  const saving = saveState === 'saving'

  // Weight
  const weightTarget = settings?.weightTarget
  const weightVal = form?.body?.weight
  const weightBand = targetBand(weightVal, weightTarget)
  const weightHelper = buildWeightHelper(
    weightVal,
    weightTarget,
    weeklyWeightDelta(date, logs)
  )
  const weightHasValue = weightVal != null && weightVal !== ''

  // Steps
  const stepsTarget = settings?.dailySteps
  const stepsVal = form?.body?.steps
  const stepsBand = targetBand(stepsVal, stepsTarget)
  const stepsHelper = buildMacroHelper(stepsVal, stepsTarget, 'steps')
  const stepsHasValue = stepsVal != null && stepsVal !== ''

  // Calories burnt (data field body.caloriesOut, UI label "Calories burnt")
  const cOutTarget = settings?.dailyCaloriesOut
  const cOutVal = form?.body?.caloriesOut
  const cOutBand = targetBand(cOutVal, cOutTarget)
  const cOutHelper = buildMacroHelper(cOutVal, cOutTarget, 'kcal')
  const cOutHasValue = cOutVal != null && cOutVal !== ''
  const rawCOut = logs?.[date]?.body?.caloriesOut
  const cOutFromWhoop = (rawCOut == null || rawCOut === '') && cOutHasValue

  // Resting HR — lower is better
  const rhrTarget = settings?.rhr
  const rhrVal = form?.body?.rhr
  const rhrBand = targetBand(rhrVal, rhrTarget)
  const rhrHelper = buildVitalsHelper(rhrVal, rhrTarget)
  const rhrHasValue = rhrVal != null && rhrVal !== ''

  return (
    <section className="section r r-4">
      <div className="section-head">
        <span className="title">Body</span>
        <span className="meta">4 fields · manual entry</span>
      </div>
      <div className="field-grid cols-4">

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
          targetRef={stepsTarget?.value ? `Target ${stepsTarget.value} steps` : null}
          value={stepsVal}
          onChange={v => onField('body', 'steps', v)}
          unit="steps"
          inputMode="numeric"
          placeholder="—"
          progress={{
            pct:     stepsBand?.pct ?? 0,
            variant: fillVariantForBand(stepsBand?.band),
          }}
          helper={stepsHelper}
          rowIndex={1}
          saved={recentlySaved && stepsHasValue && !saving}
          saving={saving && stepsHasValue}
        />

        <FieldCard
          label="Calories burnt"
          targetRef={cOutTarget?.value ? `Target ${cOutTarget.value} kcal` : null}
          sourcePill={cOutFromWhoop ? 'From Whoop' : null}
          value={cOutVal}
          onChange={v => onField('body', 'caloriesOut', v)}
          unit="kcal"
          inputMode="numeric"
          placeholder="—"
          progress={{
            pct:     cOutBand?.pct ?? 0,
            variant: fillVariantForBand(cOutBand?.band),
          }}
          helper={cOutHelper}
          rowIndex={2}
          saved={recentlySaved && cOutHasValue && !saving}
          saving={saving && cOutHasValue}
        />

        <FieldCard
          label="Resting HR"
          targetRef={rhrTarget?.value ? `Target ${rhrTarget.value} bpm` : null}
          value={rhrVal}
          onChange={v => onField('body', 'rhr', v)}
          unit="bpm"
          inputMode="numeric"
          placeholder="—"
          progress={{
            pct:     rhrBand?.pct ?? 0,
            variant: fillVariantForBand(rhrBand?.band),
          }}
          helper={rhrHelper}
          rowIndex={3}
          saved={recentlySaved && rhrHasValue && !saving}
          saving={saving && rhrHasValue}
        />

      </div>
    </section>
  )
}
