// GET /api/prospects
// Returns: { prospects, closers, fetched_at }
// Closers list is the UNION of:
//   1. all singleSelect choices on the Prospect "Closer" field (via schema API), AND
//   2. any closer names found on actual records
// This way a newly-added dropdown option appears even before any prospect is assigned to them.
// Append ?debug=1 to see diagnostic info.

const BASE_ID = 'appG9APSCkeYOQLbl';
const TABLE_ID = 'tblxy8uy1rn7YySk7'; // Prospect

const F = {
  closer: 'fldRsOqpZHKrQ9evO',
  status: 'fldrEbJgggOdlQTCd',
  appointmentDate: 'fld8LGO8SxiQdCCMi',
};

async function fetchAll(apiKey) {
  const all = [];
  let offset = null;
  do {
    const params = new URLSearchParams({ pageSize: '100' });
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

// Fetch the Closer singleSelect choices from the table schema.
// Returns [] silently if the PAT lacks schema.bases:read — caller falls back to record-derived closers.
async function fetchCloserChoicesFromSchema(apiKey) {
  try {
    const r = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    });
    if (!r.ok) return { choices: [], error: `schema ${r.status}` };
    const json = await r.json();
    const table = (json.tables || []).find(t => t.id === TABLE_ID);
    if (!table) return { choices: [], error: 'prospect table not found in schema' };
    const field = (table.fields || []).find(f => f.id === F.closer);
    if (!field || !field.options || !field.options.choices) {
      return { choices: [], error: 'closer field has no choices' };
    }
    return { choices: field.options.choices.map(c => c.name).filter(Boolean), error: null };
  } catch (e) {
    return { choices: [], error: String(e) };
  }
}

function pickValue(f, ...keys) {
  for (const k of keys) {
    if (f[k] !== undefined && f[k] !== null) return f[k];
  }
  return null;
}

function selectName(v) {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v.name) return v.name;
  return null;
}

export default async function handler(req, res) {
  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'AIRTABLE_API_KEY not set in environment' });
  }

  try {
    const [records, schemaResult] = await Promise.all([
      fetchAll(apiKey),
      fetchCloserChoicesFromSchema(apiKey),
    ]);

    const closerSet = new Set();
    const prospects = [];

    for (const rec of records) {
      const f = rec.fields || {};
      const closerRaw = pickValue(f, 'Closer', F.closer);
      const statusRaw = pickValue(f, 'Status', F.status);
      const apptRaw = pickValue(f, 'Appointment Date', F.appointmentDate);

      const closer = selectName(closerRaw);
      const status = selectName(statusRaw);

      if (!closer || !apptRaw) continue;

      closerSet.add(closer);

      prospects.push({
        id: rec.id,
        closer,
        status: status || null,
        appointmentDate: apptRaw,
      });
    }

    // Union schema-defined closer choices into the closers list
    for (const name of schemaResult.choices) {
      closerSet.add(name);
    }

    const closers = Array.from(closerSet).sort();

    if (req.query && req.query.debug === '1') {
      return res.status(200).json({
        total_records_from_airtable: records.length,
        prospects_extracted: prospects.length,
        closers,
        closers_from_schema: schemaResult.choices,
        schema_fetch_error: schemaResult.error,
        sample_record: records[0] || null,
        fetched_at: new Date().toISOString(),
      });
    }

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
