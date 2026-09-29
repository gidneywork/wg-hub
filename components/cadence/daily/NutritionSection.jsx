'use client'

import FieldCard from './FieldCard'
import CronometerRefresh from '../CronometerRefresh'
import { mergeNutritionForDate, nutritionTargetsForDate } from '../helpers'
import {
  targetBand,
  fillVariantForBand,
  buildMacroHelper,
} from './dailyHelpers'

/**
 * Nutrition section — three field cards. All real, all target-driven.
 *   Calories  target: Cronometer's for the day, else settings.dailyCalories
 *   Protein   target: Cronometer's for the day, else settings.dailyProtein
 *   Carbs     target: Cronometer's net carbs for the day, else settings.dailyCarbs
 *
 * Cronometer values (FC-084) show as the field's placeholder with a "From
 * Cronometer" pill; the form value stays empty until something is typed, so a
 * synced value is never saved into daily_logs (intake changes through the
 * day). A typed value wins. Bands and helpers use the effective value.
 */
export default function NutritionSection({
  date,
  form,
  cronometerData,
  settings,
  onField,
  recentlySaved,
  saveState,
  baseRowIndex = 3,
}) {
  const saving = saveState === 'saving'

  const rows = [
    {
      key:    'calories',
      label:  'Calories',
      unit:   'kcal',
      targetKey: 'dailyCalories',
      unitShort: 'kcal',
    },
    {
      key:    'protein',
      label:  'Protein',
      unit:   'g',
      targetKey: 'dailyProtein',
      unitShort: 'g',
    },
    {
      key:    'carbs',
      label:  'Carbs',
      unit:   'g',
      targetKey: 'dailyCarbs',
      unitShort: 'g',
    },
    // Water (FC-084): typed in litres; synced and targeted in ml.
    {
      key:    'water',
      label:  'Water',
      unit:   'L',
      targetKey: 'dailyWater',
      unitShort: 'L',
      inputMode: 'decimal',
      mergedValue: m => (m.water_ml != null ? m.water_ml / 1000 : null),
      targetFrom:  t => (t.water_ml != null ? t.water_ml / 1000 : null),
      showEstimate: v => v.toFixed(1),
    },
  ]

  return (
    <section className="section r r-7">
      <div className="section-head">
        <span className="title">Nutrition</span>
        <span className="meta">
          <span>{rows.length} fields · from Cronometer, editable</span>
          <CronometerRefresh />
        </span>
      </div>
      <div className="field-grid">
        {rows.map((row, i) => {
          const value = form?.nutrition?.[row.key]
          const hasValue = value != null && value !== ''
          const merged = mergeNutritionForDate(date, { nutrition: form?.nutrition }, cronometerData)
          const mergedVal = row.mergedValue ? row.mergedValue(merged) : merged[row.key]
          const fromCronometer = !hasValue && merged.source[row.key] === 'cronometer' ? mergedVal : null
          // Judged as displayed: a synced value is shown rounded (kcal/g to
          // whole numbers, water to 0.1 L).
          const effective = hasValue ? value
            : fromCronometer == null ? null
            : row.showEstimate ? row.showEstimate(fromCronometer) : Math.round(fromCronometer)
          const allTargets = nutritionTargetsForDate(date, cronometerData, settings)
          const targetValue = row.targetFrom ? row.targetFrom(allTargets) : allTargets[row.key]
          const target = targetValue != null ? { ...(settings?.[row.targetKey] || {}), value: targetValue } : null
          const band = targetBand(effective, target)
          const helper = buildMacroHelper(effective, target, row.unitShort)
          const targetRef = target?.value
            ? `Target ${row.key === 'water' ? Number(target.value).toFixed(1) : Number(target.value).toLocaleString('en-GB')} ${row.unitShort}`
            : null
          return (
            <FieldCard
              key={row.key}
              label={row.label}
              targetRef={targetRef}
              value={value}
              onChange={v => onField('nutrition', row.key, v)}
              unit={row.unit}
              inputMode={row.inputMode || 'numeric'}
              placeholder="—"
              estimate={fromCronometer != null ? (row.showEstimate ? row.showEstimate(fromCronometer) : Math.round(fromCronometer)) : null}
              sourcePill={fromCronometer != null ? 'From Cronometer' : null}
              progress={{
                pct:     band?.pct ?? 0,
                variant: fillVariantForBand(band?.band),
              }}
              helper={helper}
              rowIndex={baseRowIndex + i}
              saved={recentlySaved && hasValue && !saving}
              saving={saving && hasValue}
            />
          )
        })}
      </div>
    </section>
  )
}
