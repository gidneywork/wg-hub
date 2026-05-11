'use client'

import { useState, useEffect, useRef } from 'react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { db } from '../lib/db'
import WorkoutHistory from './WorkoutHistory'
import DashboardShell from './cadence/DashboardShell'
import CadenceDashboard from './cadence/Dashboard'

// ─── SESSION TYPES ────────────────────────────────────────────────────────────
const SESSION_TYPES = [
  { key:'run',        label:'Running',             color:'#00e676' },
  { key:'functional', label:'Functional Training', color:'#ff9f40' },
  { key:'gym',        label:'Gym',                 color:'#b388ff' },
  { key:'yoga',       label:'Yoga',                color:'#40a9ff' },
  { key:'rest',       label:'Rest Day',            color:'#ff6b6b' },
  { key:'swim',       label:'Swimming',            color:'#64b5f6' },
  { key:'cycle',      label:'Cycling',             color:'#ffd666' },
  { key:'hike',       label:'Hiking',              color:'#a5d6a7' },
  { key:'stretch',    label:'Stretching',          color:'#80deea' },
  { key:'custom',     label:'Custom',              color:'#e8edf5' },
]
const typeColor = (key) => SESSION_TYPES.find(t=>t.key===key)?.color || '#e8edf5'
const typeLabel = (key) => SESSION_TYPES.find(t=>t.key===key)?.label || key

// ─── DEFAULT PLAN ─────────────────────────────────────────────────────────────
const PLAN_DAYS_META = [
  { day:'Monday',    short:'MON', accent:'#00e676' },
  { day:'Tuesday',   short:'TUE', accent:'#40a9ff' },
  { day:'Wednesday', short:'WED', accent:'#ff9f40' },
  { day:'Thursday',  short:'THU', accent:'#b388ff' },
  { day:'Friday',    short:'FRI', accent:'#ff6b6b' },
  { day:'Saturday',  short:'SAT', accent:'#ffd666' },
  { day:'Sunday',    short:'SUN', accent:'#69f0ae' },
]

function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2,7)}` }

function getDefaultPlan() {
  const raw = [
    { runs:['1:45–2hrs Easy Run · 150–160bpm · 15–20km'],            func:'100 Pull Ups\n200 Press Ups\n200 Crunches\n200 Shrugs',        gym:'Chest / Triceps',                          yoga:'30 mins' },
    { runs:['1hr Zone 2 Easy · 10–12km','8× Hill Sprints (Pipers Way – full length)'], func:'100 Pull Ups\n200 Press Ups\n200 Crunches\n200 Shrugs (40kg)', gym:'Bicep / Shoulders',                         yoga:'30 mins' },
    { runs:['1:45–2hrs Zone 2 Easy · 15–20km'],                       func:'100 Pull Ups\n200 Press Ups\n200 Crunches\n200 Shrugs (40kg)', gym:'Core Training',                             yoga:'30 mins' },
    { runs:['10km Easy Run'],                                          func:'100 Pull Ups\n200 Press Ups\n200 Crunches\n200 Shrugs (40kg)', gym:'Leg Day – focus on running movements',      yoga:'30 mins' },
    { rest:true,                                                                                                                            gym:'Chest / Triceps',                          yoga:'30 mins' },
    { runs:['Long Run · 40km minimum'],                                                                                                     gym:'Bicep / Shoulders',                         yoga:'30 mins' },
    { runs:['10km Recovery Run'],                                      func:'100 Pull Ups\n200 Press Ups\n200 Crunches\n200 Shrugs (40kg)',                                                  yoga:'30 mins' },
  ]
  return PLAN_DAYS_META.map((meta, i) => {
    const d = raw[i], sessions = []
    if (d.rest)  sessions.push({ id:uid(), type:'rest',       details:'Running Rest Day' })
    if (d.runs)  d.runs.forEach(r => sessions.push({ id:uid(), type:'run',        details:r }))
    if (d.func)  sessions.push({ id:uid(), type:'functional', details:d.func })
    if (d.gym)   sessions.push({ id:uid(), type:'gym',        details:d.gym })
    if (d.yoga)  sessions.push({ id:uid(), type:'yoga',       details:`Yoga · ${d.yoga}` })
    return { ...meta, sessions }
  })
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const GYM_OPTIONS    = ['Bicep / Shoulders','Chest / Triceps','Core Training','Back','Legs']
const DEFAULT_FUNC   = () => [{exercise:'Pull Ups',reps:''},{exercise:'Press Ups',reps:''},{exercise:'Crunches',reps:''},{exercise:'Shrugs',reps:''}]
const DEFAULT_SETTINGS = {
  weeklyKm:      {value:100,  label:'Weekly Running Target', unit:'km',   lowerIsBetter:false},
  dailyCalories: {value:2800, label:'Daily Calories',         unit:'kcal', lowerIsBetter:false},
  dailyProtein:  {value:180,  label:'Daily Protein',          unit:'g',    lowerIsBetter:false},
  dailyCarbs:    {value:320,  label:'Daily Carbs',            unit:'g',    lowerIsBetter:false},
  weightTarget:  {value:75,   label:'Weight Target',          unit:'kg',   lowerIsBetter:false, isWeight:true},
  sleepScore:    {value:85,   label:'Sleep Score Target',     unit:'/100', lowerIsBetter:false},
  recoveryScore: {value:80,   label:'Recovery Score Target',  unit:'/100', lowerIsBetter:false},
  hoursSlept:    {value:8,    label:'Hours Slept Target',     unit:'hrs',  lowerIsBetter:false},
  hrv:           {value:70,   label:'HRV Target',             unit:'',     lowerIsBetter:false},
  rhr:           {value:52,   label:'Resting HR Target',      unit:'bpm',  lowerIsBetter:true},
}

const todayStr   = () => new Date().toISOString().split('T')[0]
const fmtDate    = (d) => new Date(d+'T00:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})
const fmtDateShort = (d) => new Date(d+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'})   // "4 May"
const fmtDateMMM   = (d) => new Date(d+'T00:00:00').toLocaleDateString('en-GB',{month:'short',year:'2-digit'}) // "May 26"
const getDayName = (d) => new Date(d+'T00:00:00').toLocaleDateString('en-US',{weekday:'long'})
// Smart formatter: for 30D use "4 May", for 90D/1Y use "May 26"
const smartDateFmt = (period) => (d) => period==='7D'?fmtDateShort(d.replace ? d : d):period==='30D'?fmtDateShort(d):fmtDateMMM(d)
const mkEmpty    = () => ({
  nutrition:{calories:'',protein:'',carbs:''},
  sleep:{sleepScore:'',recoveryScore:'',hoursSlept:'',bedTime:''},
  exercise:{runs:[{distance:'',duration:'',notes:''}],functional:{on:false,exercises:DEFAULT_FUNC()},gym:{on:false,types:[]},yoga:{on:false,duration:''}},
  body:{rhr:'',hrv:'',weight:'',weightTime:''},
})
const TT = {background:'#131722',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,fontFamily:'var(--font-mono)',fontSize:12,color:'#e8edf5',padding:'8px 12px'}

// Legacy tokens are scoped to [data-legacy] so they don't override the
// Cadence tokens loaded from design/cadence-tokens.css at :root. The
// legacy WGHub views still render under [data-legacy="true"] wrappers.
const CSS_VARS = `
  [data-legacy] {
    --bg:#07090f; --s1:#0d1018; --s2:#131722; --s3:#1a2030; --s4:#21293a;
    --border:rgba(255,255,255,0.07); --border2:rgba(255,255,255,0.12);
    --accent:#00e676; --accent-dim:rgba(0,230,118,0.12);
    --blue:#40a9ff; --orange:#ff9f40; --purple:#b388ff; --red:#ff6b6b; --yellow:#ffd666;
    --text:#e8edf5; --muted:#6b7a96; --muted2:#4a5568;
    --font-head:'Bebas Neue','Impact',sans-serif;
    --font-mono:'IBM Plex Mono','Courier New',monospace;
    --font-body:'DM Sans',system-ui,sans-serif;
    --r:10px; --r-lg:14px;
    background: var(--bg);
    color: var(--text);
    font-family: var(--font-body);
    min-height: 100%;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  [data-legacy] .fade { animation: fadeIn 0.2s ease; }
  @keyframes fadeIn { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:none; } }

  /* ── Mobile layout ─────────────────────────────────────────── */
  @media (max-width: 768px) {
    [data-legacy] nav { padding: 0 12px !important; gap: 8px !important; overflow-x: auto; }
    [data-legacy] nav::-webkit-scrollbar { display: none; }
    [data-legacy] .mobile-hide { display: none !important; }
    [data-legacy] .mobile-stack { grid-template-columns: 1fr !important; }
    [data-legacy] .mobile-2col { grid-template-columns: 1fr 1fr !important; }
    [data-legacy] .mobile-full { padding: 14px 16px !important; max-width: 100% !important; }
    [data-legacy] input, [data-legacy] select, [data-legacy] textarea { font-size: 16px !important; } /* prevent iOS zoom */
  }
`

// ─── TARGET STATUS HELPER ─────────────────────────────────────────────────────
function targetStatus(actual, def) {
  if (!actual||!def?.value) return null
  const a=parseFloat(actual), t=parseFloat(def.value)
  if (isNaN(a)||isNaN(t)||t===0) return null
  if (def.isWeight) {
    const diff=Math.abs(a-t)
    return {color:diff<=0.5?'#00e676':diff<=2?'#ff9f40':'#ff6b6b',pct:Math.max(0,100-(diff/t)*500),status:diff<=0.5?'on target':a>t?`${(a-t).toFixed(1)}kg above`:`${(t-a).toFixed(1)}kg below`}
  }
  const pct=def.lowerIsBetter?Math.min(100,(t/a)*100):Math.min(100,(a/t)*100)
  const met=def.lowerIsBetter?a<=t:a>=t
  return {color:met?'#00e676':pct>=85?'#ff9f40':'#ff6b6b',pct,status:met?'on target':`${Math.round(pct)}% of target`}
}

function calcRecords(logs, activities = []) {
  let longestRun=0,bestSleep=0,bestHrv=0,lowestRhr=999,heaviestWeek=0,bestRecovery=0
  let lrD='',bsD='',bhD='',lrhrD='',brD=''
  const wkKm={}

  // ── From manual daily logs (sleep, body, manual runs)
  Object.entries(logs).forEach(([date,log])=>{
    // Support both new runs[] array and legacy running{} shape
    const km = log?.exercise?.runs
      ? log.exercise.runs.reduce((s,r)=>s+(parseFloat(r.distance)||0),0)
      : parseFloat(log?.exercise?.running?.distance)||0
    if(km>longestRun){longestRun=km;lrD=date}
    const sl=parseFloat(log?.sleep?.sleepScore)||0; if(sl>bestSleep){bestSleep=sl;bsD=date}
    const hrv=parseFloat(log?.body?.hrv)||0; if(hrv>bestHrv){bestHrv=hrv;bhD=date}
    const rhr=parseFloat(log?.body?.rhr)||0; if(rhr>0&&rhr<lowestRhr){lowestRhr=rhr;lrhrD=date}
    const rec=parseFloat(log?.sleep?.recoveryScore)||0; if(rec>bestRecovery){bestRecovery=rec;brD=date}
    if(km){const dt=new Date(date+'T00:00:00');const mon=new Date(dt);mon.setDate(dt.getDate()-(dt.getDay()===0?6:dt.getDay()-1));const k=mon.toISOString().split('T')[0];wkKm[k]=(wkKm[k]||0)+km}
  })

  // ── From Strava activities (running distance takes priority)
  activities.forEach(a=>{
    const type = a.custom_type || a.strava_type || 'custom'
    if(type !== 'run') return
    const km = (a.data?.distance || 0) / 1000
    if(!km) return
    const date = (a.start_date || '').split('T')[0]
    if(!date) return
    // Only use Strava distance if it's longer than any manually logged run on that day
    // This avoids double-counting when both exist
    const logKm = parseFloat(logs[date]?.exercise?.running?.distance) || 0
    const effectiveKm = Math.max(km, logKm)
    if(effectiveKm > longestRun){ longestRun = Math.round(effectiveKm * 100) / 100; lrD = date }
    const dt=new Date(date+'T00:00:00'); const mon=new Date(dt); mon.setDate(dt.getDate()-(dt.getDay()===0?6:dt.getDay()-1)); const k=mon.toISOString().split('T')[0]
    // Replace the manual log entry for that date with Strava if Strava is higher
    if(!wkKm[k] || effectiveKm > logKm) wkKm[k]=(wkKm[k]||0)+(effectiveKm-logKm)
  })

  Object.values(wkKm).forEach(km=>{if(km>heaviestWeek)heaviestWeek=km})
  return [
    {label:'LONGEST RUN',   value:longestRun>0?`${longestRun}km`:'—',                color:'#00e676',date:lrD},
    {label:'BEST WEEK KM',  value:heaviestWeek>0?`${heaviestWeek.toFixed(1)}km`:'—', color:'#40a9ff',date:''},
    {label:'BEST SLEEP',    value:bestSleep>0?`${bestSleep}/100`:'—',                 color:'#b388ff',date:bsD},
    {label:'BEST RECOVERY', value:bestRecovery>0?`${bestRecovery}/100`:'—',           color:'#00e676',date:brD},
    {label:'PEAK HRV',      value:bestHrv>0?`${bestHrv}`:'—',                         color:'#ff9f40',date:bhD},
    {label:'LOWEST RHR',    value:lowestRhr<999?`${lowestRhr}bpm`:'—',                color:'#ff6b6b',date:lrhrD},
  ]
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function WGHub({ onSignOut }) {
  const [view,     setView    ] = useState('dashboard')
  const [logs,     setLogs    ] = useState({})
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [plan,     setPlan    ] = useState(null)
  const [stravaConnection, setStravaConnection] = useState(null)
  const [activities, setActivities] = useState([])
  const [whoopData,  setWhoopData ] = useState({})
  const [ready,    setReady   ] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const stravaStatus = params.get('strava')
    if (stravaStatus) window.history.replaceState({}, '', window.location.pathname)

    ;(async () => {
      try {
        const [logsData, settingsData, planData, stravaConn, activitiesData, whoopD] = await Promise.all([
          db.loadLogs(),
          db.loadSettings(),
          db.loadPlan(),
          db.loadStravaConnection(),
          db.loadActivities(),
          db.loadWhoopData(),
        ])
        setLogs(logsData || {})
        if (settingsData) setSettings(settingsData)
        setPlan(planData || getDefaultPlan())
        setStravaConnection(stravaConn)
        setActivities(activitiesData || [])
        setWhoopData(whoopD || {})
        if (stravaStatus === 'connected') setView('history')
      } catch (e) {
        console.error('Initial load failed:', e)
        setPlan(getDefaultPlan())
      }
      setReady(true)
    })()

    // ── Supabase Realtime subscriptions (live updates across all devices) ──
    const unsubActivities = db.subscribeToActivities(() => {
      db.loadActivities().then(setActivities)
    })
    const unsubLogs = db.subscribeToLogs(() => {
      db.loadLogs().then(setLogs)
    })
    const unsubWhoop = db.subscribeToWhoop(() => {
      db.loadWhoopData().then(setWhoopData)
    })

    return () => { unsubActivities(); unsubLogs(); unsubWhoop() }
  }, [])

  const saveLog      = async (date, data) => { await db.saveLog(date, data);     setLogs(p => ({...p, [date]: data})) }
  const saveSettings = async (s)          => { await db.saveSettings(s);         setSettings(s) }
  const savePlan     = async (p)          => { await db.savePlan(p);             setPlan(p) }

  const LEGACY_VIEWS = ['log','history','plan','planner','finance','settings','tv']
  const isLegacy = LEGACY_VIEWS.includes(view)

  return (
    <DashboardShell view={view} setView={setView} userName="Will" onSignOut={onSignOut}>
      {!ready ? (
        <div style={{padding:'40px 0',fontFamily:'var(--mono)',fontSize:11,letterSpacing:'0.16em',textTransform:'uppercase',color:'var(--text-quiet)'}}>Loading…</div>
      ) : view === 'dashboard' ? (
        <CadenceDashboard logs={logs} settings={settings} activities={activities} whoopData={whoopData} plan={plan} setView={setView}/>
      ) : isLegacy ? (
        <div data-legacy="true">
          <style>{CSS_VARS}</style>
          {view==='log'      ? <LogData    logs={logs} saveLog={saveLog} settings={settings} plan={plan} activities={activities} whoopData={whoopData}/>
           :view==='history' ? <WorkoutHistory stravaConnection={stravaConnection} onStravaConnectionChange={async()=>{ const c=await db.loadStravaConnection(); setStravaConnection(c); const a=await db.loadActivities(); setActivities(a); }}/>
           :view==='plan'    ? <TrainingPlan plan={plan} savePlan={savePlan}/>
           :view==='planner' ? <PlannerPage/>
           :view==='finance' ? <FinancePage/>
           :view==='settings'? <SettingsPage settings={settings} saveSettings={saveSettings} stravaConnection={stravaConnection} onStravaConnectionChange={async()=>{ const c=await db.loadStravaConnection(); setStravaConnection(c); }}/>
           :                   <TVMode logs={logs} settings={settings} plan={plan} activities={activities} whoopData={whoopData} setView={setView}/>
          }
        </div>
      ) : (
        <div style={{padding:'40px 0',fontFamily:'var(--mono)',fontSize:11,letterSpacing:'0.16em',textTransform:'uppercase',color:'var(--text-quiet)'}}>Coming soon</div>
      )}
    </DashboardShell>
  )
}

// ─── MERGE WHOOP DATA ─────────────────────────────────────────────────────────
// Returns merged body/sleep data for a date — Whoop takes priority over manual logs
function mergeWhoopForDate(date, log, whoopData) {
  const w = whoopData?.[date]
  if (!w) return log || {}
  return {
    ...log,
    body: {
      ...(log?.body || {}),
      hrv:    w.hrv    ?? log?.body?.hrv    ?? '',
      rhr:    w.rhr    ?? log?.body?.rhr    ?? '',
      weight: log?.body?.weight || '',  // weight stays manual only
    },
    sleep: {
      ...(log?.sleep || {}),
      sleepScore:    w.sleep_score     ?? log?.sleep?.sleepScore    ?? '',
      recoveryScore: w.recovery_score  ?? log?.sleep?.recoveryScore ?? '',
      hoursSlept:    w.hours_slept     ?? log?.sleep?.hoursSlept    ?? '',
      bedTime:       w.bed_time        || log?.sleep?.bedTime       || '',
    },
  }
}
function Dashboard({ logs, settings, activities, whoopData, setView }) {
  const [period, setPeriod] = useState('30D')
  const ytdDays = Math.ceil((new Date() - new Date(new Date().getFullYear(),0,1)) / 86400000) + 1
  const nDays=period==='7D'?7:period==='30D'?30:period==='90D'?90:period==='YTD'?ytdDays:365
  const days=Array.from({length:nDays},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(nDays-1-i)); return d.toISOString().split('T')[0] })
  const today=todayStr()
  const tl = mergeWhoopForDate(today, logs[today], whoopData)

  // ── Helper: get merged body/sleep data for any date (Whoop priority) ──
  const getMerged = (date) => mergeWhoopForDate(date, logs[date], whoopData)

  // ── Merged KM lookup: Strava takes priority over manual log for a given date
  const stravaKmByDate = {}
  activities.forEach(a => {
    const type = a.custom_type || a.strava_type || 'custom'
    if(type !== 'run') return
    const km = (a.data?.distance || 0) / 1000
    if(!km) return
    const date = (a.start_date || '').split('T')[0]
    if(!date) return
    stravaKmByDate[date] = (stravaKmByDate[date] || 0) + km
  })

  const getKmForDate = (date) => {
    if(stravaKmByDate[date]) return stravaKmByDate[date]
    const log = logs[date]
    if(log?.exercise?.runs) return log.exercise.runs.reduce((s,r)=>s+(parseFloat(r.distance)||0),0)
    return parseFloat(log?.exercise?.running?.distance) || 0
  }

  const weekStart=new Date()
  weekStart.setDate(weekStart.getDate()-(weekStart.getDay()===0?6:weekStart.getDay()-1))
  weekStart.setHours(0,0,0,0)
  const allDates = [...new Set([...Object.keys(logs), ...Object.keys(stravaKmByDate), ...Object.keys(whoopData||{})])]
  const thisWeekKm = allDates
    .filter(d => new Date(d+'T00:00:00') >= weekStart)
    .reduce((s,d) => s + getKmForDate(d), 0)

  const totalKm=days.reduce((s,d)=>s+getKmForDate(d),0)
  const logsCount=days.filter(d=>logs[d]||whoopData?.[d]).length
  // Sleep/HRV now reads from merged data (Whoop priority)
  const sleepDays=days.filter(d=>getMerged(d)?.sleep?.sleepScore)
  const avgSleep=sleepDays.length?Math.round(sleepDays.reduce((s,d)=>s+parseFloat(getMerged(d).sleep.sleepScore),0)/sleepDays.length):null
  const hrvDays=days.filter(d=>getMerged(d)?.body?.hrv)
  const avgHrv=hrvDays.length?Math.round(hrvDays.reduce((s,d)=>s+parseFloat(getMerged(d).body.hrv),0)/hrvDays.length):null
  const load=days.reduce((s,d)=>{ const km=getKmForDate(d); const acts=(activities||[]).filter(a=>{const dt=new Date(a.start_date).toLocaleDateString('en-CA');return dt===d}); const gymMins=acts.filter(a=>(a.custom_type||a.strava_type)==='gym').reduce((t,a)=>t+(a.data?.moving_time||0)/60,0); const yogaMins=acts.filter(a=>(a.custom_type||a.strava_type)==='yoga').reduce((t,a)=>t+(a.data?.moving_time||0)/60,0); return s+km+(gymMins/60)*8+(yogaMins/60)*3 },0)

  let streak=0; for(let i=0;i<365;i++){ const d=new Date(); d.setDate(d.getDate()-i); const ds=d.toISOString().split('T')[0]; if(logs[ds]||whoopData?.[ds]) streak++; else break }
  const records=calcRecords(logs, activities)

  // X-axis tick interval
  const xInterval = period==='7D'?0:period==='30D'?4:period==='90D'?14:period==='YTD'?Math.ceil(nDays/26):60
  const periodLabel = period==='7D'?'Last 7 days':period==='30D'?'Last 30 days':period==='90D'?'Last 90 days':period==='YTD'?`YTD ${new Date().getFullYear()}`:'Last year'
  const sfmt = (d) => period==='7D'?fmtDateShort(d):period==='30D'?fmtDateShort(d):fmtDateMMM(d)

  // Chart data — uses merged Whoop+manual data
  // Weight fill-forward — carry last known weight for missing days
  const weightDataRaw = days.map(d=>({date:sfmt(d),weight:logs[d]?.body?.weight?parseFloat(logs[d].body.weight):null}))
  let lastKnownWeight = null
  const weightData = weightDataRaw.map(r=>{ if(r.weight) lastKnownWeight=r.weight; return {...r, weight: r.weight ?? lastKnownWeight} })
  const sleepData=days.map(d=>{ const m=getMerged(d); return {date:sfmt(d),sleep:parseFloat(m?.sleep?.sleepScore)||null,recovery:parseFloat(m?.sleep?.recoveryScore)||null} })
  const hrvData=days.map(d=>{ const m=getMerged(d); return {date:sfmt(d),hrv:parseFloat(m?.body?.hrv)||null,rhr:parseFloat(m?.body?.rhr)||null} })

  // Weekly KM chart — merge all date sources
  const wkMap={}, elevMap={}
  const allChartDates = [...new Set([...days, ...Object.keys(stravaKmByDate).filter(d => days.includes(d))])]
  allChartDates.forEach(d=>{
    const km = getKmForDate(d)
    if(!km) return
    const dt=new Date(d+'T00:00:00'); const mon=new Date(dt); mon.setDate(dt.getDate()-(dt.getDay()===0?6:dt.getDay()-1)); const k=mon.toISOString().split('T')[0]
    wkMap[k]=(wkMap[k]||0)+km
  })
  // Elevation per week from Strava
  activities.filter(a=>(a.custom_type||a.strava_type)==='run'&&days.includes((a.start_date||'').split('T')[0])).forEach(a=>{
    const elev = a.data?.total_elevation_gain||0; if(!elev) return
    const date=(a.start_date||'').split('T')[0]; const dt=new Date(date+'T00:00:00'); const mon=new Date(dt); mon.setDate(dt.getDate()-(dt.getDay()===0?6:dt.getDay()-1)); const k=mon.toISOString().split('T')[0]
    elevMap[k]=(elevMap[k]||0)+Math.round(elev)
  })
  const wkLabel=(k)=>{ const d=new Date(k+'T00:00:00'); return `${d.getDate()}/${d.getMonth()+1}` }
  const kmData=Object.entries(wkMap).sort(([a],[b])=>a.localeCompare(b)).map(([k,km])=>({week:wkLabel(k),km:Math.round(km*10)/10,target:settings.weeklyKm?.value||null}))
  const elevData=Object.entries({...wkMap,...elevMap}).reduce((acc,[k])=>{ if(!acc.find(x=>x.week===wkLabel(k))) acc.push({week:wkLabel(k),elev:elevMap[k]||0}); return acc },[]).sort((a,b)=>a.week.localeCompare(b.week))

  const cal=parseFloat(tl?.nutrition?.calories)||0, pro=parseFloat(tl?.nutrition?.protein)||0, carb=parseFloat(tl?.nutrition?.carbs)||0
  const hasData=Object.keys(logs).length>0

  const todayStats=[
    {l:'WEIGHT',     v:tl?.body?.weight,        unit:'kg',   tKey:'weightTarget'},
    {l:'HRV',        v:tl?.body?.hrv,            unit:'',     tKey:'hrv'},
    {l:'RESTING HR', v:tl?.body?.rhr,            unit:'bpm',  tKey:'rhr'},
    {l:'SLEEP SCORE',v:tl?.sleep?.sleepScore,    unit:'/100', tKey:'sleepScore'},
    {l:'RECOVERY',   v:tl?.sleep?.recoveryScore, unit:'/100', tKey:'recoveryScore'},
    {l:'HOURS SLEPT',v:tl?.sleep?.hoursSlept,    unit:'h',    tKey:'hoursSlept'},
    {l:'CALORIES',   v:tl?.nutrition?.calories,  unit:'kcal', tKey:'dailyCalories'},
    {l:'PROTEIN',    v:tl?.nutrition?.protein,   unit:'g',    tKey:'dailyProtein'},
  ].map(s=>({...s,ts:targetStatus(s.v,settings[s.tKey])}))

  const weeklyTs=targetStatus(thisWeekKm,settings.weeklyKm)
  const ChartEmpty=({msg})=><div style={{height:200,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--muted2)',fontFamily:'var(--font-mono)',fontSize:12,textAlign:'center',padding:'0 20px'}}>{msg||'No data logged yet for this period'}</div>

  return (
    <div style={{padding:'24px 28px',maxWidth:1440,margin:'0 auto'}} className='fade'>
      <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:20}}>
        <div>
          <h1 style={{fontFamily:'var(--font-head)',fontSize:38,letterSpacing:2,lineHeight:1}}>TRAINING <span style={{color:'var(--accent)'}}>DASHBOARD</span></h1>
          <p style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--muted)',marginTop:5,letterSpacing:1}}>WG HUB · PERSONAL PERFORMANCE DASHBOARD</p>
        </div>
        <div style={{display:'flex',gap:6}}>
          {['7D','30D','90D','1Y','YTD'].map(p=>(
            <button key={p} onClick={()=>setPeriod(p)} style={{background:period===p?'var(--accent)':'var(--s2)',color:period===p?'var(--bg)':'var(--muted)',border:'1px solid var(--border2)',borderRadius:7,padding:'7px 16px',fontFamily:'var(--font-mono)',fontSize:11,fontWeight:600,cursor:'pointer',letterSpacing:1,transition:'all 0.15s'}}>{p}</button>
          ))}
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(8,1fr)',gap:8,marginBottom:12}}>
        {todayStats.map(({l,v,unit,ts})=>{
          const displayVal=v?(l==='CALORIES'?Number(v).toLocaleString():v):'—'
          const col=ts?ts.color:v?'var(--text)':'var(--muted2)'
          return (
            <div key={l} style={{background:'var(--s1)',borderRadius:'var(--r)',padding:'12px 10px',textAlign:'center',border:`1px solid ${ts?ts.color+'44':'var(--border)'}`,position:'relative',overflow:'hidden'}}>
              {ts&&<div style={{position:'absolute',bottom:0,left:0,right:0,height:3,background:'var(--s3)'}}><div style={{height:'100%',width:`${ts.pct}%`,background:ts.color,borderRadius:2,transition:'width 0.6s ease'}}/></div>}
              <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)',letterSpacing:'1px',marginBottom:5}}>{l}</div>
              <div style={{fontFamily:'var(--font-head)',fontSize:20,color:col,letterSpacing:1}}>{displayVal}{v&&<span style={{fontSize:11,opacity:0.65}}>{unit}</span>}</div>
              {ts&&<div style={{fontFamily:'var(--font-mono)',fontSize:8,color:ts.color,marginTop:3}}>{ts.status}</div>}
            </div>
          )
        })}
      </div>

      <div style={{background:'var(--s1)',border:`1px solid ${weeklyTs?weeklyTs.color+'44':'var(--border)'}`,borderRadius:'var(--r)',padding:'14px 20px',marginBottom:12,display:'flex',alignItems:'center',gap:20,flexWrap:'wrap'}}>
        <div style={{flexShrink:0}}>
          <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)',letterSpacing:'1.5px',marginBottom:4}}>THIS WEEK'S RUNNING</div>
          <div style={{display:'flex',alignItems:'baseline',gap:6}}>
            <span style={{fontFamily:'var(--font-head)',fontSize:36,color:weeklyTs?weeklyTs.color:'var(--accent)',lineHeight:1}}>{thisWeekKm.toFixed(1)}</span>
            <span style={{fontFamily:'var(--font-mono)',fontSize:13,color:'var(--muted)'}}>km</span>
            {settings.weeklyKm?.value&&<span style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--muted2)'}}>/ {settings.weeklyKm.value}km target</span>}
          </div>
        </div>
        {settings.weeklyKm?.value&&(
          <div style={{flex:1,minWidth:200}}>
            <div style={{height:8,background:'var(--s3)',borderRadius:4,overflow:'hidden'}}><div style={{height:'100%',borderRadius:4,transition:'width 0.6s ease',background:weeklyTs?weeklyTs.color:'var(--accent)',width:`${Math.min(100,(thisWeekKm/settings.weeklyKm.value)*100)}%`}}/></div>
            <div style={{fontFamily:'var(--font-mono)',fontSize:10,color:weeklyTs?weeklyTs.color:'var(--muted)',marginTop:5}}>{weeklyTs?weeklyTs.status:`${((thisWeekKm/settings.weeklyKm.value)*100).toFixed(0)}% of weekly target`}</div>
          </div>
        )}
        <div style={{display:'flex',gap:20,marginLeft:'auto',flexWrap:'wrap'}}>
          {[{l:`KM (${period})`,v:`${totalKm.toFixed(1)}km`,c:'var(--accent)'},{l:'DAYS LOGGED',v:logsCount,c:'var(--blue)'},{l:'AVG SLEEP',v:avgSleep?`${avgSleep}/100`:'—',c:'var(--purple)'},{l:'AVG HRV',v:avgHrv??'—',c:'var(--orange)'},{l:'AVG RHR',v:(()=>{ const vals=days.map(d=>parseFloat(getMerged(d)?.body?.rhr)).filter(v=>!isNaN(v)&&v>0); return vals.length?`${Math.round(vals.reduce((a,b)=>a+b,0)/vals.length)}bpm`:'—' })(),c:'var(--red)'},{l:'STREAK',v:`${streak}d`,c:'var(--accent)'}].map(({l,v,c})=>(
            <div key={l} style={{textAlign:'center'}}><div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)',letterSpacing:1,marginBottom:3}}>{l}</div><div style={{fontFamily:'var(--font-head)',fontSize:22,color:c}}>{v}</div></div>
          ))}
        </div>
      </div>

      {!hasData?(
        <div style={{background:'var(--s1)',border:'1px solid var(--border2)',borderRadius:'var(--r-lg)',padding:'60px 40px',textAlign:'center'}}>
          <div style={{fontFamily:'var(--font-head)',fontSize:52,color:'var(--accent)',marginBottom:12}}>START LOGGING</div>
          <p style={{color:'var(--muted)',fontSize:14,marginBottom:28,maxWidth:400,margin:'0 auto 28px'}}>No training data yet. Log your first session to begin tracking your progress.</p>
          <button onClick={()=>setView('log')} style={{background:'var(--accent)',color:'var(--bg)',border:'none',borderRadius:8,padding:'12px 36px',fontFamily:'var(--font-mono)',fontSize:13,fontWeight:600,cursor:'pointer',letterSpacing:1}}>LOG TODAY'S DATA →</button>
        </div>
      ):(
        <>
          <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:12,marginBottom:12}}>
            <div style={{background:'var(--s1)',border:`1px solid ${streak>0?'rgba(0,230,118,0.3)':'var(--border)'}`,borderRadius:'var(--r-lg)',padding:'20px 22px'}}>
              <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)',letterSpacing:'1.5px',marginBottom:6}}>LOGGING STREAK</div>
              <div style={{fontFamily:'var(--font-head)',fontSize:60,color:streak>0?'var(--accent)':'var(--muted2)',lineHeight:1}}>{streak}</div>
              <div style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--muted)',marginTop:6}}>consecutive days</div>
              <div style={{fontSize:11,color:'var(--muted)',marginTop:4}}>{streak===0?'Log today to start a streak':streak<7?'Building momentum':streak<30?'Strong consistency':streak<90?'Elite dedication':'Unstoppable'}</div>
            </div>
            <AIAssistant logs={logs} activities={activities} whoopData={whoopData} settings={settings}/>
          </div>

          <div style={{background:'var(--s1)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',padding:'20px 22px',marginBottom:12}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <div><div style={{fontFamily:'var(--font-mono)',fontSize:11,fontWeight:600,letterSpacing:'1.5px'}}>PERSONAL RECORDS</div><div style={{fontSize:11,color:'var(--muted)',marginTop:2}}>Auto-detected from all logged data</div></div>
              <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)',background:'var(--s3)',padding:'4px 10px',borderRadius:5,letterSpacing:1}}>ALL TIME</div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:10}}>
              {records.map(({label,value,color,date})=>(
                <div key={label} style={{background:'var(--s2)',borderRadius:9,padding:'14px 12px',borderTop:`2px solid ${value==='—'?'var(--s3)':color}`}}>
                  <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)',letterSpacing:'1px',marginBottom:8}}>{label}</div>
                  <div style={{fontFamily:'var(--font-head)',fontSize:26,color:value==='—'?'var(--muted2)':color,letterSpacing:1}}>{value}</div>
                  {date&&<div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted2)',marginTop:5}}>{fmtDate(date)}</div>}
                </div>
              ))}
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
            <ChartCard title='WEEKLY RUNNING KM' sub={`${periodLabel} · km per week${settings.weeklyKm?.value?` · target ${settings.weeklyKm.value}km`:''}`}>
              {kmData.length>0?(<ResponsiveContainer width='100%' height={200}><BarChart data={kmData} margin={{top:4,right:8,left:-12,bottom:0}}><CartesianGrid strokeDasharray='3 3' stroke='rgba(255,255,255,0.05)'/><XAxis dataKey='week' tick={{fontFamily:'var(--font-mono)',fontSize:10,fill:'#6b7a96'}}/><YAxis tick={{fontFamily:'var(--font-mono)',fontSize:10,fill:'#6b7a96'}} unit='km'/><Tooltip contentStyle={TT}/>{settings.weeklyKm?.value&&<Bar dataKey='target' fill='rgba(0,230,118,0.12)' radius={[3,3,0,0]} name='Target'/>}<Bar dataKey='km' fill='#00e676' radius={[5,5,0,0]} name='km'/></BarChart></ResponsiveContainer>):<ChartEmpty/>}
            </ChartCard>
            <ChartCard title='ELEVATION GAIN' sub={`${periodLabel} · total metres climbed per week from Strava`}>
              {elevData.some(r=>r.elev>0)?(<ResponsiveContainer width='100%' height={200}><BarChart data={elevData} margin={{top:4,right:8,left:-12,bottom:0}}><CartesianGrid strokeDasharray='3 3' stroke='rgba(255,255,255,0.05)'/><XAxis dataKey='week' tick={{fontFamily:'var(--font-mono)',fontSize:10,fill:'#6b7a96'}}/><YAxis tick={{fontFamily:'var(--font-mono)',fontSize:10,fill:'#6b7a96'}} unit='m'/><Tooltip contentStyle={TT} formatter={v=>[`${v}m`,'Elevation']}/><Bar dataKey='elev' fill='#a5d6a7' radius={[5,5,0,0]} name='Elevation (m)'/></BarChart></ResponsiveContainer>):<ChartEmpty msg='No elevation data — requires Strava runs with GPS'/>}
            </ChartCard>
            <NutritionChart logs={logs} days={days} settings={settings} xInterval={xInterval} periodLabel={periodLabel}/>
            <GymChart logs={logs} days={days} activities={activities} periodLabel={periodLabel}/>
            <ChartCard title='WEIGHT TREND' sub={`${periodLabel} · bodyweight in kilograms`}>
              {weightData.some(r=>r.weight)?(<ResponsiveContainer width='100%' height={200}><AreaChart data={weightData} margin={{top:4,right:8,left:-12,bottom:0}}><defs><linearGradient id='wGrad' x1='0' y1='0' x2='0' y2='1'><stop offset='5%' stopColor='#40a9ff' stopOpacity={0.25}/><stop offset='95%' stopColor='#40a9ff' stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray='3 3' stroke='rgba(255,255,255,0.05)'/><XAxis dataKey='date' interval={xInterval} tick={{fontFamily:'var(--font-mono)',fontSize:10,fill:'#6b7a96'}}/><YAxis domain={['dataMin - 1','dataMax + 1']} tick={{fontFamily:'var(--font-mono)',fontSize:10,fill:'#6b7a96'}} unit='kg'/><Tooltip contentStyle={TT}/><Area type='monotone' dataKey='weight' stroke='#40a9ff' strokeWidth={2} fill='url(#wGrad)' dot={false} connectNulls={false} name='Weight (kg)'/></AreaChart></ResponsiveContainer>):<ChartEmpty/>}
            </ChartCard>
            <ChartCard title='SLEEP & RECOVERY SCORES' sub={`${periodLabel} · daily scores out of 100`}>
              {sleepData.some(r=>r.sleep||r.recovery)?(<ResponsiveContainer width='100%' height={200}><LineChart data={sleepData} margin={{top:4,right:8,left:-12,bottom:0}}><CartesianGrid strokeDasharray='3 3' stroke='rgba(255,255,255,0.05)'/><XAxis dataKey='date' interval={xInterval} tick={{fontFamily:'var(--font-mono)',fontSize:10,fill:'#6b7a96'}}/><YAxis domain={[0,100]} tick={{fontFamily:'var(--font-mono)',fontSize:10,fill:'#6b7a96'}}/><Tooltip contentStyle={TT}/><Line type='monotone' dataKey='sleep' stroke='#b388ff' strokeWidth={2} dot={false} connectNulls={false} name='Sleep'/><Line type='monotone' dataKey='recovery' stroke='#00e676' strokeWidth={2} dot={false} connectNulls={false} name='Recovery' strokeDasharray='5 3'/><Legend formatter={v=><span style={{fontFamily:'var(--font-mono)',fontSize:10,color:'#6b7a96'}}>{v.toUpperCase()}</span>}/></LineChart></ResponsiveContainer>):<ChartEmpty/>}
            </ChartCard>
            <ChartCard title='HRV & RESTING HEART RATE' sub={`${periodLabel} · recovery indicators`}>
              {hrvData.some(r=>r.hrv||r.rhr)?(<ResponsiveContainer width='100%' height={200}><LineChart data={hrvData} margin={{top:4,right:8,left:-12,bottom:0}}><CartesianGrid strokeDasharray='3 3' stroke='rgba(255,255,255,0.05)'/><XAxis dataKey='date' interval={xInterval} tick={{fontFamily:'var(--font-mono)',fontSize:10,fill:'#6b7a96'}}/><YAxis tick={{fontFamily:'var(--font-mono)',fontSize:10,fill:'#6b7a96'}}/><Tooltip contentStyle={TT}/><Line type='monotone' dataKey='hrv' stroke='#ff9f40' strokeWidth={2} dot={false} connectNulls={false} name='HRV'/><Line type='monotone' dataKey='rhr' stroke='#ff6b6b' strokeWidth={2} dot={false} connectNulls={false} name='Resting HR' strokeDasharray='5 3'/><Legend formatter={v=><span style={{fontFamily:'var(--font-mono)',fontSize:10,color:'#6b7a96'}}>{v.toUpperCase()}</span>}/></LineChart></ResponsiveContainer>):<ChartEmpty/>}
            </ChartCard>
          </div>
          <RecentHistory logs={logs} settings={settings} activities={activities} whoopData={whoopData} setView={setView}/>
        </>
      )}
    </div>
  )
}

// ─── AI PERSONAL ASSISTANT ────────────────────────────────────────────────────
function AIAssistant({ logs, activities, whoopData, settings }) {
  const STORAGE_KEY = 'wghub_ai_messages'
  const SUMMARY_KEY = 'wghub_ai_summary_date'

  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [input,   setInput  ] = useState('')
  const [loading, setLoading] = useState(false)
  const [started, setStarted] = useState(true)
  const bottomRef  = useRef(null)
  const chatBoxRef = useRef(null)

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)) } catch {}
    if(chatBoxRef.current) chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight
  }, [messages])

  // On initial mount, scroll to bottom immediately to show latest messages
  useEffect(() => {
    if(chatBoxRef.current) chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight
  }, [])

  // Auto-run daily summary once per calendar day only
  useEffect(() => {
    const today = todayStr()
    try {
      const lastSummaryDate = localStorage.getItem(SUMMARY_KEY)
      if(lastSummaryDate === today) return
      const t = setTimeout(() => {
        sendMessage('Give me a concise summary of my training week so far — hits, misses, and one thing to focus on.')
        try { localStorage.setItem(SUMMARY_KEY, today) } catch {}
      }, 800)
      return () => clearTimeout(t)
    } catch {
      // localStorage blocked (Safari private mode) — run summary anyway
      const t = setTimeout(() => {
        sendMessage('Give me a concise summary of my training week so far — hits, misses, and one thing to focus on.')
      }, 800)
      return () => clearTimeout(t)
    }
  }, [])

  const buildContext = () => {
    const today = todayStr()
    const last7  = Array.from({length:7},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-i); return d.toISOString().split('T')[0] })

    // Recent Whoop data
    const recentWhoop = last7.map(d => {
      const w = whoopData?.[d]
      if(!w) return null
      return `${d}: Recovery ${w.recovery_score||'?'}%, HRV ${w.hrv||'?'}ms, RHR ${w.rhr||'?'}bpm, Sleep ${w.sleep_score||'?'}%, Hours ${w.hours_slept||'?'}h`
    }).filter(Boolean)

    // Recent nutrition
    const recentNutrition = last7.map(d => {
      const l = logs[d]
      if(!l?.nutrition?.calories) return null
      return `${d}: ${l.nutrition.calories}kcal, ${l.nutrition.protein||0}g protein, ${l.nutrition.carbs||0}g carbs`
    }).filter(Boolean)

    // Recent activities
    const recentActivities = (activities||[]).slice(0,10).map(a => {
      const type = a.custom_type || a.strava_type
      const km   = a.data?.distance ? `${(a.data.distance/1000).toFixed(1)}km` : ''
      const mins = a.data?.moving_time ? `${Math.round(a.data.moving_time/60)}min` : ''
      const name = a.custom_name || a.data?.name || type
      return `${(a.start_date||'').split('T')[0]}: ${name} (${type}) ${km} ${mins}`.trim()
    })

    // Targets
    const targets = Object.entries(settings).map(([k,v]) => `${v.label}: ${v.value}${v.unit}`).join(', ')

    return `You are WG Hub's personal performance assistant for Will, an ultra-marathon runner training for a 100km race. Be concise, direct and data-driven. Use the training data below to answer questions and proactively flag issues.

TARGETS: ${targets}

RECENT WHOOP DATA (last 7 days):
${recentWhoop.length ? recentWhoop.join('\n') : 'No Whoop data available'}

RECENT NUTRITION (last 7 days):
${recentNutrition.length ? recentNutrition.join('\n') : 'No nutrition logged'}

RECENT ACTIVITIES (last 10):
${recentActivities.length ? recentActivities.join('\n') : 'No recent activities'}

TODAY: ${today}

Format responses using this structure when giving weekly summaries:
- Start with "Week Summary: [date range]"
- Use sections: Hits ✅ / Misses ⚠️ / Focus 🔑 / Weekly Takeaway 📝
- Under each section, use bullet points (• ) for each item with a short bold label then colon then detail
- End each section with a "Coach's note:" in italics
- Keep each bullet to 1-2 lines max, be specific with numbers from the data
- For other questions, keep responses concise with bullet points where helpful
- Never use markdown bold (**text**) — use plain text with structure instead`
  }

  const sendMessage = async (text) => {
    if(!text.trim() || loading) return
    const userMsg = { role:'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 25000)

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, systemPrompt: buildContext() }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      const data = await res.json()
      const reply = data.reply || `Error: ${data.error || 'Something went wrong.'}`
      setMessages(p => [...p, { role:'assistant', content: reply }])
    } catch(e) {
      clearTimeout(timeout)
      const msg = e.name==='AbortError' ? 'Request timed out — try a shorter question.' : 'Connection error — check your internet and try again.'
      setMessages(p => [...p, { role:'assistant', content: msg }])
    }
    setLoading(false)
  }

  const quickPrompts = [
    'How is my recovery looking?',
    'Am I on track for my weekly KM target?',
    'Any patterns in my sleep data?',
    'What should I focus on today?',
  ]

  if(!started) {
    return (
      <div style={{background:'var(--s1)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',padding:'20px 22px',display:'flex',flexDirection:'column',justifyContent:'space-between'}}>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:'var(--accent)',animation:'pulse 2s infinite'}}/>
            <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)',letterSpacing:'1.5px'}}>WG HUB · PERSONAL ASSISTANT</div>
          </div>
          <div style={{fontFamily:'var(--font-head)',fontSize:22,marginBottom:8}}>TRAINING <span style={{color:'var(--accent)'}}>ASSISTANT</span></div>
          <div style={{fontSize:12,color:'var(--muted)',lineHeight:1.6,marginBottom:16}}>Your AI coach with full access to your Strava, Whoop and nutrition data. Ask anything about your training.</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:16}}>
            {quickPrompts.map(p=>(
              <button key={p} onClick={()=>{ setStarted(true); setTimeout(()=>sendMessage(p),100) }} style={{background:'var(--s2)',border:'1px solid var(--border2)',borderRadius:7,padding:'8px 10px',fontFamily:'var(--font-mono)',fontSize:10,color:'var(--muted)',cursor:'pointer',textAlign:'left',lineHeight:1.4,transition:'all 0.15s'}} onMouseEnter={e=>e.currentTarget.style.borderColor='var(--accent)'} onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border2)'}>{p}</button>
            ))}
          </div>
        </div>
        <button onClick={()=>setStarted(true)} style={{background:'var(--accent)',color:'var(--bg)',border:'none',borderRadius:8,padding:'9px',fontFamily:'var(--font-mono)',fontSize:11,fontWeight:600,cursor:'pointer',letterSpacing:1,width:'100%'}}>OPEN ASSISTANT</button>
      </div>
    )
  }

  return (
    <div style={{background:'var(--s1)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',padding:'16px',display:'flex',flexDirection:'column',height:340}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <div style={{width:6,height:6,borderRadius:'50%',background:'var(--accent)'}}/>
          <span style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)',letterSpacing:1}}>WG HUB ASSISTANT</span>
        </div>
        <button onClick={()=>{setStarted(false);setMessages([])}} style={{background:'none',border:'none',color:'var(--muted)',cursor:'pointer',fontSize:12}}>✕</button>
      </div>

      <div ref={chatBoxRef} style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:8,marginBottom:10}}>
        {messages.length===0&&(
          <div style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--muted)',textAlign:'center',marginTop:20}}>Ask me anything about your training...</div>
        )}
        {messages.map((m,i)=>(
          <div key={i} style={{display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start'}}>
            <div style={{maxWidth:'85%',background:m.role==='user'?'var(--accent)':'var(--s2)',color:m.role==='user'?'var(--bg)':'var(--text)',borderRadius:10,padding:'8px 12px',fontSize:12,lineHeight:1.6,fontFamily:m.role==='user'?'var(--font-mono)':'var(--font-body)',whiteSpace:'pre-wrap'}}>
              {m.content}
            </div>
          </div>
        ))}
        {loading&&(
          <div style={{display:'flex',gap:4,padding:'8px 12px'}}>
            {[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:'50%',background:'var(--accent)',animation:`bounce 1s ${i*0.15}s infinite`}}/>)}
          </div>
        )}
      </div>

      <div style={{display:'flex',gap:8}}>
        <input
          type='text' value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&sendMessage(input)}
          placeholder='Ask about your training...'
          style={{flex:1,fontSize:12,borderRadius:8}}
        />
        <button onClick={()=>sendMessage(input)} disabled={loading||!input.trim()} style={{background:input.trim()?'var(--accent)':'var(--s3)',color:input.trim()?'var(--bg)':'var(--muted)',border:'none',borderRadius:8,padding:'0 14px',cursor:input.trim()?'pointer':'default',fontFamily:'var(--font-mono)',fontSize:12,fontWeight:600,transition:'all 0.15s',whiteSpace:'nowrap'}}>→</button>
      </div>
    </div>
  )
}

function ChartCard({title,sub,children,action}){
  return <div style={{background:'var(--s1)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',padding:'20px 20px 16px'}}><div style={{marginBottom:16,display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8}}><div><div style={{fontFamily:'var(--font-mono)',fontSize:11,fontWeight:600,letterSpacing:'1.5px'}}>{title}</div><div style={{fontSize:11,color:'var(--muted)',marginTop:2}}>{sub}</div></div>{action&&<div style={{flexShrink:0}}>{action}</div>}</div>{children}</div>
}

// ─── NUTRITION CHART ──────────────────────────────────────────────────────────
function NutritionChart({ logs, days, settings, xInterval, periodLabel }) {
  const [show, setShow] = useState({ calories:true, protein:true, carbs:true })

  // Include all dates (null for missing) so X-axis always spans the full period
  const data = days.map(d => ({
    date:     periodLabel?.includes('7')?fmtDateShort(d):fmtDateMMM(d),
    calories: parseFloat(logs[d]?.nutrition?.calories) || null,
    protein:  parseFloat(logs[d]?.nutrition?.protein)  || null,
    carbs:    parseFloat(logs[d]?.nutrition?.carbs)    || null,
  }))

  const hasData = data.some(r => r.calories || r.protein || r.carbs)

  const toggles = [
    { key:'calories', label:'CALORIES', color:'#00e676' },
    { key:'protein',  label:'PROTEIN',  color:'#40a9ff' },
    { key:'carbs',    label:'CARBS',    color:'#ff9f40' },
  ]

  const calTarget  = settings?.dailyCalories?.value
  const proTarget  = settings?.dailyProtein?.value
  const carbTarget = settings?.dailyCarbs?.value

  return (
    <ChartCard title='DAILY NUTRITION' sub={`${periodLabel||'Last 7 days'} · calories right axis (kcal) · macros left (g)`}>
      <div style={{display:'flex',gap:8,marginBottom:14}}>
        {toggles.map(({key,label,color})=>(
          <button key={key} onClick={()=>setShow(p=>({...p,[key]:!p[key]}))} style={{
            background: show[key] ? `${color}22` : 'var(--s3)',
            color:      show[key] ? color : 'var(--muted)',
            border:     `1px solid ${show[key] ? color+'55' : 'var(--border2)'}`,
            borderRadius:6, padding:'5px 14px',
            fontFamily:'var(--font-mono)', fontSize:9, letterSpacing:1,
            cursor:'pointer', transition:'all 0.15s',
          }}>{label}</button>
        ))}
        {(calTarget||proTarget||carbTarget)&&(
          <span style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)',marginLeft:'auto',alignSelf:'center'}}>— targets active</span>
        )}
      </div>
      {hasData?(
        <ResponsiveContainer width='100%' height={200}>
          <LineChart data={data} margin={{top:4,right:show.calories?48:8,left:-12,bottom:0}}>
            <CartesianGrid strokeDasharray='3 3' stroke='rgba(255,255,255,0.05)'/>
            <XAxis dataKey='date' interval={xInterval||0} tick={{fontFamily:'var(--font-mono)',fontSize:10,fill:'#6b7a96'}}/>
            <YAxis yAxisId='g' tick={{fontFamily:'var(--font-mono)',fontSize:10,fill:'#6b7a96'}} unit='g'/>
            <YAxis yAxisId='k' orientation='right' tick={{fontFamily:'var(--font-mono)',fontSize:10,fill:'#6b7a96'}} tickFormatter={v=>`${Math.round(v/100)/10}k`}/>
            <Tooltip contentStyle={TT} formatter={(val,name)=>name.includes('kcal')?[`${Number(val).toLocaleString()} kcal`,name]:[`${val}g`,name]}/>
            {show.protein  &&<Line yAxisId='g' type='monotone' dataKey='protein'  stroke='#40a9ff' strokeWidth={2} dot={false} connectNulls={false} name='Protein (g)'    />}
            {show.carbs    &&<Line yAxisId='g' type='monotone' dataKey='carbs'    stroke='#ff9f40' strokeWidth={2} dot={false} connectNulls={false} name='Carbs (g)'      />}
            {show.calories &&<Line yAxisId='k' type='monotone' dataKey='calories' stroke='#00e676' strokeWidth={2} dot={false} connectNulls={false} name='Calories (kcal)'/>}
            {calTarget  && show.calories && <Line yAxisId='k' type='monotone' dataKey={()=>calTarget}  stroke='rgba(0,230,118,0.3)'  strokeWidth={1} strokeDasharray='4 3' dot={false} name='Cal target'  legendType='none'/>}
            {proTarget  && show.protein  && <Line yAxisId='g' type='monotone' dataKey={()=>proTarget}  stroke='rgba(64,169,255,0.3)' strokeWidth={1} strokeDasharray='4 3' dot={false} name='Pro target'  legendType='none'/>}
            {carbTarget && show.carbs    && <Line yAxisId='g' type='monotone' dataKey={()=>carbTarget} stroke='rgba(255,159,64,0.3)' strokeWidth={1} strokeDasharray='4 3' dot={false} name='Carb target' legendType='none'/>}
          </LineChart>
        </ResponsiveContainer>
      ):(
        <div style={{height:200,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--muted2)',fontFamily:'var(--font-mono)',fontSize:12}}>No nutrition data logged yet</div>
      )}
    </ChartCard>
  )
}

function GymChart({ logs, days, activities, periodLabel }) {

  const SESSION_COLORS = {
    'Bicep / Shoulders': '#40a9ff',
    'Chest / Triceps':   '#b388ff',
    'Core Training':     '#ff9f40',
    'Back':              '#00e676',
    'Legs':              '#ff6b6b',
    'Weight Training':   '#ffd666',
    'Yoga':              '#80deea',
    'Functional':        '#fc4c02',
  }

  const dateSet = new Set(days)

  // Build session data purely from Strava activities type field
  const sessionsByDate = {}
  ;(activities||[]).forEach(a => {
    const type = a.custom_type || a.strava_type
    if(type !== 'gym' && type !== 'yoga' && type !== 'functional') return
    const date = new Date(a.start_date).toLocaleDateString('en-CA')
    if(!dateSet.has(date)) return
    const label = type === 'yoga' ? 'Yoga' : type === 'functional' ? 'Functional' : 'Weight Training'
    if(!sessionsByDate[date]) sessionsByDate[date] = []
    // Avoid duplicates on same date/type
    if(!sessionsByDate[date].includes(label)) sessionsByDate[date].push(label)
  })

  // Totals for donut
  const typeTotals = {}
  Object.values(sessionsByDate).forEach(types => {
    types.forEach(t => { typeTotals[t] = (typeTotals[t] || 0) + 1 })
  })
  const totalSessions = Object.values(typeTotals).reduce((s,v) => s+v, 0)
  const activeTypes = Object.entries(typeTotals).sort(([,a],[,b]) => b-a)

  return (
    <ChartCard
      title='GYM & YOGA SESSIONS'
      sub={`${periodLabel||'Last 7 days'} · ${totalSessions} session${totalSessions!==1?'s':''} · Strava + manual`}
    >
      {totalSessions===0?(
        <div style={{height:180,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--muted2)',fontFamily:'var(--font-mono)',fontSize:12}}>No sessions in period</div>
      ):(()=>{
        const r=70, cx=90, cy=90, circumference=2*Math.PI*r
        let offset=0
        const slices = activeTypes.map(([type,count]) => {
          const pct=count/totalSessions, dash=pct*circumference, gap=circumference-dash
          const slice={type,count,dash,gap,offset,color:SESSION_COLORS[type]||'#888'}
          offset+=dash; return slice
        })
        return (
          <div style={{display:'flex',alignItems:'center',gap:24}}>
            <svg width={180} height={180} style={{flexShrink:0}}>
              {slices.map(({type,dash,gap,offset,color}) => (
                <circle key={type} cx={cx} cy={cy} r={r} fill='none' stroke={color} strokeWidth={28}
                  strokeDasharray={`${dash} ${gap}`} strokeDashoffset={circumference/4-offset}
                  style={{transition:'stroke-dasharray 0.5s ease'}}/>
              ))}
              <text x={cx} y={cy-8} textAnchor='middle' style={{fontFamily:'var(--font-head)',fontSize:28,fill:'var(--text)'}}>{totalSessions}</text>
              <text x={cx} y={cy+12} textAnchor='middle' style={{fontFamily:'var(--font-mono)',fontSize:9,fill:'var(--muted)'}}>SESSIONS</text>
            </svg>
            <div style={{display:'flex',flexDirection:'column',gap:8,flex:1}}>
              {activeTypes.map(([type,count]) => (
                <div key={type}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                    <span style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--muted)'}}>{type}</span>
                    <span style={{fontFamily:'var(--font-mono)',fontSize:10,color:SESSION_COLORS[type]||'#888',fontWeight:600}}>×{count}</span>
                  </div>
                  <div style={{height:4,background:'var(--s3)',borderRadius:2,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${(count/totalSessions)*100}%`,background:SESSION_COLORS[type]||'#888',borderRadius:2}}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })()}
    </ChartCard>
  )
}

// ─── RECENT HISTORY ───────────────────────────────────────────────────────────
function RecentHistory({ logs, settings, activities, whoopData, setView }) {
  const stravaKmByDate = {}
  ;(activities||[]).forEach(a => {
    const type = a.custom_type || a.strava_type
    if(type !== 'run') return
    const km = (a.data?.distance || 0) / 1000
    if(!km) return
    const date = new Date(a.start_date).toLocaleDateString('en-CA')
    stravaKmByDate[date] = (stravaKmByDate[date] || 0) + km
  })

  const getKm = (date) => {
    if(stravaKmByDate[date]) return stravaKmByDate[date].toFixed(1)
    const log = logs[date]
    if(log?.exercise?.runs) { const t=log.exercise.runs.reduce((s,r)=>s+(parseFloat(r.distance)||0),0); return t>0?t.toFixed(1):null }
    return parseFloat(log?.exercise?.running?.distance)||null
  }

  // Merge Whoop data — Whoop takes priority over manual for body/sleep fields
  const getMergedVal = (date, key, sub) => {
    const w = whoopData?.[date]
    const l = logs[date]
    if(key==='sleep') {
      const wVal = sub==='sleepScore'?w?.sleep_score:sub==='recoveryScore'?w?.recovery_score:sub==='hoursSlept'?w?.hours_slept:null
      return wVal ?? l?.sleep?.[sub]
    }
    if(key==='body') {
      const wVal = sub==='hrv'?w?.hrv:sub==='rhr'?w?.rhr:null
      return wVal ?? l?.body?.[sub]
    }
    return l?.[key]?.[sub]
  }

  // All dates — logs, Strava runs, or Whoop data
  const allDates = [...new Set([
    ...Object.keys(logs),
    ...Object.keys(stravaKmByDate),
    ...Object.keys(whoopData||{}),
  ])].sort().reverse().slice(0,60)

  if(!allDates.length) return null

  const cell = (val, unit='', tKey=null) => {
    const ts = tKey ? targetStatus(val, settings[tKey]) : null
    const display = val != null && val !== '' ? `${typeof val==='number'?Math.round(val*10)/10:val}${unit}` : '—'
    return <td style={{padding:'9px 12px',fontFamily:'var(--font-mono)',fontSize:12,color:ts?ts.color:val?'var(--text)':'var(--muted2)',borderBottom:'1px solid var(--border)',whiteSpace:'nowrap'}}>{display}</td>
  }

  return (
    <div style={{background:'var(--s1)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',overflow:'hidden'}}>
      <div style={{padding:'16px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div><div style={{fontFamily:'var(--font-mono)',fontSize:11,fontWeight:600,letterSpacing:'1.5px'}}>RECENT LOG HISTORY</div><div style={{fontSize:11,color:'var(--muted)',marginTop:2}}>{allDates.length} entries · Strava + Whoop + manual · click any row to edit</div></div>
        <div style={{display:'flex',alignItems:'center',gap:12,fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)'}}>
          {[['#00e676','On target'],['#ff9f40','Within 15%'],['#ff6b6b','Off target']].map(([c,l])=>(
            <span key={l} style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:8,height:8,borderRadius:2,background:c,display:'inline-block'}}/>{l}</span>
          ))}
        </div>
      </div>
      <div style={{overflowX:'auto',overflowY:'auto',maxHeight:400}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead style={{position:'sticky',top:0,zIndex:1}}>
            <tr style={{background:'var(--s2)'}}>{['DATE','KM RUN','WEIGHT','SLEEP','RECOVERY','HRV','RHR','CALORIES','PROTEIN',''].map(h=><th key={h} style={{padding:'8px 12px',fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)',letterSpacing:'1.5px',textAlign:'left',borderBottom:'1px solid var(--border)',whiteSpace:'nowrap',background:'var(--s2)'}}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {allDates.map(date=>{
              const l = logs[date]
              const w = whoopData?.[date]
              const isToday = date===todayStr()
              const km = getKm(date)
              const hasStrava = !!stravaKmByDate[date]
              const hasWhoop  = !!w
              return (
                <tr key={date} onClick={()=>setView('log')} style={{background:isToday?'rgba(0,230,118,0.04)':'transparent',cursor:'pointer',transition:'background 0.15s'}} onMouseEnter={e=>e.currentTarget.style.background='var(--s2)'} onMouseLeave={e=>e.currentTarget.style.background=isToday?'rgba(0,230,118,0.04)':'transparent'}>
                  <td style={{padding:'9px 12px',fontFamily:'var(--font-mono)',fontSize:12,color:isToday?'var(--accent)':'var(--text)',borderBottom:'1px solid var(--border)',whiteSpace:'nowrap'}}>
                    {fmtDate(date)}
                    {isToday&&<span style={{marginLeft:6,fontSize:9,color:'var(--accent)'}}>TODAY</span>}
                    {hasWhoop&&<span style={{marginLeft:6,fontSize:9,color:'#a78bfa'}}>W</span>}
                  </td>
                  <td style={{padding:'9px 12px',fontFamily:'var(--font-mono)',fontSize:12,borderBottom:'1px solid var(--border)',whiteSpace:'nowrap'}}>
                    {km ? <span style={{color:hasStrava?'#fc4c02':'var(--accent)'}}>{km}km{hasStrava&&<span style={{fontSize:9,marginLeft:4,opacity:0.7}}>S</span>}</span> : <span style={{color:'var(--muted2)'}}>—</span>}
                  </td>
                  {cell(l?.body?.weight,'kg','weightTarget')}
                  {cell(getMergedVal(date,'sleep','sleepScore'),'/100','sleepScore')}
                  {cell(getMergedVal(date,'sleep','recoveryScore'),'/100','recoveryScore')}
                  {cell(getMergedVal(date,'body','hrv'),'','hrv')}
                  {cell(getMergedVal(date,'body','rhr'),'bpm','rhr')}
                  {cell(l?.nutrition?.calories,' kcal','dailyCalories')}
                  {cell(l?.nutrition?.protein,'g','dailyProtein')}
                  <td style={{padding:'9px 12px',borderBottom:'1px solid var(--border)'}}><span style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--muted)',background:'var(--s3)',padding:'3px 8px',borderRadius:4}}>EDIT</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── LOG DATA ─────────────────────────────────────────────────────────────────
function LogData({ logs, saveLog, settings, plan, whoopData }) {
  const [date, setDate] = useState(todayStr())
  const [form, setForm] = useState(mkEmpty())
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(()=>{
    const base = logs[date] ? JSON.parse(JSON.stringify(logs[date])) : mkEmpty()
    if(!base.body.weightTime) base.body.weightTime = ''
    if(!base.nutrition) base.nutrition = {calories:'',protein:'',carbs:''}

    // Pre-fill body/sleep from Whoop if available and field is empty
    const w = whoopData?.[date]
    if(w) {
      if(!base.body.hrv && w.hrv)                       base.body.hrv           = String(w.hrv)
      if(!base.body.rhr && w.rhr)                       base.body.rhr           = String(w.rhr)
      if(!base.sleep.sleepScore && w.sleep_score)        base.sleep.sleepScore   = String(Math.round(w.sleep_score))
      if(!base.sleep.recoveryScore && w.recovery_score)  base.sleep.recoveryScore= String(Math.round(w.recovery_score))
      if(!base.sleep.hoursSlept && w.hours_slept)        base.sleep.hoursSlept   = String(w.hours_slept)
      if(!base.sleep.bedTime && w.bed_time)              base.sleep.bedTime      = w.bed_time
    }
    setForm(base)
    setSaved(false)
  },[date, logs, whoopData])

  const setN=(sec,f,v)=>setForm(p=>({...p,[sec]:{...p[sec],[f]:v}}))
  const handleSave=async()=>{ setSaving(true); await saveLog(date,form); setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),3000) }

  const isExisting=!!logs[date]
  const planDayName=getDayName(date)
  const planDay=plan?.find(d=>d.day===planDayName)
  const ts=(val,key)=>targetStatus(val,settings[key])
  const w=whoopData?.[date]

  return (
    <div style={{padding:'24px 28px',maxWidth:960,margin:'0 auto'}} className='fade'>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
        <div>
          <h1 style={{fontFamily:'var(--font-head)',fontSize:36,letterSpacing:2,lineHeight:1}}>{isExisting?'EDIT':'LOG'} <span style={{color:'var(--accent)'}}>DAILY DATA</span></h1>
          <p style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--muted)',marginTop:5,letterSpacing:1}}>{isExisting?'Updating entry':'New entry'} · {fmtDate(date)} · {planDayName.toUpperCase()}{w?<span style={{color:'#a78bfa',marginLeft:8}}>· Whoop ✓</span>:null}</p>
        </div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <input type='date' value={date} onChange={e=>setDate(e.target.value)} style={{width:170,fontSize:13}}/>
          <SaveBtn saved={saved} saving={saving} onClick={handleSave}/>
        </div>
      </div>

      {planDay&&planDay.sessions.length>0&&(
        <div style={{background:'var(--s2)',border:`1px solid ${planDay.accent}33`,borderLeft:`3px solid ${planDay.accent}`,borderRadius:'var(--r)',padding:'12px 16px',marginBottom:18}}>
          <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)',letterSpacing:1,marginBottom:8}}>TODAY'S PLAN</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
            {planDay.sessions.map(s=>(
              <div key={s.id} style={{background:`${typeColor(s.type)}18`,border:`1px solid ${typeColor(s.type)}33`,borderRadius:6,padding:'5px 10px',fontFamily:'var(--font-mono)',fontSize:10,color:typeColor(s.type)}}>
                <span style={{fontSize:9,opacity:0.7,marginRight:5}}>{typeLabel(s.type).toUpperCase()}</span>
                {s.details.split('\n')[0].split('·')[0].trim()}
              </div>
            ))}
          </div>
        </div>
      )}

      {w&&(
        <div style={{background:'rgba(167,139,250,0.08)',border:'1px solid rgba(167,139,250,0.25)',borderRadius:'var(--r)',padding:'12px 16px',marginBottom:18,display:'flex',gap:20,flexWrap:'wrap'}}>
          <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'#a78bfa',letterSpacing:1,width:'100%',marginBottom:4}}>WHOOP DATA AVAILABLE FOR THIS DATE</div>
          {[['Recovery',`${Math.round(w.recovery_score||0)}%`],['Sleep',`${Math.round(w.sleep_score||0)}%`],['HRV',`${Math.round(w.hrv||0)}ms`],['RHR',`${Math.round(w.rhr||0)}bpm`],['Hours Slept',`${w.hours_slept}h`],['Strain',w.day_strain]].map(([l,v])=>v&&(
            <div key={l}><div style={{fontFamily:'var(--font-mono)',fontSize:8,color:'var(--muted)',letterSpacing:1}}>{l.toUpperCase()}</div><div style={{fontFamily:'var(--font-mono)',fontSize:13,color:'#a78bfa'}}>{v}</div></div>
          ))}
        </div>
      )}

      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <LogSection title='BODY DATA' accent='var(--accent)'>
          <Row cols={4}>
            <FF label='RESTING HEART RATE (bpm)' ts={ts(form.body.rhr,'rhr')}><input type='number' placeholder={w?.rhr?`${Math.round(w.rhr)} from Whoop`:'52'} value={form.body.rhr} onChange={e=>setN('body','rhr',e.target.value)}/></FF>
            <FF label='HRV' ts={ts(form.body.hrv,'hrv')}><input type='number' placeholder={w?.hrv?`${Math.round(w.hrv)} from Whoop`:'78'} value={form.body.hrv} onChange={e=>setN('body','hrv',e.target.value)}/></FF>
            <FF label='WEIGHT (kg)' ts={ts(form.body.weight,'weightTarget')}><input type='number' placeholder='75.5' step='0.1' value={form.body.weight} onChange={e=>setN('body','weight',e.target.value)}/></FF>
            <FF label='WEIGHT TIME'><input type='time' value={form.body.weightTime||''} onChange={e=>setN('body','weightTime',e.target.value)}/></FF>
          </Row>
        </LogSection>
        <LogSection title='SLEEP' accent='var(--purple)'>
          <Row cols={4}>
            <FF label='SLEEP SCORE (0–100)' ts={ts(form.sleep.sleepScore,'sleepScore')}><input type='number' min='0' max='100' placeholder={w?.sleep_score?`${Math.round(w.sleep_score)} from Whoop`:'85'} value={form.sleep.sleepScore} onChange={e=>setN('sleep','sleepScore',e.target.value)}/></FF>
            <FF label='RECOVERY SCORE (0–100)' ts={ts(form.sleep.recoveryScore,'recoveryScore')}><input type='number' min='0' max='100' placeholder={w?.recovery_score?`${Math.round(w.recovery_score)} from Whoop`:'80'} value={form.sleep.recoveryScore} onChange={e=>setN('sleep','recoveryScore',e.target.value)}/></FF>
            <FF label='HOURS SLEPT' ts={ts(form.sleep.hoursSlept,'hoursSlept')}><input type='number' placeholder={w?.hours_slept?`${w.hours_slept} from Whoop`:'7.5'} step='0.25' value={form.sleep.hoursSlept} onChange={e=>setN('sleep','hoursSlept',e.target.value)}/></FF>
            <FF label='BED TIME'><input type='time' value={form.sleep.bedTime} onChange={e=>setN('sleep','bedTime',e.target.value)}/></FF>
          </Row>
        </LogSection>
        <LogSection title='NUTRITION' accent='var(--orange)'>
          <Row cols={3}>
            <FF label='CALORIES (kcal)' ts={ts(form.nutrition.calories,'dailyCalories')}><input type='number' placeholder='2800' value={form.nutrition.calories} onChange={e=>setN('nutrition','calories',e.target.value)}/></FF>
            <FF label='PROTEIN (g)' ts={ts(form.nutrition.protein,'dailyProtein')}><input type='number' placeholder='180' value={form.nutrition.protein} onChange={e=>setN('nutrition','protein',e.target.value)}/></FF>
            <FF label='CARBS (g)' ts={ts(form.nutrition.carbs,'dailyCarbs')}><input type='number' placeholder='320' value={form.nutrition.carbs} onChange={e=>setN('nutrition','carbs',e.target.value)}/></FF>
          </Row>
        </LogSection>
        {/* Exercise section removed — all workout data now pulled from Strava automatically */}
        <div style={{background:'var(--s2)',border:'1px solid var(--border)',borderRadius:'var(--r)',padding:'14px 18px',display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontSize:20}}>⚡</span>
          <div>
            <div style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--accent)',letterSpacing:1,marginBottom:3}}>EXERCISE DATA AUTO-SYNCED FROM STRAVA</div>
            <div style={{fontSize:12,color:'var(--muted)'}}>All workouts, runs, gym sessions and yoga are pulled automatically from your Strava account. View them on the <button onClick={()=>{}} style={{background:'none',border:'none',color:'var(--accent)',fontFamily:'inherit',fontSize:12,cursor:'pointer',textDecoration:'underline',padding:0}}>History</button> page.</div>
          </div>
        </div>
      </div>
      <div style={{display:'flex',justifyContent:'flex-end',marginTop:22}}><SaveBtn saved={saved} saving={saving} onClick={handleSave} large/></div>
    </div>
  )
}

// ─── TRAINING PLAN ────────────────────────────────────────────────────────────
function TrainingPlan({ plan, savePlan }) {
  const todayDayName=new Date().toLocaleDateString('en-US',{weekday:'long'})
  const [expanded,  setExpanded ]=useState(todayDayName)
  const [editing,   setEditing  ]=useState(false)
  const [localPlan, setLocalPlan]=useState(plan)
  const [saveFlash, setSaveFlash]=useState(false)

  useEffect(()=>{ setLocalPlan(plan) },[plan])
  if(!plan) return null

  const updateSession=(di,id,field,val)=>setLocalPlan(p=>p.map((day,i)=>i!==di?day:{...day,sessions:day.sessions.map(s=>s.id!==id?s:{...s,[field]:val})}))
  const deleteSession=(di,id)=>setLocalPlan(p=>p.map((day,i)=>i!==di?day:{...day,sessions:day.sessions.filter(s=>s.id!==id)}))
  const addSession=(di,type,details)=>{ if(!details.trim()) return; setLocalPlan(p=>p.map((day,i)=>i!==di?day:{...day,sessions:[...day.sessions,{id:uid(),type,details}]})) }
  const moveSession=(di,id,dir)=>setLocalPlan(p=>p.map((day,i)=>{ if(i!==di) return day; const idx=day.sessions.findIndex(s=>s.id===id); const ni=idx+dir; if(ni<0||ni>=day.sessions.length) return day; const arr=[...day.sessions]; [arr[idx],arr[ni]]=[arr[ni],arr[idx]]; return {...day,sessions:arr} }))
  const handleSave=async()=>{ await savePlan(localPlan); setEditing(false); setSaveFlash(true); setTimeout(()=>setSaveFlash(false),2000) }
  const handleCancel=()=>{ setLocalPlan(plan); setEditing(false) }
  const handleReset=async()=>{ const d=getDefaultPlan(); setLocalPlan(d); await savePlan(d); setEditing(false) }

  const displayPlan=editing?localPlan:plan

  return (
    <div style={{padding:'24px 28px',maxWidth:1440,margin:'0 auto'}} className='fade'>
      <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:22}}>
        <div>
          <h1 style={{fontFamily:'var(--font-head)',fontSize:38,letterSpacing:2,lineHeight:1}}>WEEKLY <span style={{color:'var(--accent)'}}>{editing?'EDIT PLAN':'TRAINING PLAN'}</span></h1>
          <p style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--muted)',marginTop:5,letterSpacing:1}}>{editing?'CUSTOMISE YOUR WEEKLY SCHEDULE · CHANGES SAVE TO YOUR ACCOUNT':'WG HUB · WEEKLY TRAINING SCHEDULE · CLICK A DAY TO EXPAND'}</p>
        </div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          {editing?(<>
            <button onClick={handleReset} style={{background:'none',border:'1px solid var(--red)',borderRadius:8,color:'var(--red)',fontFamily:'var(--font-mono)',fontSize:11,padding:'9px 16px',cursor:'pointer',letterSpacing:1}}>RESET DEFAULT</button>
            <button onClick={handleCancel} style={{background:'none',border:'1px solid var(--border2)',borderRadius:8,color:'var(--muted)',fontFamily:'var(--font-mono)',fontSize:11,padding:'9px 16px',cursor:'pointer',letterSpacing:1}}>CANCEL</button>
            <button onClick={handleSave} style={{background:'var(--accent)',border:'none',borderRadius:8,color:'var(--bg)',fontFamily:'var(--font-mono)',fontSize:12,fontWeight:600,padding:'10px 24px',cursor:'pointer',letterSpacing:1}}>SAVE PLAN</button>
          </>):(
            <button onClick={()=>setEditing(true)} style={{background:'var(--s2)',border:'1px solid var(--border2)',borderRadius:8,color:'var(--text)',fontFamily:'var(--font-mono)',fontSize:11,padding:'9px 20px',cursor:'pointer',letterSpacing:1}}>✏️ EDIT PLAN</button>
          )}
        </div>
      </div>

      {saveFlash&&<div style={{background:'var(--accent-dim)',border:'1px solid var(--accent)',borderRadius:8,padding:'10px 16px',marginBottom:16,fontFamily:'var(--font-mono)',fontSize:12,color:'var(--accent)',letterSpacing:1}}>✓ Training plan saved</div>}

      {!editing&&(
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:20}}>
          {(()=>{
            const totalKm = plan.reduce((s,day)=>{ const runs=day.sessions.filter(s=>s.type==='run'); return s+runs.reduce((a,r)=>{ const m=r.details.match(/(\d+)km/); return a+(m?parseInt(m[1]):0) },0) },0)
            const funcDays = plan.filter(d=>d.sessions.some(s=>s.type==='functional')).length
            const gymTypes = [...new Set(plan.flatMap(d=>d.sessions.filter(s=>s.type==='gym').map(s=>s.details.split('–')[0].split('/')[0].trim())))]
            const yogaDays = plan.filter(d=>d.sessions.some(s=>s.type==='yoga')).length
            return [
              {l:'WEEKLY RUNNING TARGET', v:totalKm>0?`~${totalKm}km`:'—', c:'var(--accent)'},
              {l:'FUNCTIONAL SESSIONS',   v:`${funcDays} day${funcDays!==1?'s':''}`, c:'var(--orange)'},
              {l:'GYM SESSION TYPES',     v:`${gymTypes.length} type${gymTypes.length!==1?'s':''}`, c:'var(--purple)'},
              {l:'YOGA SESSIONS',         v:`${yogaDays} day${yogaDays!==1?'s':''}`, c:'var(--blue)'},
            ].map(({l,v,c})=>(
              <div key={l} style={{background:'var(--s1)',border:'1px solid var(--border)',borderRadius:'var(--r)',padding:'16px 20px'}}>
                <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)',letterSpacing:'1.5px',marginBottom:6}}>{l}</div>
                <div style={{fontFamily:'var(--font-head)',fontSize:28,color:c}}>{v}</div>
              </div>
            ))
          })()}
        </div>
      )}

      {editing?(
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          {displayPlan.map((day,di)=>(
            <EditDayCard key={day.day} day={day} di={di} updateSession={updateSession} deleteSession={deleteSession} addSession={addSession} moveSession={moveSession}/>
          ))}
        </div>
      ):(
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:10}}>
          {displayPlan.map((day)=>{
            const isToday=day.day===todayDayName, isOpen=expanded===day.day
            return (
              <div key={day.day} onClick={()=>setExpanded(isOpen?null:day.day)} style={{background:isToday?`${day.accent}0e`:'var(--s1)',border:isToday?`1px solid ${day.accent}55`:`1px solid ${isOpen?'var(--border2)':'var(--border)'}`,borderRadius:'var(--r-lg)',overflow:'hidden',cursor:'pointer',transition:'border-color 0.2s'}}>
                <div style={{padding:'14px 14px 12px',borderBottom:isOpen?'1px solid var(--border)':'none',background:isToday?`${day.accent}18`:'transparent'}}>
                  <div style={{fontFamily:'var(--font-head)',fontSize:26,color:day.accent,letterSpacing:1}}>{day.short}</div>
                  <div style={{fontFamily:'var(--font-body)',fontSize:11,color:'var(--muted)',marginTop:1}}>{day.day}</div>
                  {isToday&&<div style={{fontFamily:'var(--font-mono)',fontSize:9,color:day.accent,marginTop:4,letterSpacing:1}}>● TODAY</div>}
                </div>
                {!isOpen&&(<div style={{padding:'10px 14px 14px',display:'flex',flexDirection:'column',gap:6}}>{day.sessions.slice(0,4).map(s=>(<div key={s.id} style={{background:`${typeColor(s.type)}18`,border:`1px solid ${typeColor(s.type)}44`,borderRadius:5,padding:'4px 8px',fontFamily:'var(--font-mono)',fontSize:9,color:typeColor(s.type),overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.details.split('\n')[0].split('·')[0].trim()}</div>))}{day.sessions.length>4&&<div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)'}}>+{day.sessions.length-4} more</div>}</div>)}
                {isOpen&&(<div style={{padding:'14px',display:'flex',flexDirection:'column',gap:10}}>{day.sessions.map(s=>{const color=typeColor(s.type);const lines=s.details.split('\n').filter(Boolean);return(<div key={s.id} style={{background:'var(--s2)',borderRadius:8,borderLeft:`2px solid ${color}`,padding:'10px 12px'}}><div style={{fontFamily:'var(--font-mono)',fontSize:9,color,letterSpacing:'1.5px',marginBottom:6,fontWeight:600}}>{typeLabel(s.type).toUpperCase()}</div>{lines.map((line,i)=>(<div key={i} style={{fontSize:12,color:'var(--text)',marginBottom:i<lines.length-1?3:0}}>{lines.length>1?'• '+line:line}</div>))}</div>)})}</div>)}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function EditDayCard({ day, di, updateSession, deleteSession, addSession, moveSession }) {
  const [addOpen, setAddOpen]=useState(false)
  const [newType, setNewType]=useState('run')
  const [newDetails, setNewDetails]=useState('')
  const handleAdd=()=>{ addSession(di,newType,newDetails); setNewDetails(''); setNewType('run'); setAddOpen(false) }

  return (
    <div style={{background:'var(--s1)',border:`1px solid ${day.accent}33`,borderRadius:'var(--r-lg)',overflow:'hidden'}}>
      <div style={{padding:'14px 20px',background:`${day.accent}10`,borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:12}}>
        <span style={{fontFamily:'var(--font-head)',fontSize:28,color:day.accent,letterSpacing:1}}>{day.short}</span>
        <span style={{fontFamily:'var(--font-body)',fontSize:14,color:'var(--muted)'}}>{day.day}</span>
      </div>
      <div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:10}}>
        {day.sessions.length===0&&<div style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--muted2)',padding:'12px 0'}}>No sessions yet — add one below</div>}
        {day.sessions.map((s,si)=>(
          <div key={s.id} style={{display:'grid',gridTemplateColumns:'160px 1fr auto',gap:10,alignItems:'start',background:'var(--s2)',borderRadius:'var(--r)',padding:'12px 14px',border:`1px solid ${typeColor(s.type)}33`}}>
            <div>
              <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)',letterSpacing:1,marginBottom:5}}>SESSION TYPE</div>
              <select value={s.type} onChange={e=>updateSession(di,s.id,'type',e.target.value)} style={{fontSize:12,padding:'7px 10px',color:typeColor(s.type),borderColor:`${typeColor(s.type)}55`,background:'var(--s3)'}}>
                {SESSION_TYPES.map(t=><option key={t.key} value={t.key} style={{color:'var(--text)',background:'var(--s3)'}}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)',letterSpacing:1,marginBottom:5}}>DETAILS {s.type==='functional'&&<span style={{color:'var(--orange)',fontSize:8}}>(one per line)</span>}</div>
              {s.type==='functional'?(<textarea value={s.details} onChange={e=>updateSession(di,s.id,'details',e.target.value)} style={{fontSize:12,minHeight:72}}/>):(<input type='text' value={s.details} onChange={e=>updateSession(di,s.id,'details',e.target.value)} placeholder={`${typeLabel(s.type)} details...`} style={{fontSize:12}}/>)}
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:6,paddingTop:22}}>
              <button onClick={()=>moveSession(di,s.id,-1)} disabled={si===0} style={{background:'var(--s3)',border:'1px solid var(--border)',borderRadius:5,color:si===0?'var(--muted2)':'var(--muted)',cursor:si===0?'default':'pointer',padding:'4px 8px',fontSize:11}}>▲</button>
              <button onClick={()=>moveSession(di,s.id,1)} disabled={si===day.sessions.length-1} style={{background:'var(--s3)',border:'1px solid var(--border)',borderRadius:5,color:si===day.sessions.length-1?'var(--muted2)':'var(--muted)',cursor:si===day.sessions.length-1?'default':'pointer',padding:'4px 8px',fontSize:11}}>▼</button>
              <button onClick={()=>deleteSession(di,s.id)} style={{background:'rgba(255,107,107,0.12)',border:'1px solid rgba(255,107,107,0.3)',borderRadius:5,color:'var(--red)',cursor:'pointer',padding:'4px 8px',fontSize:12}}>✕</button>
            </div>
          </div>
        ))}
        {addOpen?(
          <div style={{background:'var(--s2)',borderRadius:'var(--r)',padding:'14px',border:'1px dashed var(--border2)',display:'flex',flexDirection:'column',gap:10}}>
            <div style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--accent)',letterSpacing:1}}>NEW SESSION</div>
            <div style={{display:'grid',gridTemplateColumns:'180px 1fr',gap:10,alignItems:'start'}}>
              <div>
                <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)',letterSpacing:1,marginBottom:5}}>TYPE</div>
                <select value={newType} onChange={e=>setNewType(e.target.value)} style={{fontSize:12,padding:'7px 10px',color:typeColor(newType),borderColor:`${typeColor(newType)}55`,background:'var(--s3)'}}>
                  {SESSION_TYPES.map(t=><option key={t.key} value={t.key} style={{color:'var(--text)',background:'var(--s3)'}}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)',letterSpacing:1,marginBottom:5}}>DETAILS</div>
                {newType==='functional'?(<textarea value={newDetails} onChange={e=>setNewDetails(e.target.value)} placeholder='100 Pull Ups&#10;200 Press Ups' style={{fontSize:12,minHeight:60}}/>):(<input type='text' value={newDetails} onChange={e=>setNewDetails(e.target.value)} placeholder={`${typeLabel(newType)} details...`} style={{fontSize:12}} onKeyDown={e=>e.key==='Enter'&&handleAdd()}/>)}
              </div>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={handleAdd} disabled={!newDetails.trim()} style={{background:newDetails.trim()?'var(--accent)':'var(--s3)',color:newDetails.trim()?'var(--bg)':'var(--muted2)',border:'none',borderRadius:7,padding:'8px 20px',fontFamily:'var(--font-mono)',fontSize:11,fontWeight:600,cursor:newDetails.trim()?'pointer':'default',letterSpacing:1}}>ADD SESSION</button>
              <button onClick={()=>{setAddOpen(false);setNewDetails('');setNewType('run')}} style={{background:'none',border:'1px solid var(--border2)',borderRadius:7,padding:'8px 16px',fontFamily:'var(--font-mono)',fontSize:11,color:'var(--muted)',cursor:'pointer'}}>CANCEL</button>
            </div>
          </div>
        ):(
          <button onClick={()=>setAddOpen(true)} style={{background:'none',border:'1px dashed var(--border2)',borderRadius:'var(--r)',color:'var(--muted)',fontFamily:'var(--font-mono)',fontSize:11,padding:'10px',cursor:'pointer',letterSpacing:1,textAlign:'left',display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:16,color:'var(--accent)'}}>+</span> ADD SESSION TO {day.day.toUpperCase()}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
function SettingsPage({ settings, saveSettings, stravaConnection, onStravaConnectionChange }) {
  const [local, setLocal]=useState(()=>JSON.parse(JSON.stringify(settings)))
  const [saved, setSaved]=useState(false)
  const setVal=(key,val)=>setLocal(p=>({...p,[key]:{...p[key],value:parseFloat(val)||val}}))
  const handleSave=async()=>{ await saveSettings(local); setSaved(true); setTimeout(()=>setSaved(false),3000) }
  const reset=()=>setLocal(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)))
  const GROUPS=[
    {title:'RUNNING',          accent:'var(--accent)',  keys:['weeklyKm']},
    {title:'BODY METRICS',     accent:'var(--blue)',    keys:['weightTarget','hrv','rhr']},
    {title:'SLEEP & RECOVERY', accent:'var(--purple)',  keys:['sleepScore','recoveryScore','hoursSlept']},
    {title:'NUTRITION',        accent:'var(--orange)',  keys:['dailyCalories','dailyProtein','dailyCarbs']},
  ]
  return (
    <div style={{padding:'24px 28px',maxWidth:860,margin:'0 auto'}} className='fade'>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:26}}>
        <div>
          <h1 style={{fontFamily:'var(--font-head)',fontSize:36,letterSpacing:2,lineHeight:1}}>GOALS & <span style={{color:'var(--accent)'}}>TARGETS</span></h1>
          <p style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--muted)',marginTop:5,letterSpacing:1}}>SET YOUR PERSONAL TARGETS · DASHBOARD REFLECTS STATUS IN REAL TIME</p>
        </div>
        <div style={{display:'flex',gap:10}}>
          <button onClick={reset} style={{background:'none',border:'1px solid var(--border2)',borderRadius:8,color:'var(--muted)',fontFamily:'var(--font-mono)',fontSize:11,padding:'10px 20px',cursor:'pointer',letterSpacing:1}}>RESET DEFAULTS</button>
          <SaveBtn saved={saved} onClick={handleSave}/>
        </div>
      </div>
      <div style={{background:'var(--s2)',border:'1px solid var(--border)',borderLeft:'3px solid var(--accent)',borderRadius:'var(--r)',padding:'14px 18px',marginBottom:22}}>
        <div style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--accent)',letterSpacing:1,marginBottom:6}}>HOW TARGETS WORK</div>
        <div style={{fontSize:13,color:'var(--muted)',lineHeight:1.65}}>Every stat on the dashboard and log form is compared against your targets in real time.
          <span style={{color:'#00e676',fontFamily:'var(--font-mono)',fontSize:11,marginLeft:8}}>■ Green</span> = on target ·
          <span style={{color:'#ff9f40',fontFamily:'var(--font-mono)',fontSize:11,marginLeft:6}}>■ Amber</span> = within 15% ·
          <span style={{color:'#ff6b6b',fontFamily:'var(--font-mono)',fontSize:11,marginLeft:6}}>■ Red</span> = off target.
        </div>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        {/* Strava connection */}
        <StravaConnectionCard stravaConnection={stravaConnection} onDisconnect={async()=>{ await fetch('/api/strava/disconnect',{method:'POST'}); onStravaConnectionChange?.(); }}/>

        {GROUPS.map(({title,accent,keys})=>(
          <div key={title} style={{background:'var(--s1)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',overflow:'hidden'}}>
            <div style={{padding:'13px 20px',borderBottom:'1px solid var(--border)',borderLeft:`3px solid ${accent}`}}><span style={{fontFamily:'var(--font-mono)',fontSize:11,fontWeight:600,letterSpacing:'2px',color:accent}}>{title}</span></div>
            <div style={{padding:20,display:'flex',flexDirection:'column',gap:20}}>
              {keys.map(key=>{ const def=local[key]; if(!def) return null; return (
                <div key={key} style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24,alignItems:'start'}}>
                  <div>
                    <div style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--muted)',letterSpacing:'1px',marginBottom:8}}>{def.label.toUpperCase()}{def.lowerIsBetter&&<span style={{color:'var(--red)',marginLeft:8,fontSize:9}}>↓ LOWER IS BETTER</span>}{def.isWeight&&<span style={{color:'var(--blue)',marginLeft:8,fontSize:9}}>GOAL WEIGHT</span>}</div>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <input type='number' value={def.value} step={key==='weightTarget'||key==='hoursSlept'?'0.5':'1'} min='0' onChange={e=>setVal(key,e.target.value)} style={{width:140,fontSize:18,fontFamily:'var(--font-mono)',fontWeight:600,letterSpacing:1}}/>
                      <span style={{fontFamily:'var(--font-mono)',fontSize:14,color:'var(--muted)'}}>{def.unit}</span>
                    </div>
                  </div>
                  <div style={{paddingTop:24}}>
                    <div style={{height:8,background:'var(--s3)',borderRadius:4,overflow:'hidden',marginBottom:8}}><div style={{height:'100%',width:'75%',background:accent,borderRadius:4,opacity:0.45}}/></div>
                    <div style={{fontSize:12,color:'var(--muted)',lineHeight:1.5}}>{def.lowerIsBetter?`Green when ${def.label.toLowerCase()} ≤ ${def.value}${def.unit}`:def.isWeight?`Green within ±0.5${def.unit} of ${def.value}${def.unit}`:`Green when you hit ${def.value}${def.unit}`}</div>
                  </div>
                </div>
              )})}
            </div>
          </div>
        ))}
      </div>
      <div style={{display:'flex',justifyContent:'flex-end',marginTop:22}}><SaveBtn saved={saved} onClick={handleSave} large/></div>

      {/* Whoop upload */}
      <WhoopUploadCard/>
      {/* Audit log */}
      <AuditLogPanel/>
    </div>
  )
}

// ─── WHOOP UPLOAD CARD ────────────────────────────────────────────────────────
function WhoopUploadCard() {
  const [files,     setFiles    ] = useState({})
  const [uploading, setUploading] = useState(false)
  const [result,    setResult   ] = useState(null)

  const FILE_SLOTS = [
    { key:'physiological_cycles', label:'physiological_cycles.csv', desc:'Recovery, HRV, RHR, strain' },
    { key:'sleeps',               label:'sleeps.csv',               desc:'Sleep scores, stages, efficiency' },
    { key:'workouts',             label:'workouts.csv',             desc:'Workout strain and HR zones' },
    { key:'journal_entries',      label:'journal_entries.csv',      desc:'Daily journal answers (optional)' },
  ]

  const handleUpload = async () => {
    if (!Object.keys(files).length) return
    setUploading(true); setResult(null)
    try {
      const fd = new FormData()
      Object.entries(files).forEach(([k,f]) => fd.append(k, f))
      const res  = await fetch('/api/whoop/upload', { method:'POST', body:fd })
      const data = await res.json()
      setResult(data.error ? { error: data.error } : { ok: true, message: data.message })
    } catch(e) { setResult({ error: e.message }) }
    setUploading(false)
  }

  return (
    <div style={{background:'var(--s1)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',overflow:'hidden',marginTop:16}}>
      <div style={{padding:'13px 20px',borderBottom:'1px solid var(--border)',borderLeft:'3px solid #a78bfa',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <span style={{fontFamily:'var(--font-mono)',fontSize:11,fontWeight:600,letterSpacing:'2px',color:'#a78bfa'}}>WHOOP DATA IMPORT</span>
        <span style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--muted)'}}>Upload exported CSV files from Whoop app → Account → Export Data</span>
      </div>
      <div style={{padding:20}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
          {FILE_SLOTS.map(({key,label,desc})=>(
            <label key={key} style={{background:'var(--s2)',border:`1px solid ${files[key]?'#a78bfa55':'var(--border2)'}`,borderRadius:'var(--r)',padding:'12px 16px',cursor:'pointer',display:'block',transition:'border-color 0.15s'}}>
              <div style={{fontFamily:'var(--font-mono)',fontSize:10,color:files[key]?'#a78bfa':'var(--muted)',letterSpacing:1,marginBottom:4}}>{label}</div>
              <div style={{fontSize:12,color:'var(--muted2)',marginBottom:8}}>{desc}</div>
              {files[key]
                ? <div style={{fontFamily:'var(--font-mono)',fontSize:11,color:'#a78bfa'}}>✓ {files[key].name}</div>
                : <div style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--muted)'}}>Click to select file</div>}
              <input type='file' accept='.csv' style={{display:'none'}} onChange={e=>{ if(e.target.files[0]) setFiles(p=>({...p,[key]:e.target.files[0]})) }}/>
            </label>
          ))}
        </div>
        {result&&(
          <div style={{background:result.error?'rgba(255,107,107,0.1)':'rgba(167,139,250,0.1)',border:`1px solid ${result.error?'#ff6b6b':'#a78bfa'}`,borderRadius:'var(--r)',padding:'10px 16px',marginBottom:12,fontFamily:'var(--font-mono)',fontSize:12,color:result.error?'#ff6b6b':'#a78bfa'}}>
            {result.error||result.message}
          </div>
        )}
        <button onClick={handleUpload} disabled={uploading||!Object.keys(files).length} style={{background:Object.keys(files).length?'#a78bfa':'var(--s3)',color:Object.keys(files).length?'#0d1018':'var(--muted)',border:'none',borderRadius:8,padding:'10px 28px',fontFamily:'var(--font-mono)',fontSize:12,fontWeight:600,cursor:Object.keys(files).length?'pointer':'default',letterSpacing:1}}>
          {uploading?'IMPORTING...':'IMPORT WHOOP DATA'}
        </button>
      </div>
    </div>
  )
}

// ─── AUDIT LOG PANEL ─────────────────────────────────────────────────────────
function AuditLogPanel() {
  const [entries,   setEntries  ] = useState([])
  const [loading,   setLoading  ] = useState(true)
  const [search,    setSearch   ] = useState('')
  const [typeFilter,setTypeFilter] = useState('all')

  useEffect(()=>{ loadEntries() },[])

  const loadEntries = async (type='all', q='') => {
    setLoading(true)
    const data = await db.loadAuditLog({ type: type==='all'?undefined:type, search:q||undefined })
    setEntries(data)
    setLoading(false)
  }

  const EVENT_COLORS = { strava_sync:'#fc4c02', whoop_upload:'#a78bfa', pb_set:'#00e676', activity_sync:'#40a9ff' }
  const fmtTs = (iso) => new Date(iso).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'2-digit',hour:'2-digit',minute:'2-digit'})

  return (
    <div style={{background:'var(--s1)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',overflow:'hidden',marginTop:16}}>
      <div style={{padding:'13px 20px',borderBottom:'1px solid var(--border)',borderLeft:'3px solid var(--blue)'}}>
        <span style={{fontFamily:'var(--font-mono)',fontSize:11,fontWeight:600,letterSpacing:'2px',color:'var(--blue)'}}>ACTIVITY LOG</span>
      </div>
      <div style={{padding:16,display:'flex',gap:10,borderBottom:'1px solid var(--border)'}}>
        <input type='text' placeholder='Search logs...' value={search} onChange={e=>{ setSearch(e.target.value); loadEntries(typeFilter,e.target.value) }} style={{maxWidth:280,fontSize:13}}/>
        <select value={typeFilter} onChange={e=>{ setTypeFilter(e.target.value); loadEntries(e.target.value,search) }} style={{fontSize:13,width:180}}>
          <option value='all'>All Events</option>
          <option value='strava_sync'>Strava Sync</option>
          <option value='whoop_upload'>Whoop Upload</option>
          <option value='pb_set'>Personal Bests</option>
          <option value='activity_sync'>Activity Sync</option>
        </select>
        <span style={{marginLeft:'auto',fontFamily:'var(--font-mono)',fontSize:11,color:'var(--muted)',alignSelf:'center'}}>{entries.length} entries</span>
      </div>
      <div style={{maxHeight:380,overflowY:'auto'}}>
        {loading?(
          <div style={{padding:24,textAlign:'center',fontFamily:'var(--font-mono)',fontSize:12,color:'var(--muted)'}}>Loading...</div>
        ):entries.length===0?(
          <div style={{padding:24,textAlign:'center',fontFamily:'var(--font-mono)',fontSize:12,color:'var(--muted)'}}>No log entries yet</div>
        ):entries.map(e=>(
          <div key={e.id} style={{display:'grid',gridTemplateColumns:'160px 120px 1fr',gap:12,padding:'10px 16px',borderBottom:'1px solid var(--border)',alignItems:'start'}}>
            <div style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--muted)'}}>{fmtTs(e.created_at)}</div>
            <div><span style={{fontFamily:'var(--font-mono)',fontSize:9,color:EVENT_COLORS[e.event_type]||'var(--muted)',background:`${EVENT_COLORS[e.event_type]||'var(--muted)'}18`,border:`1px solid ${EVENT_COLORS[e.event_type]||'var(--muted)'}44`,borderRadius:4,padding:'2px 7px',letterSpacing:1}}>{e.event_type?.replace('_',' ').toUpperCase()}</span></div>
            <div>
              <div style={{fontSize:13,color:'var(--text)',marginBottom:2}}>{e.title}</div>
              {e.detail&&<div style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--muted)'}}>{e.detail}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── TV MODE ──────────────────────────────────────────────────────────────────
function TVMode({ logs, settings, plan, activities, whoopData, setView }) {
  const [,setTick]=useState(0)
  const [tvPeriod, setTvPeriod]=useState('week')
  useEffect(()=>{ const id=setInterval(()=>setTick(t=>t+1),30000); return()=>clearInterval(id) },[])
  const today=todayStr(), now=new Date()
  const tl = mergeWhoopForDate(today, logs[today], whoopData)
  const planDayIndex=now.getDay()===0?6:now.getDay()-1
  const todayPlan=plan?.[planDayIndex]

  const ytdDays = Math.ceil((new Date()-new Date(new Date().getFullYear(),0,1))/86400000)+1
  const nDays = tvPeriod==='week'?7:tvPeriod==='month'?30:tvPeriod==='6month'?180:tvPeriod==='ytd'?ytdDays:365
  const periodDays = Array.from({length:nDays},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(nDays-1-i)); return d.toISOString().split('T')[0] })

  const stravaKmByDate={}
  ;(activities||[]).forEach(a=>{ const type=a.custom_type||a.strava_type; if(type!=='run') return; const km=(a.data?.distance||0)/1000; if(!km) return; const date=(a.start_date||'').split('T')[0]; stravaKmByDate[date]=(stravaKmByDate[date]||0)+km })
  const getKm=d=>stravaKmByDate[d]||parseFloat(logs[d]?.exercise?.runs?.[0]?.distance||logs[d]?.exercise?.running?.distance)||0
  const periodKm = periodDays.reduce((s,d)=>s+getKm(d),0)

  let streak=0; for(let i=0;i<365;i++){ const d=new Date(); d.setDate(d.getDate()-i); const ds=d.toISOString().split('T')[0]; if(logs[ds]||whoopData?.[ds]) streak++; else break }

  // Averages using merged Whoop data
  const avg=(key,sub)=>{ const vals=periodDays.map(d=>parseFloat(mergeWhoopForDate(d,logs[d],whoopData)?.[key]?.[sub])).filter(v=>!isNaN(v)&&v>0); return vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length*10)/10:null }

  const tvStats=[
    {label:'WEIGHT',    v:tl?.body?.weight,        avg:avg('body','weight'),        unit:'kg',   color:'#00e676',tKey:'weightTarget'},
    {label:'HRV',       v:tl?.body?.hrv,            avg:avg('body','hrv'),           unit:'',     color:'#40a9ff',tKey:'hrv'},
    {label:'RESTING HR',v:tl?.body?.rhr,            avg:avg('body','rhr'),           unit:'bpm',  color:'#ff9f40',tKey:'rhr'},
    {label:'SLEEP',     v:tl?.sleep?.sleepScore,    avg:avg('sleep','sleepScore'),   unit:'/100', color:'#b388ff',tKey:'sleepScore'},
    {label:'RECOVERY',  v:tl?.sleep?.recoveryScore, avg:avg('sleep','recoveryScore'),unit:'/100', color:'#00e676',tKey:'recoveryScore'},
    {label:'HRS SLEPT', v:tl?.sleep?.hoursSlept,    avg:avg('sleep','hoursSlept'),   unit:'h',    color:'#40a9ff',tKey:'hoursSlept'},
  ].map(s=>({ ...s, ts:targetStatus(s.v,settings[s.tKey]), avgTs:targetStatus(s.avg,settings[s.tKey]) }))

  const periodLabel = tvPeriod==='week'?'7 DAYS':tvPeriod==='month'?'30 DAYS':tvPeriod==='6month'?'6 MONTHS':tvPeriod==='ytd'?`YTD ${now.getFullYear()}`:'1 YEAR'

  // Nutrition totals + averages for period
  const nutritionPeriod = periodDays.reduce((acc,d)=>{
    const cal=parseFloat(logs[d]?.nutrition?.calories)||0
    const pro=parseFloat(logs[d]?.nutrition?.protein)||0
    const carb=parseFloat(logs[d]?.nutrition?.carbs)||0
    if(cal||pro||carb) acc.days++
    acc.calories+=cal; acc.protein+=pro; acc.carbs+=carb
    return acc
  },{calories:0,protein:0,carbs:0,days:0})
  const nutritionAvg = nutritionPeriod.days>0 ? {
    calories: Math.round(nutritionPeriod.calories/nutritionPeriod.days),
    protein:  Math.round(nutritionPeriod.protein/nutritionPeriod.days),
    carbs:    Math.round(nutritionPeriod.carbs/nutritionPeriod.days),
  } : null

  return (
    <div style={{minHeight:'calc(100vh - 60px)',background:'var(--bg)',padding:'28px 36px',display:'flex',flexDirection:'column',gap:18}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div><div style={{fontFamily:'var(--font-head)',fontSize:48,letterSpacing:3,lineHeight:1}}><span style={{color:'var(--accent)'}}>WG</span> HUB</div><div style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--muted)',marginTop:4}}>PERFORMANCE DASHBOARD · AUTO-REFRESHES EVERY 30s</div></div>
        <div style={{display:'flex',gap:8}}>
          {[{k:'week',l:'WEEK'},{k:'month',l:'MONTH'},{k:'6month',l:'6M'},{k:'1year',l:'1Y'},{k:'ytd',l:'YTD'}].map(({k,l})=>(
            <button key={k} onClick={()=>setTvPeriod(k)} style={{background:tvPeriod===k?'var(--accent)':'var(--s2)',color:tvPeriod===k?'var(--bg)':'var(--muted)',border:`1px solid ${tvPeriod===k?'var(--accent)':'var(--border)'}`,borderRadius:7,padding:'6px 16px',fontFamily:'var(--font-mono)',fontSize:11,cursor:'pointer',letterSpacing:1}}>{l}</button>
          ))}
        </div>
        <div style={{textAlign:'right'}}><div style={{fontFamily:'var(--font-head)',fontSize:52,color:'var(--accent)',lineHeight:1}}>{now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div><div style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--muted)',marginTop:4}}>{now.toLocaleDateString('en-US',{weekday:'long'}).toUpperCase()} · {now.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}).toUpperCase()}</div></div>
        <button onClick={()=>setView('dashboard')} style={{background:'var(--s2)',border:'1px solid var(--border2)',borderRadius:8,color:'var(--muted)',fontFamily:'var(--font-mono)',fontSize:11,padding:'8px 18px',cursor:'pointer',letterSpacing:1}}>← EXIT TV</button>
      </div>

      {/* Today's values + period averages */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:12}}>
        {tvStats.map(({label,v,avg:avgV,unit,color,ts,avgTs})=>(
          <div key={label} style={{background:'var(--s1)',border:`1px solid ${ts?ts.color+'44':'var(--border)'}`,borderRadius:'var(--r-lg)',padding:'18px 14px',textAlign:'center',position:'relative',overflow:'hidden'}}>
            {ts&&<div style={{position:'absolute',bottom:0,left:0,right:0,height:4,background:'var(--s3)'}}><div style={{height:'100%',width:`${ts.pct}%`,background:ts.color,borderRadius:2}}/></div>}
            <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)',letterSpacing:'1.5px',marginBottom:6}}>{label}</div>
            <div style={{fontFamily:'var(--font-head)',fontSize:40,color:ts?ts.color:(v?color:'var(--muted2)'),lineHeight:1}}>{v||'—'}</div>
            <div style={{fontFamily:'var(--font-mono)',fontSize:11,color:ts?ts.color:color,opacity:0.6,marginTop:2}}>{v?`TODAY ${unit}`:''}</div>
            {avgV&&(
              <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid var(--border)'}}>
                <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)',letterSpacing:1}}>AVG {periodLabel}</div>
                <div style={{fontFamily:'var(--font-head)',fontSize:24,color:avgTs?avgTs.color:color,lineHeight:1.2}}>{avgV}<span style={{fontFamily:'var(--font-mono)',fontSize:10,opacity:0.6}}>{unit}</span></div>
                {avgTs&&<div style={{fontFamily:'var(--font-mono)',fontSize:8,color:avgTs.color,marginTop:2}}>{avgTs.status}</div>}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 2fr',gap:14}}>
        <div style={{background:'var(--s1)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',padding:'22px 24px'}}>
          <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)',letterSpacing:'1.5px',marginBottom:8}}>KM RUN · {periodLabel}</div>
          <div style={{fontFamily:'var(--font-head)',fontSize:72,color:'var(--blue)',lineHeight:1}}>{periodKm.toFixed(1)}</div>
          <div style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--muted)',marginTop:6}}>kilometres</div>
        </div>
        {/* Nutrition totals */}
        <div style={{background:'var(--s1)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',padding:'22px 24px'}}>
          <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)',letterSpacing:'1.5px',marginBottom:12}}>NUTRITION TOTALS · {periodLabel} {nutritionPeriod.days>0?`· ${nutritionPeriod.days} days`:''}</div>
          {nutritionPeriod.days>0?(
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {[{l:'CALORIES',v:Math.round(nutritionPeriod.calories).toLocaleString(),unit:'kcal',color:'#00e676',tKey:'dailyCalories',daily:Math.round(nutritionPeriod.calories/nutritionPeriod.days)},{l:'PROTEIN',v:Math.round(nutritionPeriod.protein).toLocaleString(),unit:'g',color:'#40a9ff',tKey:'dailyProtein',daily:Math.round(nutritionPeriod.protein/nutritionPeriod.days)},{l:'CARBS',v:Math.round(nutritionPeriod.carbs).toLocaleString(),unit:'g',color:'#ff9f40',tKey:'dailyCarbs',daily:Math.round(nutritionPeriod.carbs/nutritionPeriod.days)}].map(({l,v,unit,color,tKey,daily})=>{
                const ts2=targetStatus(daily,settings[tKey])
                return (<div key={l}><div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:3}}><span style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)',letterSpacing:1}}>{l}</span><span style={{fontFamily:'var(--font-head)',fontSize:22,color:ts2?ts2.color:color}}>{v}<span style={{fontFamily:'var(--font-mono)',fontSize:10,opacity:0.6}}>{unit}</span></span></div><div style={{height:4,background:'var(--s3)',borderRadius:2,overflow:'hidden'}}><div style={{height:'100%',width:`${ts2?.pct||0}%`,background:ts2?ts2.color:color,borderRadius:2}}/></div><div style={{fontFamily:'var(--font-mono)',fontSize:8,color:'var(--muted2)',marginTop:2}}>{daily}{unit}/day avg</div></div>)
              })}
            </div>
          ):(
            <div style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--muted2)'}}>No nutrition logged this period</div>
          )}
        </div>
        {todayPlan&&(
          <div style={{background:'var(--s1)',border:`1px solid ${todayPlan.accent}44`,borderRadius:'var(--r-lg)',padding:'22px 24px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
              <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)',letterSpacing:'1.5px'}}>TODAY'S TRAINING</div>
              <div style={{fontFamily:'var(--font-head)',fontSize:22,color:todayPlan.accent}}>{todayPlan.day.toUpperCase()}</div>
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
              {todayPlan.sessions.map(s=>(
                <div key={s.id} style={{background:`${typeColor(s.type)}18`,border:`1px solid ${typeColor(s.type)}44`,borderRadius:6,padding:'7px 14px',fontFamily:'var(--font-mono)',fontSize:12,color:typeColor(s.type)}}>
                  {s.details.split('\n')[0].split('·')[0].trim()}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── STRAVA CONNECTION CARD ───────────────────────────────────────────────────
function StravaConnectionCard({ stravaConnection, onDisconnect }) {
  const [disconnecting, setDisconnecting] = useState(false)

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Strava? Your synced activities will remain in the database.')) return
    setDisconnecting(true)
    await onDisconnect()
    setDisconnecting(false)
  }

  const timeAgo = (iso) => {
    if (!iso) return 'Never'
    const diff  = Date.now() - new Date(iso).getTime()
    const hours = Math.floor(diff / 3600000)
    const days  = Math.floor(hours / 24)
    if (hours < 1)  return 'Just now'
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  return (
    <div style={{background:'var(--s1)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',overflow:'hidden'}}>
      <div style={{padding:'13px 20px',borderBottom:'1px solid var(--border)',borderLeft:'3px solid #fc4c02',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <span style={{fontFamily:'var(--font-mono)',fontSize:11,fontWeight:600,letterSpacing:'2px',color:'#fc4c02'}}>STRAVA</span>
        {stravaConnection
          ? <span style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--accent)',background:'var(--accent-dim)',padding:'3px 10px',borderRadius:5}}>CONNECTED</span>
          : <span style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--muted)',background:'var(--s3)',padding:'3px 10px',borderRadius:5}}>NOT CONNECTED</span>
        }
      </div>
      <div style={{padding:20}}>
        {stravaConnection ? (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,alignItems:'center'}}>
            <div>
              <div style={{fontFamily:'var(--font-head)',fontSize:26,marginBottom:4}}>{stravaConnection.athlete_name}</div>
              {stravaConnection.athlete_city && <div style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--muted)'}}>{stravaConnection.athlete_city}, {stravaConnection.athlete_country}</div>}
              <div style={{display:'flex',gap:20,marginTop:14}}>
                {[
                  {l:'ACTIVITIES', v:stravaConnection.activity_count||'—'},
                  {l:'LAST SYNC',  v:timeAgo(stravaConnection.last_synced_at)},
                  {l:'CONNECTED',  v:timeAgo(stravaConnection.connected_at)},
                ].map(({l,v})=>(
                  <div key={l}>
                    <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)',letterSpacing:1,marginBottom:3}}>{l}</div>
                    <div style={{fontFamily:'var(--font-mono)',fontSize:13,color:'var(--text)'}}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:10,alignItems:'flex-start'}}>
              <div style={{fontSize:13,color:'var(--muted)',lineHeight:1.6}}>
                Your Strava account is connected. Activities sync to the History page automatically. Custom names and session types you set are always preserved.
              </div>
              <button onClick={handleDisconnect} disabled={disconnecting} style={{
                background:'none',border:'1px solid rgba(255,107,107,0.4)',borderRadius:7,
                color:'var(--red)',fontFamily:'var(--font-mono)',fontSize:11,
                padding:'8px 16px',cursor:'pointer',letterSpacing:1,
              }}>{disconnecting ? 'DISCONNECTING...' : 'DISCONNECT STRAVA'}</button>
            </div>
          </div>
        ) : (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,alignItems:'center'}}>
            <div>
              <div style={{fontSize:14,color:'var(--text)',marginBottom:8,fontWeight:500}}>Connect your Strava account</div>
              <div style={{fontSize:13,color:'var(--muted)',lineHeight:1.65,marginBottom:16}}>
                Sync all your activities automatically. Activities appear in the History page where you can rename them, change their type, and add notes. Your Strava data is never modified.
              </div>
              <a href="/api/strava/connect" style={{
                display:'inline-block',
                background:'#fc4c02',color:'#fff',textDecoration:'none',
                borderRadius:8,padding:'10px 24px',
                fontFamily:'var(--font-mono)',fontSize:12,fontWeight:600,letterSpacing:1,
              }}>🔗 CONNECT STRAVA</a>
            </div>
            <div style={{background:'var(--s2)',borderRadius:'var(--r)',padding:'16px 20px'}}>
              <div style={{fontFamily:'var(--font-mono)',fontSize:10,color:'#fc4c02',letterSpacing:1,marginBottom:10}}>WHAT GETS SYNCED</div>
              {['All runs, rides, swims and gym sessions','Activity name, type, distance, duration, pace','Heart rate data where available','Elevation gain','Syncs new activities incrementally (fast)'].map(item=>(
                <div key={item} style={{display:'flex',gap:8,marginBottom:6}}>
                  <span style={{color:'var(--accent)',flexShrink:0}}>✓</span>
                  <span style={{fontSize:13,color:'var(--muted)'}}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── PLANNER PAGE ─────────────────────────────────────────────────────────────
function PlannerPage() {
  return (
    <div style={{padding:'24px 28px',maxWidth:1100,margin:'0 auto'}} className='fade'>
      <h1 style={{fontFamily:'var(--font-head)',fontSize:38,letterSpacing:2,lineHeight:1,marginBottom:8}}>PLANNER <span style={{color:'var(--accent)'}}>& ORGANISER</span></h1>
      <p style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--muted)',letterSpacing:1,marginBottom:32}}>Calendar, appointments, to-do lists and journal — coming soon.</p>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16}}>
        {[
          {title:'CALENDAR',      icon:'📅', desc:'View and manage appointments, races, and training events across weeks and months.', color:'var(--accent)'},
          {title:'TO-DO LIST',    icon:'✅', desc:'Track tasks, goals and action items. Synced to TV mode display.', color:'var(--blue)'},
          {title:'JOURNAL',       icon:'📓', desc:'Daily notes, reflections, and training observations.', color:'var(--orange)'},
        ].map(({title,icon,desc,color})=>(
          <div key={title} style={{background:'var(--s1)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',padding:'28px 24px',display:'flex',flexDirection:'column',gap:14}}>
            <div style={{fontSize:32}}>{icon}</div>
            <div style={{fontFamily:'var(--font-head)',fontSize:26,color,letterSpacing:1}}>{title}</div>
            <div style={{fontSize:13,color:'var(--muted)',lineHeight:1.6}}>{desc}</div>
            <div style={{marginTop:'auto',fontFamily:'var(--font-mono)',fontSize:10,color:'var(--muted2)',letterSpacing:1,borderTop:'1px solid var(--border)',paddingTop:14}}>COMING SOON</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── FINANCE PAGE ──────────────────────────────────────────────────────────────
function FinancePage() {
  return (
    <div style={{padding:'24px 28px',maxWidth:1100,margin:'0 auto'}} className='fade'>
      <h1 style={{fontFamily:'var(--font-head)',fontSize:38,letterSpacing:2,lineHeight:1,marginBottom:8}}>FINANCE <span style={{color:'var(--accent)'}}>TRACKER</span></h1>
      <p style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--muted)',letterSpacing:1,marginBottom:32}}>Savings, investments and money tracking — coming soon.</p>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16}}>
        {[
          {title:'SAVINGS',     icon:'💰', desc:'Track savings goals, monthly contributions and progress towards targets.',    color:'var(--accent)'},
          {title:'INVESTMENTS', icon:'📈', desc:'Monitor portfolio performance, asset allocation and growth over time.',       color:'var(--blue)'},
          {title:'BUDGET',      icon:'📊', desc:'Monthly income vs expenditure, category breakdown and spending trends.',     color:'var(--orange)'},
        ].map(({title,icon,desc,color})=>(
          <div key={title} style={{background:'var(--s1)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',padding:'28px 24px',display:'flex',flexDirection:'column',gap:14}}>
            <div style={{fontSize:32}}>{icon}</div>
            <div style={{fontFamily:'var(--font-head)',fontSize:26,color,letterSpacing:1}}>{title}</div>
            <div style={{fontSize:13,color:'var(--muted)',lineHeight:1.6}}>{desc}</div>
            <div style={{marginTop:'auto',fontFamily:'var(--font-mono)',fontSize:10,color:'var(--muted2)',letterSpacing:1,borderTop:'1px solid var(--border)',paddingTop:14}}>COMING SOON</div>
          </div>
        ))}
      </div>
    </div>
  )
}
function SaveBtn({saved,saving,onClick,large}){
  const label = saving ? 'SAVING...' : saved ? '✓ SAVED' : 'SAVE'
  return <button onClick={onClick} disabled={saving} style={{background:saved||saving?'transparent':'var(--accent)',color:saved?'var(--accent)':saving?'var(--muted)':'#07090f',border:saved?'1px solid var(--accent)':saving?'1px solid var(--border)':'1px solid transparent',borderRadius:8,padding:large?'12px 40px':'10px 22px',fontFamily:'var(--font-mono)',fontSize:large?13:12,fontWeight:600,cursor:saving?'default':'pointer',letterSpacing:1,transition:'all 0.2s',minWidth:large?200:120}}>{label}</button>
}
function LogSection({title,accent,children}){
  return <div style={{background:'var(--s1)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',overflow:'hidden'}}><div style={{padding:'13px 20px',borderBottom:'1px solid var(--border)',borderLeft:`3px solid ${accent}`}}><span style={{fontFamily:'var(--font-mono)',fontSize:11,fontWeight:600,letterSpacing:'2px',color:accent}}>{title}</span></div><div style={{padding:20}}>{children}</div></div>
}
function ExBlock({checked,toggle,label,accent,children}){
  return <div style={{background:'var(--s2)',borderRadius:10,overflow:'hidden',border:checked?`1px solid ${accent}44`:'1px solid var(--border)',transition:'border-color 0.2s'}}><div onClick={toggle} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',cursor:'pointer',background:checked?`${accent}0d`:'transparent',transition:'background 0.2s'}}><input type='checkbox' checked={checked} onChange={toggle} onClick={e=>e.stopPropagation()}/><span style={{fontFamily:'var(--font-mono)',fontSize:12,fontWeight:600,letterSpacing:1,color:checked?accent:'var(--muted)'}}>{label}</span></div>{checked&&<div style={{padding:16,borderTop:'1px solid var(--border)'}}>{children}</div>}</div>
}
function Row({cols,children}){ return <div style={{display:'grid',gridTemplateColumns:`repeat(${cols},1fr)`,gap:12}}>{children}</div> }
function FF({label,ts,children}){
  return (
    <div style={{display:'flex',flexDirection:'column',gap:5}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <label style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)',letterSpacing:'1.5px'}}>{label}</label>
        {ts&&<span style={{fontFamily:'var(--font-mono)',fontSize:8,color:ts.color}}>{ts.status}</span>}
      </div>
      {children}
      {ts&&<div style={{height:3,background:'var(--s3)',borderRadius:2,overflow:'hidden'}}><div style={{height:'100%',width:`${ts.pct}%`,background:ts.color,borderRadius:2,transition:'width 0.3s ease'}}/></div>}
    </div>
  )
}
