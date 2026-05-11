'use client'

import FieldCard from './FieldCard'
import {
  targetBand,
  fillVariantForBand,
  buildMacroHelper,
} from './dailyHelpers'

/**
 * Nutrition section — three field cards. All real, all target-driven.
 *   Calories  settings.dailyCalories
 *   Protein   settings.dailyProtein
 *   Carbs     settings.dailyCarbs
 */
export default function NutritionSection({
  form,
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
    <section className="section r r-6">
      <div className="section-head">
        <span className="title">Nutrition</span>
        <span className="meta">Manual entry · target shown on each</span>
      </div>
      <div className="field-grid">
        {rows.map((row, i) => {
          const target = settings?.[row.targetKey]
          const value = form?.nutrition?.[row.key]
          const band = targetBand(value, target)
          const helper = buildMacroHelper(value, target, row.unitShort)
          const hasValue = value != null && value !== ''
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
