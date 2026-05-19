'use client'

import { useEffect, useRef, useState } from 'react'
import SaveStatus from './daily/SaveStatus'
import DateNav from './daily/DateNav'
import SyncedTiles from './daily/SyncedTiles'
import BodySection from './daily/BodySection'
import SleepRecoverySection from './daily/SleepRecoverySection'
import SleepScheduleSection from './daily/SleepScheduleSection'
import NutritionSection from './daily/NutritionSection'
import LiftsSection from './daily/LiftsSection'
import FeelingsSection from './daily/FeelingsSection'
import DayFooter from './daily/DayFooter'
import {
  todayIso,
  mkEmptyForm,
  loadFormFromLog,
} from './daily/dailyHelpers'

/**
 * Cadence — Daily Data page.
 *
 * Mockup: design/mockups/cadence-daily-data.html
 * Page head + date nav + synced tiles + body + nutrition with
 * debounced auto-save are wired. Lifts and how-it-landed (Phase 2
 * stubs) arrive next, footer + self-check after.
 */
const DEBOUNCE_MS = 700
const RECENT_SAVE_MS = 2000

export default function Daily({
  logs,
  saveLog,
  settings,
  whoopData,
  activities,
  stravaConnection,
  onStravaConnectionChange,
  userProfile,
  plan,
}) {
  const [date, setDate] = useState(todayIso())
  const [form, setForm] = useState(() => loadFormFromLog(logs?.[date], whoopData?.[date]))

  // Auto-save state surfaced to the SaveStatus pill.
  const [saveState, setSaveState] = useState('idle')   // 'idle' | 'saving'
  const [savedAt,   setSavedAt]   = useState(() => new Date())
  const [recentlySaved, setRecentlySaved] = useState(false)

  // ── Auto-save plumbing
  // Refs so the timer callback always reads the latest values without
  // re-creating the debounce on every keystroke. pendingRef holds the
  // most recent { date, form } snapshot; the timer fires once after the
  // user stops typing for DEBOUNCE_MS.
  const pendingRef    = useRef(null)
  const timerRef      = useRef(null)
  const inFlightRef   = useRef(false)
  const dateRef       = useRef(date)
  const recentTimerRef = useRef(null)

  useEffect(() => { dateRef.current = date }, [date])

  const fireSave = async () => {
    if (inFlightRef.current) return
    if (!pendingRef.current) return
    const { date: snapDate, form: snapForm } = pendingRef.current
    pendingRef.current = null
    inFlightRef.current = true
    setSaveState('saving')
    try {
      // weightTime is auto-stamped on every save (T7 ruling: option b).
      const toSave = {
        ...snapForm,
        body: { ...snapForm.body, weightTime: new Date().toISOString() },
      }
      await saveLog(snapDate, toSave)
      setSavedAt(new Date())
      setRecentlySaved(true)
      clearTimeout(recentTimerRef.current)
      recentTimerRef.current = setTimeout(() => setRecentlySaved(false), RECENT_SAVE_MS)
    } catch (e) {
      // Surface failures silently for now — the pill returns to idle
      // and the next keystroke will retry.
      console.error('Daily save failed:', e)
    } finally {
      inFlightRef.current = false
      setSaveState('idle')
      // If new edits arrived while the save was in flight, schedule
      // another debounce window from now.
      if (pendingRef.current) scheduleSave()
    }
  }

  const scheduleSave = () => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(fireSave, DEBOUNCE_MS)
  }

  const onField = (section, key, value) => {
    setForm(prev => {
      const next = { ...prev, [section]: { ...prev[section], [key]: value } }
      pendingRef.current = { date: dateRef.current, form: next }
      return next
    })
    scheduleSave()
  }

  const onLiftsChange = (newLifts) => {
    setForm(prev => {
      const next = { ...prev, lifts: newLifts }
      pendingRef.current = { date: dateRef.current, form: next }
      return next
    })
    scheduleSave()
  }

  const onSkipLift = (key) => {
    setForm(prev => {
      const current = Array.isArray(prev.feelings?.skippedLifts) ? prev.feelings.skippedLifts : []
      const next = { ...prev, feelings: { ...prev.feelings, skippedLifts: [...current, key] } }
      pendingRef.current = { date: dateRef.current, form: next }
      return next
    })
    scheduleSave()
  }

  // ── Date change
  // When the user navigates to a different date, flush any pending save
  // for the OLD date FIRST, then re-populate the form from logs[newDate].
  // We don't depend on `logs` here so realtime updates from Supabase
  // don't stomp local typing — only the explicit date change re-loads.
  const prevDateRef = useRef(date)
  useEffect(() => {
    if (prevDateRef.current === date) return
    // Flush pending — pendingRef already carries the old date snapshot.
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      if (pendingRef.current) fireSave()
    }
    prevDateRef.current = date
    setForm(loadFormFromLog(logs?.[date], whoopData?.[date]))
    // Reset the "recently saved" tick state — it shouldn't leak across
    // days; the new day starts in a neutral state.
    setRecentlySaved(false)
  }, [date])

  // Initial mount: if logs hydrates after first render, load it into
  // the form. Subsequent log changes don't override local typing.
  const hydratedRef = useRef(false)
  useEffect(() => {
    if (hydratedRef.current) return
    if ((logs && Object.keys(logs).length > 0) ||
        (whoopData && Object.keys(whoopData).length > 0)) {
      setForm(loadFormFromLog(logs?.[date], whoopData?.[date]))
      hydratedRef.current = true
    }
  }, [logs, whoopData, date])

  return (
    <div className="daily-page">

      <header className="page-head r r-1">
        <div>
          <div className="eyebrow">Entry</div>
          <h1>Daily data<span style={{ color: 'var(--moss)' }}>.</span></h1>
          <p className="sub">Body, nutrition, lifts, and how it landed.</p>
        </div>
        <SaveStatus state={saveState} savedAt={savedAt} />
      </header>

      <DateNav date={date} setDate={setDate} logs={logs} />

      <SyncedTiles
        date={date}
        whoopData={whoopData}
        activities={activities}
        stravaConnection={stravaConnection}
        onSynced={onStravaConnectionChange}
      />

      <BodySection
        date={date}
        form={form}
        logs={logs}
        settings={settings}
        userProfile={userProfile}
        onField={onField}
        recentlySaved={recentlySaved}
        saveState={saveState}
      />

      <SleepRecoverySection
        form={form}
        settings={settings}
        onField={onField}
        recentlySaved={recentlySaved}
        saveState={saveState}
        baseRowIndex={4}
      />

      <SleepScheduleSection
        form={form}
        onField={onField}
      />

      <NutritionSection
        form={form}
        settings={settings}
        onField={onField}
        recentlySaved={recentlySaved}
        saveState={saveState}
        baseRowIndex={8}
      />

      <LiftsSection
        date={date}
        allLogs={logs}
        lifts={form.lifts || []}
        onLiftsChange={onLiftsChange}
        plan={plan}
        skippedLifts={form.feelings?.skippedLifts || []}
        onSkipLift={onSkipLift}
      />

      <FeelingsSection
        form={form}
        onField={onField}
      />

      <DayFooter
        entryCount={logs ? Object.keys(logs).length : 0}
        savedAt={savedAt}
      />
    </div>
  )
}
