'use client'

import { useMemo } from 'react'
import { getMuscleGroups } from '../../../lib/exercises'
import { computeWeeklyMuscleVolume } from '../../../lib/volume'
import BodyGraph from './BodyGraph'

const MUSCLE_GROUPS = getMuscleGroups().filter(m => m !== 'cardio')

const fmtTonnage = n => Math.round(n).toLocaleString('en-GB')

export default function MuscleVolumePanel({ logs, currentWeekStart }) {
  const volume = useMemo(
    () => computeWeeklyMuscleVolume(logs, currentWeekStart),
    [logs, currentWeekStart]
  )

  const { totalTonnage, totalSets, byMuscle, unattributedTonnage } = volume

  const hasAnyLifts = totalSets > 0
  const hasAttributedLifts = MUSCLE_GROUPS.some(m => byMuscle[m]?.sets > 0)
  const maxMuscleTonnage = Math.max(...MUSCLE_GROUPS.map(m => byMuscle[m]?.tonnage ?? 0), 0)

  return (
    <section className="muscle-volume-panel r r-3">

      <div className="mvp-head">
        <span className="mvp-eyebrow">This week's load</span>
      </div>

      <div className="mvp-hero">
        <span className="mvp-number">
          {hasAnyLifts ? fmtTonnage(totalTonnage) : '—'}
        </span>
        {hasAnyLifts && <span className="mvp-unit">kg</span>}
        {hasAnyLifts && (
          <span className="mvp-sets">{totalSets} {totalSets === 1 ? 'set' : 'sets'}</span>
        )}
      </div>

      <div className="mvp-content">

        <div className="mvp-left">
          {!hasAnyLifts ? (
            <p className="mvp-empty">No lifts logged this week.</p>
          ) : !hasAttributedLifts ? (
            <p className="mvp-empty">
              All lifts unattributed — add to the exercise list to break down by muscle.
            </p>
          ) : (
            <>
              <div className="mvp-bars">
                {MUSCLE_GROUPS.map(muscle => {
                  const data = byMuscle[muscle]
                  const tonnage = data?.tonnage ?? 0
                  const isMax = tonnage > 0 && tonnage === maxMuscleTonnage
                  const pct = maxMuscleTonnage > 0 && tonnage > 0
                    ? Math.max(4, (tonnage / maxMuscleTonnage) * 100)
                    : 0
                  return (
                    <div key={muscle} className="mvp-bar-row">
                      <span className="mvp-label">{muscle}</span>
                      <div className="mvp-track">
                        <div
                          className={`mvp-fill${isMax ? ' peak' : ''}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="mvp-value">
                        {tonnage > 0 ? fmtTonnage(tonnage) : '—'}
                      </span>
                    </div>
                  )
                })}
              </div>

              {unattributedTonnage > 0 && (
                <p className="mvp-unattributed">
                  {fmtTonnage(unattributedTonnage)} kg unattributed — add to the exercise list to break down by muscle.
                </p>
              )}
            </>
          )}
        </div>

        <BodyGraph byMuscle={byMuscle} maxTonnage={maxMuscleTonnage} />

      </div>

    </section>
  )
}
