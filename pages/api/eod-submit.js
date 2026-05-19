// POST /api/eod-submit
// Body: { closer, date, energy, focus, biology, calls, offers, closes, rollup, objections }
// Creates or replaces a Closer EOD record for the given (closer, date) pair.

const BASE_ID = 'appG9APSCkeYOQLbl';
const TABLE_ID = 'tblZfN07lZJ6pG6sk';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'AIRTABLE_API_KEY not set in environment' });
  }

  const body = req.body || {};
  const { closer, date } = body;
  if (!closer || !date) {
    return res.status(400).json({ error: 'closer and date are required' });
  }

  const fields = {
    'Closer': closer,
    'Date': date,
    'Energy': body.energy != null ? Number(body.energy) : null,
    'Focus': body.focus != null ? Number(body.focus) : null,
    'Protected Biology': body.biology === true || body.biology === 'Yes',
    'Calls Connected': Number(body.calls) || 0,
    'Offers Given': Number(body.offers) || 0,
    'Closes': Number(body.closes) || 0,
    'Daily Rollup': body.rollup || '',
    'Common Objections': body.objections || '',
    'Submitted At': new Date().toISOString(),
  };

  try {
    // Look for an existing record matching (closer, date)
    const filterFormula = encodeURIComponent(`AND({Closer}='${closer.replace(/'/g, "\\'")}', DATESTR({Date})='${date}')`);
    const lookupUrl = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?filterByFormula=${filterFormula}&maxRecords=1`;
    const lookup = await fetch(lookupUrl, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!lookup.ok) {
      const text = await lookup.text();
      return res.status(lookup.status).json({ error: 'Airtable lookup failed', body: text });
    }
    const lookupJson = await lookup.json();
    const existing = (lookupJson.records || [])[0];

    let saveRes;
    if (existing) {
      saveRes = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${existing.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fields }),
      });
    } else {
      saveRes = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fields }),
      });
    }
    if (!saveRes.ok) {
      const text = await saveRes.text();
      return res.status(saveRes.status).json({ error: 'Airtable save failed', body: text });
    }
    const saved = await saveRes.json();
    return res.status(200).json({ ok: true, record: saved, replaced: !!existing });
  } catch (err) {
    return res.status(500).json({ error: 'Submit error', message: String(err) });
  }
}
