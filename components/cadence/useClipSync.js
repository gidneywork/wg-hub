'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * useClipSync — write queue for the Clipping view (FC-090).
 *
 * - queue(kind, key, payload): debounced (400 ms) per key; the latest payload
 *   for a key wins. { immediate: true } skips the debounce (checklist ticks).
 * - Every pending write is mirrored to a localStorage outbox, so a write cut
 *   off by Safari closing is replayed on the next load (see readClipOutbox and
 *   shouldReplay in lib/clipping.js). Each entry carries queuedAt (ms).
 * - Flushes every pending write on visibilitychange (hidden), pagehide and
 *   unmount.
 * - A failed write stays pending and retries with back-off (2 s doubling to
 *   30 s), and again on 'online' and when the page becomes visible. The local
 *   value is never rolled back.
 *
 * handlers: { [kind]: async (payload) => void } — read through a ref, so the
 * caller may pass a fresh object each render.
 */

const DEBOUNCE_MS = 400
const OUTBOX_KEY  = 'cadence-clip-outbox'

export function readClipOutbox() {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch { return [] }
}

export function clearClipOutbox() {
  try { localStorage.removeItem(OUTBOX_KEY) } catch { /* storage unavailable */ }
}

function writeOutbox(pending) {
  try {
    const list = [...pending.values()]
    if (list.length) localStorage.setItem(OUTBOX_KEY, JSON.stringify(list))
    else localStorage.removeItem(OUTBOX_KEY)
  } catch { /* storage unavailable: the in-memory queue still retries */ }
}

export default function useClipSync(handlers) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  const pending  = useRef(new Map())   // id → { kind, key, payload, queuedAt }
  const timers   = useRef(new Map())   // id → timeout
  const inflight = useRef(new Set())
  const attempts = useRef(new Map())   // id → failed attempts
  const [failing, setFailing] = useState(false)

  const updateFailing = () => setFailing(attempts.current.size > 0)

  const fire = useCallback(async (id) => {
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    if (inflight.current.has(id)) return        // re-fired in finally
    const entry = pending.current.get(id)
    if (!entry) return
    inflight.current.add(id)
    try {
      await handlersRef.current[entry.kind](entry.payload)
      if (pending.current.get(id) === entry) {
        pending.current.delete(id)
        writeOutbox(pending.current)
      }
      attempts.current.delete(id)
      updateFailing()
    } catch (e) {
      console.error('Clipping save failed:', e)
      const n = (attempts.current.get(id) || 0) + 1
      attempts.current.set(id, n)
      updateFailing()
      const delay = Math.min(2000 * 2 ** (n - 1), 30000)
      timers.current.set(id, setTimeout(() => fire(id), delay))
    } finally {
      inflight.current.delete(id)
      const latest = pending.current.get(id)
      if (latest && latest !== entry && !timers.current.has(id)) {
        timers.current.set(id, setTimeout(() => fire(id), DEBOUNCE_MS))
      }
    }
  }, [])

  const flushAll = useCallback(() => {
    for (const id of pending.current.keys()) fire(id)
  }, [fire])

  // queuedAt defaults to now; replayed outbox entries keep their original.
  const queue = useCallback((kind, key, payload, { immediate = false, queuedAt = Date.now() } = {}) => {
    const id = `${kind}:${key}`
    pending.current.set(id, { kind, key, payload, queuedAt })
    writeOutbox(pending.current)
    clearTimeout(timers.current.get(id))
    if (immediate) fire(id)
    else timers.current.set(id, setTimeout(() => fire(id), DEBOUNCE_MS))
  }, [fire])

  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === 'hidden' || attempts.current.size) flushAll() }
    window.addEventListener('pagehide', flushAll)
    window.addEventListener('online', flushAll)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flushAll)
      window.removeEventListener('online', flushAll)
      document.removeEventListener('visibilitychange', onVisibility)
      flushAll()
    }
  }, [flushAll])

  return { queue, flushAll, failing }
}
