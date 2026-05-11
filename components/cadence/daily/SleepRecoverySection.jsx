'use client'

import FieldCard from './FieldCard'
import {
  targetBand,
  fillVariantForBand,
  buildVitalsHelper,
} from './dailyHelpers'

/**
 * Sleep & recovery section — four manual-entry field cards.
 *   Hours slept   sleep.hoursSlept    target settings.hoursSlept    higher = better, decimal
 *   Sleep score   sleep.sleepScore    target settings.sleepScore    higher = better
 *   HRV           body.hrv            target settings.hrv           higher = better
 *   Recovery      sleep.recoveryScore target settings.recoveryScore higher = better
 *
 * All four pre-fill from whoopData when the log field is empty
 * (see loadFormFromLog) so a Whoop CSV upload becomes the starting
 * point and any user edit promotes the value to log-owned.
 */
export default function SleepRecoverySection({
  form,
  settings,
  onField,
  recentlySaved,
  saveState,
  baseRowIndex = 4,
}) {
  const saving = saveState === 'saving'

  // Hours slept (decimal — sub-unit precision in the helper)
  const hoursTarget = settings?.hoursSlept
  const hoursVal = form?.sleep?.hoursSlept
  const hoursBand = targetBand(hoursVal, hoursTarget)
  const hoursHelper = buildVitalsHelper(hoursVal, hoursTarget, 1)
  const hoursHasValue = hoursVal != null && hoursVal !== ''

  // Sleep score (/100)
  const sleepScTarget = settings?.sleepScore
  const sleepScVal = form?.sleep?.sleepScore
  const sleepScBand = targetBand(sleepScVal, sleepScTarget)
  const sleepScHelper = buildVitalsHelper(sleepScVal, sleepScTarget)
  const sleepScHasValue = sleepScVal != null && sleepScVal !== ''

  // HRV (ms)
  const hrvTarget = settings?.hrv
  const hrvVal = form?.body?.hrv
  const hrvBand = targetBand(hrvVal, hrvTarget)
  const hrvHelper = buildVitalsHelper(hrvVal, hrvTarget)
  const hrvHasValue = hrvVal != null && hrvVal !== ''

  // Recovery (/100)
  const recovTarget = settings?.recoveryScore
  const recovVal = form?.sleep?.recoveryScore
  const recovBand = targetBand(recovVal, recovTarget)
  const recovHelper = buildVitalsHelper(recovVal, recovTarget)
  const recovHasValue = recovVal != null && recovVal !== ''

  return (
    <section className="section r r-5">
      <div className="section-head">
        <span className="title">Sleep &amp; recovery</span>
        <span className="meta">4 fields · manual entry</span>
      </div>
      <div className="field-grid cols-4">

        <FieldCard
          label="Hours slept"
          targetRef={hoursTarget?.value ? `Target ${hoursTarget.value} hrs` : null}
          value={hoursVal}
          onChange={v => onField('sleep', 'hoursSlept', v)}
          unit="h"
          inputMode="decimal"
          placeholder="—"
          progress={{
            pct:     hoursBand?.pct ?? 0,
            variant: fillVariantForBand(hoursBand?.band),
          }}
          helper={hoursHelper}
          rowIndex={baseRowIndex + 0}
          saved={recentlySaved && hoursHasValue && !saving}
          saving={saving && hoursHasValue}
        />

        <FieldCard
          label="Sleep score"
          targetRef={sleepScTarget?.value ? `Target ${sleepScTarget.value}+` : null}
          value={sleepScVal}
          onChange={v => onField('sleep', 'sleepScore', v)}
          unit="/100"
          inputMode="numeric"
          placeholder="—"
          progress={{
            pct:     sleepScBand?.pct ?? 0,
            variant: fillVariantForBand(sleepScBand?.band),
          }}
          helper={sleepScHelper}
          rowIndex={baseRowIndex + 1}
          saved={recentlySaved && sleepScHasValue && !saving}
          saving={saving && sleepScHasValue}
        />

        <FieldCard
          label="HRV"
          targetRef={hrvTarget?.value ? `Target ${hrvTarget.value} ms` : null}
          value={hrvVal}
          onChange={v => onField('body', 'hrv', v)}
          unit="ms"
          inputMode="numeric"
          placeholder="—"
          progress={{
            pct:     hrvBand?.pct ?? 0,
            variant: fillVariantForBand(hrvBand?.band),
          }}
          helper={hrvHelper}
          rowIndex={baseRowIndex + 2}
          saved={recentlySaved && hrvHasValue && !saving}
          saving={saving && hrvHasValue}
        />

        <FieldCard
          label="Recovery"
          targetRef={recovTarget?.value ? `Target ${recovTarget.value}+` : null}
          value={recovVal}
          onChange={v => onField('sleep', 'recoveryScore', v)}
          unit="/100"
          inputMode="numeric"
          placeholder="—"
          progress={{
            pct:     recovBand?.pct ?? 0,
            variant: fillVariantForBand(recovBand?.band),
          }}
          helper={recovHelper}
          rowIndex={baseRowIndex + 3}
          saved={recentlySaved && recovHasValue && !saving}
          saving={saving && recovHasValue}
        />

      </div>
    </section>
  )
}
