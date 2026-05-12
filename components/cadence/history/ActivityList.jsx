'use client'

import {
  fmtWeekTitle,
  weekTotals,
  monthTotals,
  effectiveName,
  typeBucket,
  canonicalType,
  activitySource,
  fmtRowDate,
  fmtDuration,
  fmtPace,
  strengthMetric,
} from './historyHelpers'

const CANONICAL_LABEL = {
  run: 'Running', strength: 'Strength', functional: 'Functional',
  yoga: 'Yoga', bike: 'Cycling', swim: 'Swimming', other: 'Activity',
}

const CANONICAL_PIP = {
  run: 'run', bike: 'run', swim: 'run',
  strength: 'strength', functional: 'strength',
  yoga: 'recovery', other: 'recovery',
}

const SOURCE_LABEL = { strava: 'Strava', whoop: 'Whoop', manual: 'Manual' }

function Chevron() {
  return (
    <div className="chevron">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </div>
  )
}

function ActivityRow({ activity, isPB }) {
  const bucket = typeBucket(activity)
  const canonical = canonicalType(activity)
  const source = activitySource(activity)
  const isLongRun = canonical === 'run' && (activity?.data?.distance || 0) >= 18000

  const pipBase = CANONICAL_PIP[canonical] || 'recovery'
  const pipClass = pipBase === 'run' && isLongRun ? 'long' : pipBase
  const subText = CANONICAL_LABEL[canonical] || 'Activity'

  const dist = activity?.data?.distance
  const time = activity?.data?.moving_time
  const hr   = activity?.data?.average_heartrate

  const distNode = bucket === 'run' && dist
    ? <><span>{(dist / 1000).toFixed(1)}</span><span className="unit">km</span></>
    : null
  const durNode = time ? <><span>{fmtDuration(time)}</span><span className="unit">duration</span></> : null
  const hrNode = hr ? <><span>{Math.round(hr)}</span><span className="unit">bpm avg</span></> : null

  let paceNode = null
  if (bucket === 'run' && dist && time) {
    paceNode = <><span>{fmtPace(dist, time)}</span><span className="unit">/km</span></>
  } else if (bucket === 'strength') {
    const sm = strengthMetric(activity)
    if (sm) paceNode = <><span>{sm.value}</span><span className="unit">{sm.unit}</span></>
  }

  const { num, dow, mon } = fmtRowDate(activity.start_date)

  return (
    <div className="activity-row" data-type={bucket} data-source={source}>
      <div className="date">
        <span className="num">{num}</span>{dow} {mon}
      </div>
      <div className="title-cell">
        <span className={`pip ${pipClass}`} />
        <div className="name-wrap">
          <div className="name">
            {effectiveName(activity)}
            {isPB ? <span className="pb">New PB</span> : null}
          </div>
          <div className="sub">{subText}</div>
        </div>
      </div>
      <div className={`metric${distNode ? '' : ' muted'}`}>{distNode || '—'}</div>
      <div className={`metric${durNode ? '' : ' muted'}`}>{durNode || '—'}</div>
      <div className={`metric hr-cell${hrNode ? '' : ' muted'}`}>{hrNode || '—'}</div>
      <div className={`metric pace${paceNode ? '' : ' muted'}`}>{paceNode || '—'}</div>
      <div className={`source-pill ${source}`}>{SOURCE_LABEL[source] || source}</div>
      <Chevron />
    </div>
  )
}

function WeekSection({ weekGroup, pbIds }) {
  const t = weekTotals(weekGroup.activities)
  return (
    <section className="week">
      <div className="week-head">
        <span className="title">{fmtWeekTitle(weekGroup.weekStart)}</span>
        <span className="totals">
          <span>{t.sessions} session{t.sessions === 1 ? '' : 's'}</span>
          <span className="sep" />
          <span className="km">{t.km.toFixed(1)} km</span>
          <span className="sep" />
          <span>{t.hours} hours</span>
        </span>
      </div>
      <div className="activity-list">
        {weekGroup.activities.map(a => (
          <ActivityRow key={a.id} activity={a} isPB={pbIds.has(a.id)} />
        ))}
      </div>
    </section>
  )
}

function MonthDivider({ monthGroup, pbIds }) {
  const flat = monthGroup.weeks.flatMap(w => w.activities)
  const t = monthTotals(flat, pbIds)
  return (
    <div className="month-divider">
      <span className="name">{monthGroup.name}</span>
      <span className="totals">
        <span>{t.sessions} session{t.sessions === 1 ? '' : 's'}</span>
        <span className="sep" />
        <span className="km">{t.km.toFixed(1)} km</span>
        <span className="sep" />
        <span>{t.hours} hours</span>
        {t.pbCount > 0 ? (
          <>
            <span className="sep" />
            <span>{t.pbCount} PB</span>
          </>
        ) : null}
      </span>
    </div>
  )
}

function YearBanner({ yearGroup }) {
  return (
    <div className="year-banner">
      <span className="num">{yearGroup.year}</span>
      <span className="line" />
      <span className="scope">{yearGroup.scope}</span>
    </div>
  )
}

function ArchiveStub({ archiveCount, archiveYear, archiveFromLabel }) {
  if (archiveCount <= 0) return null
  return (
    <div className="archive-stub">
      <div className="year">{archiveYear ? `${archiveYear} ↓` : '↓'}</div>
      <div className="text">
        {archiveCount} earlier session{archiveCount === 1 ? '' : 's'} in the archive
        {archiveFromLabel ? ` — ${archiveFromLabel} onward.` : '.'}
      </div>
      <div className="meta">Use search or narrow the date range to find a specific session</div>
    </div>
  )
}

export default function ActivityList({ years, pbIds, archive, moreWeeksAvailable, onLoadMore }) {
  // Flat children so the mockup's :first-of-type margin reset on
  // year-banner / month-divider behaves as expected. Wrapping each
  // group in a div would make every banner :first-of-type within its
  // own wrapper, collapsing the inter-group spacing.
  const nodes = []
  years.forEach(yg => {
    nodes.push(<YearBanner key={`y-${yg.key}`} yearGroup={yg} />)
    yg.months.forEach(mg => {
      nodes.push(<MonthDivider key={`m-${mg.key}`} monthGroup={mg} pbIds={pbIds} />)
      mg.weeks.forEach(wg => {
        nodes.push(<WeekSection key={`w-${wg.key}`} weekGroup={wg} pbIds={pbIds} />)
      })
    })
  })

  return (
    <>
      {nodes}

      <ArchiveStub
        archiveCount={archive.count}
        archiveYear={archive.year}
        archiveFromLabel={archive.fromLabel}
      />

      <button
        type="button"
        className="load-more r r-8"
        disabled={!moreWeeksAvailable}
        onClick={onLoadMore}
      >
        {moreWeeksAvailable ? 'Load earlier weeks' : "You've reached the start of this view"}
      </button>
    </>
  )
}
