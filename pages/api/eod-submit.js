// POST /api/eod-submit
// Body: { closer, date, energy, focus, biology, callsAttempted, calls, offers, closes, rollup, objections }
// Upserts on (closer, date) — replaces existing record for that pair.

const BASE_ID = 'appG9APSCkeYOQLbl';
const TABLE_ID = 'tblZfN07lZJ6pG6sk'; // Closer EOD

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'AIRTABLE_API_KEY not set in environment' });
  }

  const {
    closer, date,
    energy, focus, biology,
    callsAttempted, calls, offers, closes,
    rollup, objections,
  } = req.body || {};

  if (!closer || !date) {
    return res.status(400).json({ error: 'closer and date are required' });
  }

  const fields = {
    'Closer': closer,
    'Date': date,
    'Energy': energy ?? null,
    'Focus': focus ?? null,
    'Protected Biology': biology === true,
    'Calls Attempted': Number(callsAttempted) || 0,
    'Calls Connected': Number(calls) || 0,
    'Offers Given': Number(offers) || 0,
    'Closes': Number(closes) || 0,
    'Daily Rollup': rollup ?? '',
    'Common Objections': objections ?? '',
    'Submitted At': new Date().toISOString(),
  };

  try {
    // Look for an existing record for this (closer, date)
    const escDate = encodeURIComponent(date);
    const escCloser = encodeURIComponent(closer.replace(/"/g, '\\"'));
    const filter = encodeURIComponent(`AND({Closer}="${closer.replace(/"/g, '\\"')}", IS_SAME({Date},"${date}",'day'))`);
    const findUrl = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?filterByFormula=${filter}&maxRecords=1`;
    const findR = await fetch(findUrl, { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' });
    if (!findR.ok) {
      const t = await findR.text();
      return res.status(findR.status).json({ error: 'Lookup failed', body: t });
    }
    const findJson = await findR.json();
    const existing = (findJson.records || [])[0];

    let writeR;
    if (existing) {
      writeR = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${existing.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields, typecast: true }),
      });
    } else {
      writeR = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields, typecast: true }),
      });
    }
    if (!writeR.ok) {
      const t = await writeR.text();
      return res.status(writeR.status).json({ error: 'Write failed', body: t });
    }
    const writeJson = await writeR.json();
    return res.status(200).json({ ok: true, replaced: !!existing, record: writeJson });
  } catch (err) {
    return res.status(500).json({ error: 'Submit error', message: String(err) });
  }
}
