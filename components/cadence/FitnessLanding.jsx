'use client'

import CadenceTraining from './Training'
import ThisWeeksLifts from './ThisWeeksLifts'

export default function FitnessLanding({ plan, savePlan, settings, getDefaultPlan, logs }) {
  return (
    <div>
      <header className="header r r-1">
        <div>
          <p className="stamp">Pillar</p>
          <h1 className="greeting">Fitness</h1>
          <p className="pillar-tag">Training, performance, progression. Sessions, plans, lifts.</p>
        </div>
      </header>

      <CadenceTraining
        plan={plan}
        savePlan={savePlan}
        settings={settings}
        getDefaultPlan={getDefaultPlan}
      />

      <ThisWeeksLifts logs={logs} />

      <section className="section r r-9">
        <div className="section-head">
          <h2>More Fitness reports</h2>
        </div>
        <p className="pillar-placeholder">Coming soon.</p>
      </section>
    </div>
  )
}
