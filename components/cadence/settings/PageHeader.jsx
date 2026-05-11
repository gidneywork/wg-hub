'use client'

/**
 * Settings page header — title, eyebrow sub, Reset/Save actions.
 * Pure presenter. The parent owns settings state and the save flow.
 */
export default function PageHeader({ onReset, onSave }) {
  return (
    <header className="page-header r r-1">
      <div>
        <h1 className="page-title">Goals &amp; <em>targets.</em></h1>
        <div className="page-sub">The numbers Cadence measures everything else against</div>
      </div>
      <div className="header-actions">
        <button type="button" className="btn btn-ghost" onClick={onReset}>Reset defaults</button>
        <button type="button" className="btn btn-primary" onClick={onSave}>Save</button>
      </div>
    </header>
  )
}
