'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'

// ── TEMPORARY diagnostic instrumentation (flip to false or revert to remove) ──
// Answers the one question that splits the bug in two: when the dialog vanishes,
// did a component UNMOUNT, or did onCancel FIRE? Every log is timestamped; the
// onCancel and confirmOpen logs carry a stack trace so the trigger is named.
export const DIALOG_DEBUG = true
export function dlog(...args) {
  if (!DIALOG_DEBUG || typeof window === 'undefined') return
  // eslint-disable-next-line no-console
  console.log(`[DLGDBG ${performance.now().toFixed(1)}]`, ...args)
}

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
  dlog('CadenceDialog render; open=', open)

  // Component lifecycle. CadenceDialog is mounted for as long as its parent
  // renders it (it returns null while closed), so this UNMOUNT firing is a
  // strong signal the PARENT tore the card down.
  useEffect(() => {
    dlog('CadenceDialog MOUNT')
    return () => dlog('CadenceDialog UNMOUNT')
  }, [])

  // Every path that dismisses routes through here, so we log who called it.
  const cancel = (e, source) => {
    dlog(`CadenceDialog onCancel FIRED via ${source}\n${new Error().stack}`)
    onCancel?.(e)
  }

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') cancel(e, 'escape') }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onCancel]) // eslint-disable-line react-hooks/exhaustive-deps

  // Environment events during the dialog's open window — the vanish happens
  // here, so we watch focus/visibility churn and any error thrown while open.
  useEffect(() => {
    if (!open || !DIALOG_DEBUG) return
    const onBlur   = () => dlog('window blur')
    const onFocus  = () => dlog('window focus')
    const onVis    = () => dlog('visibilitychange ->', document.visibilityState)
    const onErr    = (e) => dlog('window ERROR while open:', e.message, `\n${e.error?.stack ?? ''}`)
    const onRej    = (e) => dlog('unhandledrejection while open:', String(e.reason))
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('error', onErr)
    window.addEventListener('unhandledrejection', onRej)
    return () => {
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('error', onErr)
      window.removeEventListener('unhandledrejection', onRej)
    }
  }, [open])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="cadence-dialog-backdrop"
      data-cadence=""
      onMouseDown={(e) => cancel(e, 'backdrop mousedown')}
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
                <button type="button" className="btn btn-ghost" onClick={(e) => cancel(e, 'cancel button')}>
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
