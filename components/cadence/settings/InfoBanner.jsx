'use client'

/**
 * Settings info banner — the explainer above the target sections.
 * Static markup; strings verbatim from the mockup.
 */
export default function InfoBanner() {
  return (
    <div className="info-banner r r-2">
      <div className="info-banner-eyebrow">How targets work</div>
      <div className="info-banner-body">
        Cadence measures every metric — dashboard, charts, daily log — against the targets you set here. Bars show where you currently stand.
        <span className="info-states">
          <span className="item"><span className="pip moss" />On target</span>
          <span className="item"><span className="pip sand" />Approaching</span>
          <span className="item"><span className="pip clay" />Off target</span>
        </span>
      </div>
    </div>
  )
}
