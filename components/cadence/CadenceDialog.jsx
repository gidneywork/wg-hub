'use client'

import { useEffect } from 'react'
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
  // Outside-dismiss fires on the backdrop's mousedown (below), NOT on click.
  // This is what makes the dialog immune to the interaction that opened it: the
  // opening mousedown landed on the trigger button BEFORE this backdrop existed,
  // so the backdrop can never receive it. A genuine dismiss needs a fresh
  // mousedown that lands on the backdrop. No timers, no mount-delay gate, no
  // render-order race — the earlier setTimeout/readyToRender machinery guarded a
  // race that cannot occur once dismissal is mousedown-based, so it is gone.
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onCancel?.() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onCancel]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="cadence-dialog-backdrop"
      data-cadence=""
      onMouseDown={onCancel}
    >
      <div
        className={`cadence-dialog${dialogClass ? ` ${dialogClass}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cadence-dialog-title"
        onMouseDown={e => e.stopPropagation()}
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
