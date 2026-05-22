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
import { computeBMR, ageFromBirthday, mostRecentWeightKg } from '../../../lib/bmr'

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
  userProfile,
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
  // Display waterfall: user manual entry → Whoop fallback (already merged
  // into `form` upstream) → BMR estimate (this session, read-time only).
  // BMR is shown as the placeholder and the "Estimated baseline" pill; it
  // is NEVER written into form/log state. Typing replaces it.
  const cOutVal = form?.body?.caloriesOut
  const cOutHasValue = cOutVal != null && cOutVal !== ''
  const rawCOut = logs?.[date]?.body?.caloriesOut
  const cOutFromWhoop = (rawCOut == null || rawCOut === '') && cOutHasValue

  const identity = userProfile?.identity
  const cOutBmrEstimate = !cOutHasValue
    ? computeBMR({
        heightCm:  identity?.heightCm,
        weightKg:  mostRecentWeightKg(logs, date),
        ageYears:  ageFromBirthday(identity?.dateOfBirth),
        sex:       identity?.biologicalSex,
      })
    : null
  const cOutFromBmr = !cOutHasValue && !cOutFromWhoop && cOutBmrEstimate != null
  const cOutSourcePill = cOutFromWhoop
    ? 'From Whoop'
    : cOutFromBmr
      ? 'Estimated baseline'
      : null

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
          sourcePill={cOutSourcePill}
          value={cOutVal}
          onChange={v => onField('body', 'caloriesOut', v)}
          unit="kcal"
          inputMode="numeric"
          placeholder="—"
          estimate={cOutFromBmr ? cOutBmrEstimate : null}
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
