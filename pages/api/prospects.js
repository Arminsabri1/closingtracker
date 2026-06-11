// GET /api/prospects
// Returns:
//   prospects: [{ closer, appointmentDate, status }]
//   closers:   ['Tyler', 'Jeshua', ...]   (unique closer names found)
//   fetched_at: ISO timestamp
//
// Source: "Prospect" table in the Inbound Home Service PPL base.
// Closer (singleSelect), Status (singleSelect), Appointment Date (dateTime).

const BASE_ID = 'appG9APSCkeYOQLbl';
const TABLE_ID = 'tblxy8uy1rn7YySk7'; // Prospect

// Field IDs (locked, won't change even if columns renamed)
const F = {
  closer: 'fldRsOqpZHKrQ9evO',
  status: 'fldrEbJgggOdlQTCd',
  appointmentDate: 'fld8LGO8SxiQdCCMi',
};

async function fetchAll(apiKey) {
  const all = [];
  let offset = null;
  do {
    const params = new URLSearchParams({
      pageSize: '100',
      'fields[]': F.closer,
    });
    params.append('fields[]', F.status);
    params.append('fields[]', F.appointmentDate);
    if (offset) params.set('offset', offset);
    const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?${params.toString()}`;
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    });
    if (!r.ok) {
      const text = await r.text();
      throw new Error('Airtable ' + r.status + ': ' + text);
    }
    const json = await r.json();
    all.push(...(json.records || []));
    offset = json.offset || null;
  } while (offset);
  return all;
}

export default async function handler(req, res) {
  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'AIRTABLE_API_KEY not set in environment' });
  }

  try {
    const records = await fetchAll(apiKey);

    const closerSet = new Set();
    const prospects = [];

    for (const rec of records) {
      const f = rec.fields || {};
      const closerRaw = f[F.closer];
      const statusRaw = f[F.status];
      const apptRaw = f[F.appointmentDate];

      // Airtable returns singleSelect as either an object {id,name,color} or just a string
      const closer = typeof closerRaw === 'string'
        ? closerRaw
        : (closerRaw && closerRaw.name) || null;
      const status = typeof statusRaw === 'string'
        ? statusRaw
        : (statusRaw && statusRaw.name) || null;

      // Skip records missing closer or appointment date — can't attribute them
      if (!closer || !apptRaw) continue;

      closerSet.add(closer);

      prospects.push({
        id: rec.id,
        closer,
        status: status || null,
        appointmentDate: apptRaw, // ISO datetime string
      });
    }

    const closers = Array.from(closerSet).sort();

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({
      prospects,
      closers,
      fetched_at: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Fetch error', message: String(err) });
  }
}
