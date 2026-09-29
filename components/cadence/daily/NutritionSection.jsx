'use client'

import FieldCard from './FieldCard'
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
  ]

  return (
    <section className="section r r-7">
      <div className="section-head">
        <span className="title">Nutrition</span>
        <span className="meta">Manual entry · target shown on each</span>
      </div>
      <div className="field-grid">
        {rows.map((row, i) => {
          const value = form?.nutrition?.[row.key]
          const hasValue = value != null && value !== ''
          const merged = mergeNutritionForDate(date, { nutrition: form?.nutrition }, cronometerData)
          const fromCronometer = !hasValue && merged.source[row.key] === 'cronometer' ? merged[row.key] : null
          const effective = hasValue ? value : fromCronometer
          const targetValue = nutritionTargetsForDate(date, cronometerData, settings)[row.key]
          const target = targetValue != null ? { ...(settings?.[row.targetKey] || {}), value: targetValue } : null
          const band = targetBand(effective, target)
          const helper = buildMacroHelper(effective, target, row.unitShort)
          const targetRef = target?.value
            ? `Target ${Number(target.value).toLocaleString('en-GB')} ${row.unitShort}`
            : null
          return (
            <FieldCard
              key={row.key}
              label={row.label}
              targetRef={targetRef}
              value={value}
              onChange={v => onField('nutrition', row.key, v)}
              unit={row.unit}
              inputMode="numeric"
              placeholder="—"
              estimate={fromCronometer != null ? Math.round(fromCronometer) : null}
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
