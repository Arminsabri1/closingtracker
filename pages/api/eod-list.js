// GET /api/eod-list — returns all EOD submissions, newest first.
// Reads from the "Closer EOD" table in the Inbound Home Service PPL base.

const BASE_ID = 'appG9APSCkeYOQLbl';
const TABLE_ID = 'tblZfN07lZJ6pG6sk'; // Closer EOD

export default async function handler(req, res) {
  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'AIRTABLE_API_KEY not set in environment' });
  }

  const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?pageSize=100&sort%5B0%5D%5Bfield%5D=Date&sort%5B0%5D%5Bdirection%5D=desc`;

  try {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    });
    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: 'Airtable request failed', body: text });
    }
    const json = await r.json();
    const entries = (json.records || []).map((rec) => {
      const f = rec.fields || {};
      return {
        id: rec.id,
        closer: f['Closer'] ?? null,
        date: f['Date'] ?? null,
        energy: f['Energy'] ?? null,
        focus: f['Focus'] ?? null,
        biology: f['Protected Biology'] === true,
        callsAttempted: Number(f['Calls Attempted']) || 0,
        calls: Number(f['Calls Connected']) || 0,
        offers: Number(f['Offers Given']) || 0,
        closes: Number(f['Closes']) || 0,
        closeRate: f['Close Rate'] != null ? Number(f['Close Rate']) : null,
        rollup: f['Daily Rollup'] ?? '',
        objections: f['Common Objections'] ?? '',
        submittedAt: f['Submitted At'] ?? null,
      };
    });
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
    return res.status(200).json({ entries, fetched_at: new Date().toISOString() });
  } catch (err) {
    return res.status(500).json({ error: 'Fetch error', message: String(err) });
  }
}
