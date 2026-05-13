'use client'

import { useState } from 'react'
import { SILHOUETTE, FRONT_REGIONS, BACK_REGIONS, muscleOpacity } from '../../../lib/bodyPaths'

function Figure({ regions, byMuscle, maxTonnage }) {
  return (
    <svg viewBox="0 0 100 220" aria-hidden="true">
      {regions.map((region, i) => {
        const tonnage = byMuscle[region.muscle]?.tonnage ?? 0
        const opacity = muscleOpacity(tonnage, maxTonnage)
        const isActive = opacity > 0
        const cls = `mvp-region${isActive ? ' active' : ''}`
        const style = isActive ? { fillOpacity: opacity } : undefined

        if (region.type === 'ellipse') {
          return (
            <ellipse
              key={i}
              className={cls}
              cx={region.cx} cy={region.cy}
              rx={region.rx} ry={region.ry}
              style={style}
            />
          )
        }
        return (
          <path
            key={i}
            className={cls}
            d={region.d}
            style={style}
          />
        )
      })}

      {SILHOUETTE.map((el, i) => {
        if (el.type === 'circle') {
          return <circle key={`s${i}`} className="mvp-silhouette" cx={el.cx} cy={el.cy} r={el.r} />
        }
        return <path key={`s${i}`} className="mvp-silhouette" d={el.d} />
      })}
    </svg>
  )
}

export default function BodyGraph({ byMuscle, maxTonnage }) {
  const [view, setView] = useState('front')

  return (
    <div className="mvp-body-graph" data-view={view}>
      <div className="mvp-figures">
        <div className="mvp-figure mvp-figure-front">
          <Figure regions={FRONT_REGIONS} byMuscle={byMuscle} maxTonnage={maxTonnage} />
          <span className="mvp-figure-label">Front</span>
        </div>
        <div className="mvp-figure mvp-figure-back">
          <Figure regions={BACK_REGIONS} byMuscle={byMuscle} maxTonnage={maxTonnage} />
          <span className="mvp-figure-label">Back</span>
        </div>
      </div>

      <div className="toggle mvp-view-toggle">
        <button
          type="button"
          className={view === 'front' ? 'active' : ''}
          onClick={() => setView('front')}
        >Front</button>
        <button
          type="button"
          className={view === 'back' ? 'active' : ''}
          onClick={() => setView('back')}
        >Back</button>
      </div>
    </div>
  )
}
