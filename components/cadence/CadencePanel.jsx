'use client'

import { useEffect } from 'react'

export default function CadencePanel({
  open,
  title,
  body,
  confirmLabel    = 'Save',
  cancelLabel     = 'Cancel',
  confirmClass    = 'btn-primary',
  confirmDisabled = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onCancel?.() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onCancel]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null

  return (
    <div className="cadence-panel" data-cadence="">
      <div className="cadence-panel-title">{title}</div>
      {body && <div className="cadence-panel-body">{body}</div>}
      <div className="cadence-panel-actions">
        {cancelLabel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
        )}
        {confirmLabel != null && (
          <button
            type="button"
            className={`btn ${confirmClass}`}
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </button>
        )}
      </div>
    </div>
  )
}
