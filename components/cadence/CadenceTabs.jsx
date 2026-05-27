'use client'

export default function CadenceTabs({ tabs, activeTab, onTabChange }) {
  return (
    <div className="ct-tabs" role="tablist">
      {tabs.map(tab => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={activeTab === tab.key}
          type="button"
          className={`ct-tab${activeTab === tab.key ? ' ct-tab--active' : ''}`}
          onClick={() => onTabChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
