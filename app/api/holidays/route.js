// GET /api/holidays
// UK public holidays for the "england-and-wales" division, from the official
// gov.uk feed. Cached in the Next data cache (7-day revalidate — bank holidays
// change rarely) and by the browser. Read-only; not stored in the DB, so an
// upstream substitute-day change just appears. Degrades to an empty list if the
// feed is unreachable — the calendar renders without holidays, never crashes.
const FEED_URL = 'https://www.gov.uk/bank-holidays.json'

export async function GET() {
  try {
    const res = await fetch(FEED_URL, { next: { revalidate: 604800 } })
    if (!res.ok) throw new Error(`gov.uk feed ${res.status}`)
    const data = await res.json()
    const events = (data['england-and-wales']?.events || []).map(e => ({
      date:  e.date,
      title: e.title,
      notes: e.notes || '',
    }))
    return Response.json({ events }, {
      headers: { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' },
    })
  } catch {
    // Static message only — never surface fetch internals.
    console.error('holidays feed unavailable')
    return Response.json({ events: [] })
  }
}
