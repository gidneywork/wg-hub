'use client'

import { useState, useEffect } from 'react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { db } from '../lib/db'

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
const getDayName = (d) => new Date(d+'T00:00:00').toLocaleDateString('en-US',{weekday:'long'})
const mkEmpty    = () => ({
  nutrition:{calories:'',protein:'',carbs:''},
  sleep:{sleepScore:'',recoveryScore:'',hoursSlept:'',bedTime:''},
  exercise:{running:{on:false,distance:'',duration:'',notes:''},functional:{on:false,exercises:DEFAULT_FUNC()},gym:{on:false,types:[]},yoga:{on:false,duration:''}},
  body:{rhr:'',hrv:'',weight:''},
})
const TT = {background:'#131722',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,fontFamily:'var(--font-mono)',fontSize:12,color:'#e8edf5',padding:'8px 12px'}

const CSS_VARS = `
  :root {
    --bg:#07090f; --s1:#0d1018; --s2:#131722; --s3:#1a2030; --s4:#21293a;
    --border:rgba(255,255,255,0.07); --border2:rgba(255,255,255,0.12);
    --accent:#00e676; --accent-dim:rgba(0,230,118,0.12);
    --blue:#40a9ff; --orange:#ff9f40; --purple:#b388ff; --red:#ff6b6b; --yellow:#ffd666;
    --text:#e8edf5; --muted:#6b7a96; --muted2:#4a5568;
    --font-head:'Bebas Neue','Impact',sans-serif;
    --font-mono:'IBM Plex Mono','Courier New',monospace;
    --font-body:'DM Sans',system-ui,sans-serif;
    --r:10px; --r-lg:14px;
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
  return {color:met?'#00e676':pct>=80?'#ff9f40':'#ff6b6b',pct,status:met?'on target':`${Math.round(pct)}% of target`}
}

function calcRecords(logs) {
  let longestRun=0,bestSleep=0,bestHrv=0,lowestRhr=999,heaviestWeek=0,bestRecovery=0
  let lrD='',bsD='',bhD='',lrhrD='',brD=''
  const wkKm={}
  Object.entries(logs).forEach(([date,log])=>{
    const km=parseFloat(log?.exercise?.running?.distance)||0
    if(km>longestRun){longestRun=km;lrD=date}
    const sl=parseFloat(log?.sleep?.sleepScore)||0; if(sl>bestSleep){bestSleep=sl;bsD=date}
    const hrv=parseFloat(log?.body?.hrv)||0; if(hrv>bestHrv){bestHrv=hrv;bhD=date}
    const rhr=parseFloat(log?.body?.rhr)||0; if(rhr>0&&rhr<lowestRhr){lowestRhr=rhr;lrhrD=date}
    const rec=parseFloat(log?.sleep?.recoveryScore)||0; if(rec>bestRecovery){bestRecovery=rec;brD=date}
    if(km){const dt=new Date(date+'T00:00:00');const mon=new Date(dt);mon.setDate(dt.getDate()-(dt.getDay()===0?6:dt.getDay()-1));const k=mon.toISOString().split('T')[0];wkKm[k]=(wkKm[k]||0)+km}
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
  const [ready,    setReady   ] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const [logsData, settingsData, planData] = await Promise.all([
          db.loadLogs(),
          db.loadSettings(),
          db.loadPlan(),
        ])
        setLogs(logsData || {})
        if (settingsData) setSettings(settingsData)
        setPlan(planData || getDefaultPlan())
      } catch (e) {
        console.error('Initial load failed:', e)
        setPlan(getDefaultPlan())
      }
      setReady(true)
    })()
  }, [])

  const saveLog      = async (date, data) => { await db.saveLog(date, data);     setLogs(p => ({...p, [date]: data})) }
  const saveSettings = async (s)          => { await db.saveSettings(s);         setSettings(s) }
  const savePlan     = async (p)          => { await db.savePlan(p);             setPlan(p) }

  const planDayIndex     = new Date().getDay()===0?6:new Date().getDay()-1
  const todayPlan        = plan?.[planDayIndex]
  const todayRunSession  = todayPlan?.sessions?.find(s=>s.type==='run')
  const todayIsRest      = todayPlan?.sessions?.some(s=>s.type==='rest')

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)',fontFamily:'var(--font-body)'}}>
      <style>{CSS_VARS}</style>

      {/* ── NAV ── */}
      <nav style={{position:'fixed',top:0,left:0,right:0,zIndex:200,background:'rgba(7,9,15,0.95)',backdropFilter:'blur(16px)',borderBottom:'1px solid var(--border)',height:60,display:'flex',alignItems:'center',padding:'0 24px',gap:22}}>
        <div style={{display:'flex',alignItems:'baseline',gap:6,marginRight:6,flexShrink:0}}>
          <span style={{fontFamily:'var(--font-head)',fontSize:24,color:'var(--accent)',letterSpacing:1}}>WG</span>
          <span style={{fontFamily:'var(--font-head)',fontSize:24,letterSpacing:1}}>HUB</span>
          <span style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)',marginLeft:4}}>PERFORMANCE</span>
        </div>
        {[{k:'dashboard',l:'DASHBOARD'},{k:'log',l:'LOG DATA'},{k:'plan',l:'TRAINING PLAN'},{k:'settings',l:'SETTINGS'}].map(({k,l})=>(
          <button key={k} onClick={()=>setView(k)} style={{background:'none',border:'none',cursor:'pointer',fontFamily:'var(--font-mono)',fontSize:11,letterSpacing:'1.5px',color:view===k?'var(--accent)':'var(--muted)',paddingBottom:2,borderBottom:`2px solid ${view===k?'var(--accent)':'transparent'}`,transition:'color 0.15s',whiteSpace:'nowrap'}}>{l}</button>
        ))}
        <button onClick={()=>setView('tv')} style={{background:view==='tv'?'var(--accent)':'var(--s2)',color:view==='tv'?'var(--bg)':'var(--muted)',border:'1px solid var(--border2)',borderRadius:7,padding:'5px 13px',fontFamily:'var(--font-mono)',fontSize:10,cursor:'pointer',letterSpacing:1,transition:'all 0.15s',whiteSpace:'nowrap'}}>TV MODE</button>
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:16,flexShrink:0}}>
          <div style={{textAlign:'right'}}>
            <div style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--accent)'}}>{new Date().toLocaleDateString('en-US',{weekday:'long'}).toUpperCase()}</div>
            <div style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--muted)'}}>{new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</div>
          </div>
          {todayPlan&&(
            <div style={{background:'var(--s2)',border:'1px solid var(--border)',borderRadius:7,padding:'5px 12px',flexShrink:0}}>
              <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)',letterSpacing:1}}>TODAY</div>
              <div style={{fontFamily:'var(--font-mono)',fontSize:11,color:todayPlan.accent}}>{todayIsRest?'REST DAY':todayRunSession?todayRunSession.details.split('·')[0].trim():'Training Day'}</div>
            </div>
          )}
          <button onClick={onSignOut} style={{background:'none',border:'1px solid var(--border)',borderRadius:7,padding:'5px 12px',fontFamily:'var(--font-mono)',fontSize:10,color:'var(--muted)',cursor:'pointer',letterSpacing:1,whiteSpace:'nowrap'}}>SIGN OUT</button>
        </div>
      </nav>

      <div style={{paddingTop:60}}>
        {!ready?(
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'calc(100vh - 60px)',gap:12}}>
            <div style={{width:20,height:20,border:'2px solid var(--accent)',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
            <span style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--muted)'}}>Loading training data...</span>
          </div>
        ):view==='dashboard'?<Dashboard  logs={logs} settings={settings} setView={setView}/>
         :view==='log'?      <LogData    logs={logs} saveLog={saveLog} settings={settings} plan={plan}/>
         :view==='plan'?     <TrainingPlan plan={plan} savePlan={savePlan}/>
         :view==='settings'? <SettingsPage settings={settings} saveSettings={saveSettings}/>
         :                   <TVMode logs={logs} settings={settings} plan={plan} setView={setView}/>
        }
      </div>
    </div>
  )
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ logs, settings, setView }) {
  const [period, setPeriod] = useState('7D')
  const nDays=period==='7D'?7:period==='30D'?30:period==='90D'?90:365
  const days=Array.from({length:nDays},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(nDays-1-i)); return d.toISOString().split('T')[0] })
  const today=todayStr(), tl=logs[today]

  const weekStart=new Date(); weekStart.setDate(weekStart.getDate()-(weekStart.getDay()===0?6:weekStart.getDay()-1))
  const thisWeekKm=Object.keys(logs).filter(d=>new Date(d+'T00:00:00')>=weekStart).reduce((s,d)=>s+(parseFloat(logs[d]?.exercise?.running?.distance)||0),0)

  const totalKm=days.reduce((s,d)=>s+(parseFloat(logs[d]?.exercise?.running?.distance)||0),0)
  const logsCount=days.filter(d=>logs[d]).length
  const sleepDays=days.filter(d=>logs[d]?.sleep?.sleepScore)
  const avgSleep=sleepDays.length?Math.round(sleepDays.reduce((s,d)=>s+parseFloat(logs[d].sleep.sleepScore),0)/sleepDays.length):null
  const hrvDays=days.filter(d=>logs[d]?.body?.hrv)
  const avgHrv=hrvDays.length?Math.round(hrvDays.reduce((s,d)=>s+parseFloat(logs[d].body.hrv),0)/hrvDays.length):null
  const load=days.reduce((s,d)=>{ const l=logs[d]; if(!l) return s; return s+(parseFloat(l.exercise?.running?.distance)||0)+(l.exercise?.gym?.on?(l.exercise.gym.types.length||1)*8:0)+(l.exercise?.yoga?.on?3:0)+(l.exercise?.functional?.on?4:0) },0)

  let streak=0; for(let i=0;i<365;i++){ const d=new Date(); d.setDate(d.getDate()-i); if(logs[d.toISOString().split('T')[0]]) streak++; else break }
  const records=calcRecords(logs)

  const weightData=days.map(d=>({date:fmtDate(d).split(' ').slice(0,2).join(' '),weight:logs[d]?.body?.weight?parseFloat(logs[d].body.weight):null})).filter(r=>r.weight)
  const sleepData=days.map(d=>({date:fmtDate(d).split(' ').slice(0,2).join(' '),sleep:parseFloat(logs[d]?.sleep?.sleepScore)||null,recovery:parseFloat(logs[d]?.sleep?.recoveryScore)||null})).filter(r=>r.sleep||r.recovery)
  const hrvData=days.map(d=>({date:fmtDate(d).split(' ').slice(0,2).join(' '),hrv:parseFloat(logs[d]?.body?.hrv)||null,rhr:parseFloat(logs[d]?.body?.rhr)||null})).filter(r=>r.hrv||r.rhr)
  const wkMap={}
  days.forEach(d=>{ const km=parseFloat(logs[d]?.exercise?.running?.distance)||0; if(km){const dt=new Date(d+'T00:00:00');const mon=new Date(dt);mon.setDate(dt.getDate()-(dt.getDay()===0?6:dt.getDay()-1));const k=mon.toISOString().split('T')[0];wkMap[k]=(wkMap[k]||0)+km} })
  const kmData=Object.entries(wkMap).sort(([a],[b])=>a.localeCompare(b)).map(([k,km])=>({week:`${new Date(k+'T00:00:00').getDate()}/${new Date(k+'T00:00:00').getMonth()+1}`,km:Math.round(km*10)/10,target:settings.weeklyKm?.value||null}))

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
  const ChartEmpty=()=><div style={{height:200,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--muted2)',fontFamily:'var(--font-mono)',fontSize:12}}>No data logged yet for this period</div>

  return (
    <div style={{padding:'24px 28px',maxWidth:1440,margin:'0 auto'}} className='fade'>
      <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:20}}>
        <div>
          <h1 style={{fontFamily:'var(--font-head)',fontSize:38,letterSpacing:2,lineHeight:1}}>TRAINING <span style={{color:'var(--accent)'}}>DASHBOARD</span></h1>
          <p style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--muted)',marginTop:5,letterSpacing:1}}>WG HUB · PERSONAL PERFORMANCE DASHBOARD</p>
        </div>
        <div style={{display:'flex',gap:6}}>
          {['7D','30D','90D','1Y'].map(p=>(
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
          {[{l:`KM (${period})`,v:`${totalKm.toFixed(1)}km`,c:'var(--accent)'},{l:'DAYS LOGGED',v:logsCount,c:'var(--blue)'},{l:'AVG SLEEP',v:avgSleep?`${avgSleep}/100`:'—',c:'var(--purple)'},{l:'AVG HRV',v:avgHrv??'—',c:'var(--orange)'},{l:'LOAD SCORE',v:Math.round(load),c:'var(--red)'},{l:'STREAK',v:`${streak}d`,c:'var(--accent)'}].map(({l,v,c})=>(
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
            <div style={{background:'var(--s1)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',padding:'20px 22px'}}>
              <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)',letterSpacing:'1.5px',marginBottom:14}}>TODAY'S NUTRITION</div>
              {cal>0?(
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16}}>
                  {[{label:'PROTEIN',val:pro,unit:'g',color:'#40a9ff',tKey:'dailyProtein'},{label:'CARBS',val:carb,unit:'g',color:'#ff9f40',tKey:'dailyCarbs'},{label:'CALORIES',val:cal,unit:'kcal',color:'#00e676',tKey:'dailyCalories'}].map(({label,val,unit,color,tKey})=>{
                    const ts2=targetStatus(val,settings[tKey])
                    return (<div key={label}><div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}><span style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)',letterSpacing:1}}>{label}</span><span style={{fontFamily:'var(--font-head)',fontSize:20,color:ts2?ts2.color:color}}>{label==='CALORIES'?Number(val).toLocaleString():val}<span style={{fontSize:11,opacity:0.7}}>{unit}</span></span></div>{settings[tKey]?.value&&(<div style={{height:6,background:'var(--s3)',borderRadius:3,overflow:'hidden'}}><div style={{height:'100%',width:`${ts2?.pct||0}%`,background:ts2?ts2.color:color,borderRadius:3,transition:'width 0.5s ease'}}/></div>)}{ts2&&<div style={{fontFamily:'var(--font-mono)',fontSize:8,color:ts2.color,marginTop:3}}>{ts2.status}</div>}</div>)
                  })}
                </div>
              ):(
                <div style={{color:'var(--muted2)',fontFamily:'var(--font-mono)',fontSize:12}}>No nutrition logged today — <button onClick={()=>setView('log')} style={{background:'none',border:'none',color:'var(--accent)',fontFamily:'var(--font-mono)',fontSize:12,cursor:'pointer',textDecoration:'underline'}}>log now</button></div>
              )}
            </div>
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
            <ChartCard title='WEEKLY RUNNING KM' sub={`Kilometres per week${settings.weeklyKm?.value?` · target ${settings.weeklyKm.value}km`:''}`}>
              {kmData.length>0?(<ResponsiveContainer width='100%' height={200}><BarChart data={kmData} margin={{top:4,right:8,left:-12,bottom:0}}><CartesianGrid strokeDasharray='3 3' stroke='rgba(255,255,255,0.05)'/><XAxis dataKey='week' tick={{fontFamily:'var(--font-mono)',fontSize:10,fill:'#6b7a96'}}/><YAxis tick={{fontFamily:'var(--font-mono)',fontSize:10,fill:'#6b7a96'}} unit='km'/><Tooltip contentStyle={TT}/>{settings.weeklyKm?.value&&<Bar dataKey='target' fill='rgba(0,230,118,0.12)' radius={[3,3,0,0]} name='Target'/>}<Bar dataKey='km' fill='#00e676' radius={[5,5,0,0]} name='km'/></BarChart></ResponsiveContainer>):<ChartEmpty/>}
            </ChartCard>
            <ChartCard title='WEIGHT TREND' sub='Bodyweight in kilograms'>
              {weightData.length>1?(<ResponsiveContainer width='100%' height={200}><AreaChart data={weightData} margin={{top:4,right:8,left:-12,bottom:0}}><defs><linearGradient id='wGrad' x1='0' y1='0' x2='0' y2='1'><stop offset='5%' stopColor='#40a9ff' stopOpacity={0.25}/><stop offset='95%' stopColor='#40a9ff' stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray='3 3' stroke='rgba(255,255,255,0.05)'/><XAxis dataKey='date' tick={{fontFamily:'var(--font-mono)',fontSize:10,fill:'#6b7a96'}}/><YAxis domain={['dataMin - 1','dataMax + 1']} tick={{fontFamily:'var(--font-mono)',fontSize:10,fill:'#6b7a96'}} unit='kg'/><Tooltip contentStyle={TT}/><Area type='monotone' dataKey='weight' stroke='#40a9ff' strokeWidth={2} fill='url(#wGrad)' dot={false} name='Weight (kg)'/></AreaChart></ResponsiveContainer>):<ChartEmpty/>}
            </ChartCard>
            <ChartCard title='SLEEP & RECOVERY SCORES' sub='Daily scores out of 100'>
              {sleepData.length>0?(<ResponsiveContainer width='100%' height={200}><LineChart data={sleepData} margin={{top:4,right:8,left:-12,bottom:0}}><CartesianGrid strokeDasharray='3 3' stroke='rgba(255,255,255,0.05)'/><XAxis dataKey='date' tick={{fontFamily:'var(--font-mono)',fontSize:10,fill:'#6b7a96'}}/><YAxis domain={[0,100]} tick={{fontFamily:'var(--font-mono)',fontSize:10,fill:'#6b7a96'}}/><Tooltip contentStyle={TT}/><Line type='monotone' dataKey='sleep' stroke='#b388ff' strokeWidth={2} dot={false} name='Sleep'/><Line type='monotone' dataKey='recovery' stroke='#00e676' strokeWidth={2} dot={false} name='Recovery' strokeDasharray='5 3'/><Legend formatter={v=><span style={{fontFamily:'var(--font-mono)',fontSize:10,color:'#6b7a96'}}>{v.toUpperCase()}</span>}/></LineChart></ResponsiveContainer>):<ChartEmpty/>}
            </ChartCard>
            <ChartCard title='HRV & RESTING HEART RATE' sub='Recovery indicators over time'>
              {hrvData.length>0?(<ResponsiveContainer width='100%' height={200}><LineChart data={hrvData} margin={{top:4,right:8,left:-12,bottom:0}}><CartesianGrid strokeDasharray='3 3' stroke='rgba(255,255,255,0.05)'/><XAxis dataKey='date' tick={{fontFamily:'var(--font-mono)',fontSize:10,fill:'#6b7a96'}}/><YAxis tick={{fontFamily:'var(--font-mono)',fontSize:10,fill:'#6b7a96'}}/><Tooltip contentStyle={TT}/><Line type='monotone' dataKey='hrv' stroke='#ff9f40' strokeWidth={2} dot={false} name='HRV'/><Line type='monotone' dataKey='rhr' stroke='#ff6b6b' strokeWidth={2} dot={false} name='Resting HR' strokeDasharray='5 3'/><Legend formatter={v=><span style={{fontFamily:'var(--font-mono)',fontSize:10,color:'#6b7a96'}}>{v.toUpperCase()}</span>}/></LineChart></ResponsiveContainer>):<ChartEmpty/>}
            </ChartCard>
          </div>
          <RecentHistory logs={logs} settings={settings} setView={setView}/>
        </>
      )}
    </div>
  )
}

function ChartCard({title,sub,children}){
  return <div style={{background:'var(--s1)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',padding:'20px 20px 16px'}}><div style={{marginBottom:16}}><div style={{fontFamily:'var(--font-mono)',fontSize:11,fontWeight:600,letterSpacing:'1.5px'}}>{title}</div><div style={{fontSize:11,color:'var(--muted)',marginTop:2}}>{sub}</div></div>{children}</div>
}

// ─── RECENT HISTORY ───────────────────────────────────────────────────────────
function RecentHistory({ logs, settings, setView }) {
  const entries=Object.keys(logs).sort().reverse().slice(0,30)
  if(!entries.length) return null
  const cell=(val,unit='',tKey=null)=>{
    const ts=tKey?targetStatus(val,settings[tKey]):null
    return <td style={{padding:'9px 12px',fontFamily:'var(--font-mono)',fontSize:12,color:ts?ts.color:val?'var(--text)':'var(--muted2)',borderBottom:'1px solid var(--border)',whiteSpace:'nowrap'}}>{val?`${val}${unit}`:'—'}</td>
  }
  return (
    <div style={{background:'var(--s1)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',overflow:'hidden'}}>
      <div style={{padding:'16px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div><div style={{fontFamily:'var(--font-mono)',fontSize:11,fontWeight:600,letterSpacing:'1.5px'}}>RECENT LOG HISTORY</div><div style={{fontSize:11,color:'var(--muted)',marginTop:2}}>Last {entries.length} entries · click any row to edit</div></div>
        <div style={{display:'flex',alignItems:'center',gap:12,fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)'}}>
          {[['#00e676','On target'],['#ff9f40','Within 20%'],['#ff6b6b','Off target']].map(([c,l])=>(
            <span key={l} style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:8,height:8,borderRadius:2,background:c,display:'inline-block'}}/>{l}</span>
          ))}
        </div>
      </div>
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead><tr style={{background:'var(--s2)'}}>{['DATE','KM RUN','WEIGHT','SLEEP','RECOVERY','HRV','RHR','CALORIES','PROTEIN',''].map(h=><th key={h} style={{padding:'8px 12px',fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)',letterSpacing:'1.5px',textAlign:'left',borderBottom:'1px solid var(--border)',whiteSpace:'nowrap'}}>{h}</th>)}</tr></thead>
          <tbody>
            {entries.map(date=>{
              const l=logs[date]; const isToday=date===todayStr()
              return (
                <tr key={date} onClick={()=>setView('log')} style={{background:isToday?'rgba(0,230,118,0.04)':'transparent',cursor:'pointer',transition:'background 0.15s'}} onMouseEnter={e=>e.currentTarget.style.background='var(--s2)'} onMouseLeave={e=>e.currentTarget.style.background=isToday?'rgba(0,230,118,0.04)':'transparent'}>
                  <td style={{padding:'9px 12px',fontFamily:'var(--font-mono)',fontSize:12,color:isToday?'var(--accent)':'var(--text)',borderBottom:'1px solid var(--border)',whiteSpace:'nowrap'}}>{fmtDate(date)}{isToday&&<span style={{marginLeft:6,fontSize:9,color:'var(--accent)'}}>TODAY</span>}</td>
                  {cell(l?.exercise?.running?.distance,'km','weeklyKm')}
                  {cell(l?.body?.weight,'kg','weightTarget')}
                  {cell(l?.sleep?.sleepScore,'/100','sleepScore')}
                  {cell(l?.sleep?.recoveryScore,'/100','recoveryScore')}
                  {cell(l?.body?.hrv,'','hrv')}
                  {cell(l?.body?.rhr,'bpm','rhr')}
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
function LogData({ logs, saveLog, settings, plan }) {
  const [date, setDate] = useState(todayStr())
  const [form, setForm] = useState(mkEmpty())
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  useEffect(()=>{ setForm(logs[date]?JSON.parse(JSON.stringify(logs[date])):mkEmpty()); setSaved(false) },[date,logs])

  const setN=(sec,f,v)=>setForm(p=>({...p,[sec]:{...p[sec],[f]:v}}))
  const setEx=(type,f,v)=>setForm(p=>({...p,exercise:{...p.exercise,[type]:{...p.exercise[type],[f]:v}}}))
  const setFuncEx=(i,f,v)=>setForm(p=>{ const exs=[...p.exercise.functional.exercises]; exs[i]={...exs[i],[f]:v}; return {...p,exercise:{...p.exercise,functional:{...p.exercise.functional,exercises:exs}}} })
  const addFuncEx=()=>setForm(p=>({...p,exercise:{...p.exercise,functional:{...p.exercise.functional,exercises:[...p.exercise.functional.exercises,{exercise:'',reps:''}]}}}))
  const removeFuncEx=i=>setForm(p=>({...p,exercise:{...p.exercise,functional:{...p.exercise.functional,exercises:p.exercise.functional.exercises.filter((_,idx)=>idx!==i)}}}))
  const toggleGym=t=>setForm(p=>{ const types=p.exercise.gym.types.includes(t)?p.exercise.gym.types.filter(x=>x!==t):[...p.exercise.gym.types,t]; return {...p,exercise:{...p.exercise,gym:{...p.exercise.gym,types}}} })
  const handleSave=async()=>{ setSaving(true); await saveLog(date,form); setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),3000) }

  const isExisting=!!logs[date]
  const planDayName=getDayName(date)
  const planDay=plan?.find(d=>d.day===planDayName)
  const ts=(val,key)=>targetStatus(val,settings[key])

  return (
    <div style={{padding:'24px 28px',maxWidth:960,margin:'0 auto'}} className='fade'>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
        <div>
          <h1 style={{fontFamily:'var(--font-head)',fontSize:36,letterSpacing:2,lineHeight:1}}>{isExisting?'EDIT':'LOG'} <span style={{color:'var(--accent)'}}>DAILY DATA</span></h1>
          <p style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--muted)',marginTop:5,letterSpacing:1}}>{isExisting?'Updating entry':'New entry'} · {fmtDate(date)} · {planDayName.toUpperCase()}</p>
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

      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <LogSection title='BODY DATA' accent='var(--accent)'>
          <Row cols={3}>
            <FF label='RESTING HEART RATE (bpm)' ts={ts(form.body.rhr,'rhr')}><input type='number' placeholder='52' value={form.body.rhr} onChange={e=>setN('body','rhr',e.target.value)}/></FF>
            <FF label='HRV' ts={ts(form.body.hrv,'hrv')}><input type='number' placeholder='78' value={form.body.hrv} onChange={e=>setN('body','hrv',e.target.value)}/></FF>
            <FF label='WEIGHT (kg)' ts={ts(form.body.weight,'weightTarget')}><input type='number' placeholder='75.5' step='0.1' value={form.body.weight} onChange={e=>setN('body','weight',e.target.value)}/></FF>
          </Row>
        </LogSection>
        <LogSection title='SLEEP' accent='var(--purple)'>
          <Row cols={4}>
            <FF label='SLEEP SCORE (0–100)' ts={ts(form.sleep.sleepScore,'sleepScore')}><input type='number' min='0' max='100' placeholder='85' value={form.sleep.sleepScore} onChange={e=>setN('sleep','sleepScore',e.target.value)}/></FF>
            <FF label='RECOVERY SCORE (0–100)' ts={ts(form.sleep.recoveryScore,'recoveryScore')}><input type='number' min='0' max='100' placeholder='80' value={form.sleep.recoveryScore} onChange={e=>setN('sleep','recoveryScore',e.target.value)}/></FF>
            <FF label='HOURS SLEPT' ts={ts(form.sleep.hoursSlept,'hoursSlept')}><input type='number' placeholder='7.5' step='0.25' value={form.sleep.hoursSlept} onChange={e=>setN('sleep','hoursSlept',e.target.value)}/></FF>
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
        <LogSection title='EXERCISE' accent='var(--blue)'>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            <ExBlock checked={form.exercise.running.on} toggle={()=>setEx('running','on',!form.exercise.running.on)} label='RUNNING' accent='var(--accent)'>
              <Row cols={3}>
                <FF label='DISTANCE (km)'><input type='number' placeholder='15.0' step='0.1' value={form.exercise.running.distance} onChange={e=>setEx('running','distance',e.target.value)}/></FF>
                <FF label='DURATION (h:mm)'><input type='text' placeholder='1:45' value={form.exercise.running.duration} onChange={e=>setEx('running','duration',e.target.value)}/></FF>
                <FF label='NOTES / ZONE'><input type='text' placeholder='Zone 2 · 150–160bpm' value={form.exercise.running.notes} onChange={e=>setEx('running','notes',e.target.value)}/></FF>
              </Row>
            </ExBlock>
            <ExBlock checked={form.exercise.functional.on} toggle={()=>setEx('functional','on',!form.exercise.functional.on)} label='FUNCTIONAL TRAINING' accent='var(--orange)'>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 100px 32px',gap:8,marginBottom:2}}>
                  <span style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)',letterSpacing:1}}>EXERCISE</span>
                  <span style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)',letterSpacing:1}}>REPS</span><span/>
                </div>
                {form.exercise.functional.exercises.map((ex,i)=>(
                  <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 100px 32px',gap:8}}>
                    <input type='text' placeholder='Exercise' value={ex.exercise} onChange={e=>setFuncEx(i,'exercise',e.target.value)}/>
                    <input type='number' placeholder='0' value={ex.reps} onChange={e=>setFuncEx(i,'reps',e.target.value)}/>
                    <button onClick={()=>removeFuncEx(i)} style={{background:'var(--s4)',border:'1px solid var(--border)',borderRadius:7,color:'var(--muted)',cursor:'pointer',fontSize:14}}>×</button>
                  </div>
                ))}
                <button onClick={addFuncEx} style={{background:'none',border:'1px dashed var(--border2)',borderRadius:7,color:'var(--muted)',fontFamily:'var(--font-mono)',fontSize:11,padding:'9px',cursor:'pointer'}}>+ ADD EXERCISE</button>
              </div>
            </ExBlock>
            <ExBlock checked={form.exercise.gym.on} toggle={()=>setEx('gym','on',!form.exercise.gym.on)} label='GYM' accent='var(--purple)'>
              <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                {GYM_OPTIONS.map(opt=>{ const sel=form.exercise.gym.types.includes(opt); return (<button key={opt} onClick={()=>toggleGym(opt)} style={{background:sel?'var(--purple)':'var(--s4)',color:sel?'#0d1018':'var(--muted)',border:`1px solid ${sel?'var(--purple)':'var(--border2)'}`,borderRadius:7,padding:'8px 16px',fontFamily:'var(--font-mono)',fontSize:11,fontWeight:sel?600:400,cursor:'pointer',transition:'all 0.15s'}}>{opt}</button>) })}
              </div>
            </ExBlock>
            <ExBlock checked={form.exercise.yoga.on} toggle={()=>setEx('yoga','on',!form.exercise.yoga.on)} label='YOGA' accent='var(--blue)'>
              <div style={{maxWidth:200}}><FF label='DURATION (mins)'><input type='number' placeholder='30' value={form.exercise.yoga.duration} onChange={e=>setEx('yoga','duration',e.target.value)}/></FF></div>
            </ExBlock>
          </div>
        </LogSection>
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
          {[{l:'RUNNING TARGET',v:'~100km',c:'var(--accent)'},{l:'FUNCTIONAL SESSIONS',v:'6 days',c:'var(--orange)'},{l:'GYM SESSIONS',v:'6 types',c:'var(--purple)'},{l:'YOGA SESSIONS',v:'6 days',c:'var(--blue)'}].map(({l,v,c})=>(
            <div key={l} style={{background:'var(--s1)',border:'1px solid var(--border)',borderRadius:'var(--r)',padding:'16px 20px'}}>
              <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)',letterSpacing:'1.5px',marginBottom:6}}>{l}</div>
              <div style={{fontFamily:'var(--font-head)',fontSize:28,color:c}}>{v}</div>
            </div>
          ))}
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
function SettingsPage({ settings, saveSettings }) {
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
          <span style={{color:'#ff9f40',fontFamily:'var(--font-mono)',fontSize:11,marginLeft:6}}>■ Amber</span> = within 20% ·
          <span style={{color:'#ff6b6b',fontFamily:'var(--font-mono)',fontSize:11,marginLeft:6}}>■ Red</span> = off target.
        </div>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
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
    </div>
  )
}

// ─── TV MODE ──────────────────────────────────────────────────────────────────
function TVMode({ logs, settings, plan, setView }) {
  const [,setTick]=useState(0)
  useEffect(()=>{ const id=setInterval(()=>setTick(t=>t+1),30000); return()=>clearInterval(id) },[])
  const today=todayStr(), tl=logs[today], now=new Date()
  const planDayIndex=now.getDay()===0?6:now.getDay()-1
  const todayPlan=plan?.[planDayIndex]
  const last14=Array.from({length:14},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(13-i)); return d.toISOString().split('T')[0] })
  const wkKm=last14.reduce((s,d)=>s+(parseFloat(logs[d]?.exercise?.running?.distance)||0),0)
  let streak=0; for(let i=0;i<365;i++){ const d=new Date(); d.setDate(d.getDate()-i); if(logs[d.toISOString().split('T')[0]]) streak++; else break }
  const tvStats=[
    {label:'WEIGHT',    v:tl?.body?.weight,        unit:'kg',   color:'#00e676',tKey:'weightTarget'},
    {label:'HRV',       v:tl?.body?.hrv,            unit:'',     color:'#40a9ff',tKey:'hrv'},
    {label:'RESTING HR',v:tl?.body?.rhr,            unit:'bpm',  color:'#ff9f40',tKey:'rhr'},
    {label:'SLEEP',     v:tl?.sleep?.sleepScore,    unit:'/100', color:'#b388ff',tKey:'sleepScore'},
    {label:'RECOVERY',  v:tl?.sleep?.recoveryScore, unit:'/100', color:'#00e676',tKey:'recoveryScore'},
    {label:'HRS SLEPT', v:tl?.sleep?.hoursSlept,    unit:'h',    color:'#40a9ff',tKey:'hoursSlept'},
  ].map(s=>({...s,ts:targetStatus(s.v,settings[s.tKey])}))

  return (
    <div style={{minHeight:'calc(100vh - 60px)',background:'var(--bg)',padding:'28px 36px',display:'flex',flexDirection:'column',gap:18}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div><div style={{fontFamily:'var(--font-head)',fontSize:48,letterSpacing:3,lineHeight:1}}><span style={{color:'var(--accent)'}}>WG</span> HUB</div><div style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--muted)',marginTop:4}}>PERFORMANCE DASHBOARD · AUTO-REFRESHES EVERY 30s</div></div>
        <div style={{textAlign:'right'}}><div style={{fontFamily:'var(--font-head)',fontSize:52,color:'var(--accent)',lineHeight:1}}>{now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div><div style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--muted)',marginTop:4}}>{now.toLocaleDateString('en-US',{weekday:'long'}).toUpperCase()} · {now.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}).toUpperCase()}</div></div>
        <button onClick={()=>setView('dashboard')} style={{background:'var(--s2)',border:'1px solid var(--border2)',borderRadius:8,color:'var(--muted)',fontFamily:'var(--font-mono)',fontSize:11,padding:'8px 18px',cursor:'pointer',letterSpacing:1}}>← EXIT TV</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:12}}>
        {tvStats.map(({label,v,unit,color,ts})=>(
          <div key={label} style={{background:'var(--s1)',border:`1px solid ${ts?ts.color+'44':'var(--border)'}`,borderRadius:'var(--r-lg)',padding:'22px 16px',textAlign:'center',position:'relative',overflow:'hidden'}}>
            {ts&&<div style={{position:'absolute',bottom:0,left:0,right:0,height:4,background:'var(--s3)'}}><div style={{height:'100%',width:`${ts.pct}%`,background:ts.color,borderRadius:2}}/></div>}
            <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)',letterSpacing:'1.5px',marginBottom:10}}>{label}</div>
            <div style={{fontFamily:'var(--font-head)',fontSize:44,color:ts?ts.color:(v?color:'var(--muted2)'),lineHeight:1}}>{v||'—'}</div>
            <div style={{fontFamily:'var(--font-mono)',fontSize:12,color:ts?ts.color:color,opacity:0.6,marginTop:4}}>{v?unit:''}</div>
            {ts&&<div style={{fontFamily:'var(--font-mono)',fontSize:9,color:ts.color,marginTop:6}}>{ts.status}</div>}
          </div>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 2fr',gap:14}}>
        <div style={{background:'var(--s1)',border:`1px solid ${streak>0?'rgba(0,230,118,0.35)':'var(--border)'}`,borderRadius:'var(--r-lg)',padding:'22px 24px'}}>
          <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)',letterSpacing:'1.5px',marginBottom:8}}>LOGGING STREAK</div>
          <div style={{fontFamily:'var(--font-head)',fontSize:72,color:streak>0?'var(--accent)':'var(--muted)',lineHeight:1}}>{streak}</div>
          <div style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--muted)',marginTop:6}}>consecutive days</div>
        </div>
        <div style={{background:'var(--s1)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',padding:'22px 24px'}}>
          <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)',letterSpacing:'1.5px',marginBottom:8}}>KM LAST 14 DAYS</div>
          <div style={{fontFamily:'var(--font-head)',fontSize:72,color:'var(--blue)',lineHeight:1}}>{wkKm.toFixed(1)}</div>
          <div style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--muted)',marginTop:6}}>kilometres run</div>
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
      {(tl?.nutrition?.calories||tl?.nutrition?.protein)&&(
        <div style={{background:'var(--s1)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',padding:'18px 24px'}}>
          <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)',letterSpacing:'1.5px',marginBottom:14}}>TODAY'S NUTRITION</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20}}>
            {[{label:'PROTEIN',val:tl?.nutrition?.protein,unit:'g',color:'#40a9ff',tKey:'dailyProtein'},{label:'CARBS',val:tl?.nutrition?.carbs,unit:'g',color:'#ff9f40',tKey:'dailyCarbs'},{label:'CALORIES',val:tl?.nutrition?.calories,unit:'kcal',color:'#00e676',tKey:'dailyCalories'}].map(({label,val,unit,color,tKey})=>{
              const ts2=targetStatus(val,settings[tKey])
              return (<div key={label}><div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:6}}><span style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--muted)',letterSpacing:1,minWidth:70}}>{label}</span><span style={{fontFamily:'var(--font-head)',fontSize:36,color:ts2?ts2.color:color}}>{val||'—'}{val&&<span style={{fontFamily:'var(--font-mono)',fontSize:12,opacity:0.6}}>{unit}</span>}</span></div>{settings[tKey]?.value&&val&&(<div style={{height:5,background:'var(--s3)',borderRadius:3,overflow:'hidden'}}><div style={{height:'100%',width:`${ts2?.pct||0}%`,background:ts2?ts2.color:color,borderRadius:3}}/></div>)}</div>)
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── MICRO COMPONENTS ─────────────────────────────────────────────────────────
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
