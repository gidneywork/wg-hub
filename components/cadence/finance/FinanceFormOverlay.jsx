'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export default function FinanceFormOverlay({
  open,
  title,
  body,
  confirmLabel    = 'Save',
  cancelLabel     = 'Cancel',
  confirmClass    = 'btn-primary',
  confirmDisabled = false,
  dialogClass     = '',
  onConfirm,
  onCancel,
}) {
  const [readyToRender, setReadyToRender] = useState(false)

  useEffect(() => {
    if (open) {
      const id = setTimeout(() => setReadyToRender(true), 0)
      return () => clearTimeout(id)
    } else {
      setReadyToRender(false)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onCancel?.() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onCancel]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !readyToRender || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="cadence-dialog-backdrop"
      data-cadence=""
      onClick={onCancel}
    >
      <div
        className={`cadence-dialog${dialogClass ? ` ${dialogClass}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="finance-overlay-title"
        onClick={e => e.stopPropagation()}
      >
        <div className="cadence-dialog-title" id="finance-overlay-title">{title}</div>
        {body && <div className="cadence-dialog-body">{body}</div>}
        <div className="cadence-dialog-actions">
          <div className="cadence-dialog-actions-right">
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
      </div>
    </div>,
    document.body
  )
}
