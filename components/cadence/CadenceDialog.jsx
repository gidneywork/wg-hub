'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export default function CadenceDialog({
  open,
  title,
  body,
  confirmLabel    = 'Confirm',
  cancelLabel     = 'Cancel',
  confirmClass    = 'btn-danger',
  confirmDisabled = false,
  footerExtra     = null,
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
        aria-labelledby="cadence-dialog-title"
        onClick={e => e.stopPropagation()}
      >
        <div className="cadence-dialog-title" id="cadence-dialog-title">{title}</div>
        {body && <div className="cadence-dialog-body">{body}</div>}
        {(footerExtra || cancelLabel || confirmLabel != null) && (
          <div className="cadence-dialog-actions">
            {footerExtra && <div className="cadence-dialog-actions-left">{footerExtra}</div>}
            <div className="cadence-dialog-actions-right">
              {cancelLabel && (
                <button type="button" className="btn btn-ghost" onClick={onCancel}>
                  {cancelLabel}
                </button>
              )}
              {confirmLabel != null && (
                <button type="button" className={`btn ${confirmClass}`} onClick={onConfirm} disabled={confirmDisabled}>
                  {confirmLabel}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
