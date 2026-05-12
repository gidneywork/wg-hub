'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'

/**
 * CadenceDialog — reusable confirm/cancel modal.
 *
 *   open          controlled open state
 *   title         Fraunces heading
 *   body          optional descriptive text or ReactNode (e.g. annotation form)
 *   confirmLabel  label for the confirm button (default "Confirm")
 *   cancelLabel   label for the cancel button — omit or pass null to hide it
 *   confirmClass  CSS modifier on the confirm button (default "btn-danger")
 *   footerExtra   optional ReactNode rendered left of Cancel/Confirm buttons
 *                 (e.g. a Delete button in annotation edit mode)
 *   onConfirm     called when user clicks confirm
 *   onCancel      called when user clicks cancel, Esc, or backdrop
 */
export default function CadenceDialog({
  open,
  title,
  body,
  confirmLabel    = 'Confirm',
  cancelLabel     = 'Cancel',
  confirmClass    = 'btn-danger',
  confirmDisabled = false,
  footerExtra     = null,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onCancel?.() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onCancel])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="cadence-dialog-backdrop" data-cadence="" onClick={onCancel}>
      <div
        className="cadence-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cadence-dialog-title"
        onClick={e => e.stopPropagation()}
      >
        <div className="cadence-dialog-title" id="cadence-dialog-title">{title}</div>
        {body && <div className="cadence-dialog-body">{body}</div>}
        <div className="cadence-dialog-actions">
          {footerExtra && <div className="cadence-dialog-actions-left">{footerExtra}</div>}
          <div className="cadence-dialog-actions-right">
            {cancelLabel && (
              <button type="button" className="btn btn-ghost" onClick={onCancel}>
                {cancelLabel}
              </button>
            )}
            <button type="button" className={`btn ${confirmClass}`} onClick={onConfirm} disabled={confirmDisabled}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
