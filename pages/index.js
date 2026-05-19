import React, { useState, useEffect, useMemo, useCallback } from 'react';

const CLOSERS = ['Ahmed'];

// ─── helpers ──────────────────────────────────────────────────────────
const todayISO = () => {
  const d = new Date();
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${dy}`;
};
const fmt$ = (n) => '$' + Math.round(n ?? 0).toLocaleString();
const fmtPct = (n) => n.toFixed(0) + '%';
const fmtPct1 = (n) => n.toFixed(1) + '%';

const dateInWindow = (iso, preset) => {
  if (!iso) return false;
  const d = new Date(iso + 'T12:00:00');
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = (today - d) / 86400000;
  if (preset === 'Today') return diff < 1;
  if (preset === 'Yesterday') return diff >= 1 && diff < 2;
  if (preset === 'Last 7 days') return diff < 7;
  if (preset === 'Last 14 days') return diff < 14;
  if (preset === 'Last 30 days') return diff < 30;
  if (preset === 'Month to date') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  return true;
};

// ─── component ────────────────────────────────────────────────────────
export default function CloserTracker() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/eod-list')
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error + (data.body ? ': ' + data.body : ''));
        } else {
          setEntries(data.entries || []);
          setFetchedAt(data.fetched_at);
        }
        setLoading(false);
      })
      .catch(err => { setError(String(err)); setLoading(false); });
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f4f1ec',
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
      color: '#1f1b16',
      padding: '36px 28px 64px',
      WebkitFontSmoothing: 'antialiased',
      lineHeight: 1.5,
    }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>

        <header style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', color: '#8a7d6b', textTransform: 'uppercase', marginBottom: 6 }}>
              SmartLeadz · Closer Performance
            </div>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em' }}>Closer Dashboard</h1>
            <div style={{ fontSize: 12, color: '#8a7d6b', marginTop: 4 }}>
              {loading ? 'Loading…' : fetchedAt ? `Live from Airtable · synced ${new Date(fetchedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : 'Live from Airtable'}
            </div>
          </div>
          <button onClick={refresh} style={{
            fontSize: 12, padding: '8px 14px', background: 'transparent', color: '#1f1b16',
            border: '1px solid #d3cfc5', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
          }}>Refresh</button>
        </header>

        <Tabs activeTab={activeTab} setActiveTab={setActiveTab} />

        {error && (
          <div style={{ padding: 14, marginBottom: 16, background: '#f6e6e2', border: '1px solid #e8c8be', borderRadius: 12, fontSize: 12.5 }}>
            <div style={{ color: '#9a3924', fontWeight: 500 }}>Couldn't load data</div>
            <div style={{ color: '#5e5345', marginTop: 4 }}>{error}</div>
          </div>
        )}

        {activeTab === 'dashboard' && <Dashboard entries={entries} loading={loading} />}
        {activeTab === 'leaderboard' && <Leaderboard entries={entries} />}
        {activeTab === 'eod' && <EodForm entries={entries} onSubmitted={refresh} />}

        <div style={{ fontSize: 11.5, color: '#a99c87', textAlign: 'center', marginTop: 28, lineHeight: 1.7 }}>
          EOD submissions write to Closer EOD table in Airtable. Pipeline + commissions hookup coming next.
        </div>

      </div>
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────
function Tabs({ activeTab, setActiveTab }) {
  const tabs = [
    { id: 'dashboard',  label: 'Dashboard' },
    { id: 'leaderboard',label: 'Leaderboard' },
    { id: 'eod',        label: 'EOD Report' },
  ];
  return (
    <div style={{
      display: 'flex', gap: 4, marginBottom: 18, padding: 4,
      background: '#ece8df', borderRadius: 11, width: 'fit-content',
    }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
          padding: '9px 18px', border: 'none',
          background: activeTab === t.id ? 'white' : 'transparent',
          color: activeTab === t.id ? '#1f1b16' : '#5e5345',
          fontSize: 13, fontWeight: 500,
          borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
          boxShadow: activeTab === t.id ? '0 1px 3px rgba(0,0,0,0.04)' : 'none',
        }}>{t.label}</button>
      ))}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────
function Dashboard({ entries, loading }) {
  const [closer, setCloser] = useState('Ahmed');
  const [datePreset, setDatePreset] = useState('Last 7 days');

  const filtered = useMemo(() =>
    entries.filter(e => e.closer === closer && dateInWindow(e.date, datePreset)),
    [entries, closer, datePreset]
  );

  const calls = filtered.reduce((s, e) => s + e.calls, 0);
  const offers = filtered.reduce((s, e) => s + e.offers, 0);
  const closes = filtered.reduce((s, e) => s + e.closes, 0);
  const closeRate = calls > 0 ? (closes / calls) * 100 : 0;
  const offerRate = calls > 0 ? (offers / calls) * 100 : 0;

  return (
    <>
      <FilterBar
        closer={closer} setCloser={setCloser}
        datePreset={datePreset} setDatePreset={setDatePreset}
      />

      <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em', color: '#8a7d6b', textTransform: 'uppercase', marginBottom: 10, paddingLeft: 4 }}>
        Performance
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 22 }}>
        <Kpi label="Calls Connected" value={calls} sub={`${filtered.length} EOD ${filtered.length === 1 ? 'entry' : 'entries'}`} />
        <Kpi label="Offers Given" value={offers} sub={calls > 0 ? fmtPct(offerRate) + ' offer rate' : '—'} />
        <Kpi label="Closes" value={closes} sub={calls > 0 ? fmtPct1(closeRate) + ' close rate' : '—'} tone="accent" />
        <Kpi label="Commissions Earned" value="—" sub="hookup pending" tone="muted" />
        <Kpi label="Commissions Pending" value="—" sub="hookup pending" tone="muted" />
      </div>

      <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em', color: '#8a7d6b', textTransform: 'uppercase', marginBottom: 10, paddingLeft: 4 }}>
        Recent EOD submissions
      </div>
      <Card>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#8a7d6b', fontSize: 13 }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#8a7d6b', fontSize: 13 }}>No submissions in this window.</div>
        ) : (
          filtered.map((e, i) => <PastEntry key={e.id} entry={e} first={i === 0} />)
        )}
      </Card>
    </>
  );
}

// ─── Leaderboard ──────────────────────────────────────────────────────
function Leaderboard({ entries }) {
  const [datePreset, setDatePreset] = useState('Last 7 days');

  const rows = CLOSERS.map(c => {
    const filtered = entries.filter(e => e.closer === c && dateInWindow(e.date, datePreset));
    const calls = filtered.reduce((s, e) => s + e.calls, 0);
    const offers = filtered.reduce((s, e) => s + e.offers, 0);
    const closes = filtered.reduce((s, e) => s + e.closes, 0);
    return {
      closer: c, calls, offers, closes,
      closeRate: calls > 0 ? (closes / calls) * 100 : 0,
    };
  }).sort((a, b) => b.closes - a.closes || b.calls - a.calls);

  return (
    <>
      <div style={{ background: 'white', border: '1px solid #e8e3da', borderRadius: 14, padding: 12, marginBottom: 18 }}>
        <SelectInline value={datePreset} onChange={setDatePreset} options={['Today', 'Yesterday', 'Last 7 days', 'Last 14 days', 'Last 30 days', 'Month to date']} />
      </div>

      <Card>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#faf7f1' }}>
              <Th style={{ width: 60 }}>Rank</Th>
              <Th>Closer</Th>
              <Th right>Calls</Th>
              <Th right>Offers</Th>
              <Th right>Closes</Th>
              <Th right>Close rate</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const rankBg = i === 0 ? '#fdf2dc' : i === 1 ? '#ece8df' : i === 2 ? '#f5e9dc' : '#f4efe7';
              const rankColor = i === 0 ? '#8a6310' : i === 1 ? '#5e5345' : i === 2 ? '#8a5e2d' : '#8a7d6b';
              return (
                <Tr key={r.closer} first={i === 0}>
                  <Td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', fontSize: 13, fontWeight: 600, background: rankBg, color: rankColor }}>{i + 1}</span>
                  </Td>
                  <Td style={{ fontWeight: 500, color: '#1f1b16' }}>{r.closer}</Td>
                  <Td right>{r.calls}</Td>
                  <Td right>{r.offers}</Td>
                  <Td right>{r.closes}</Td>
                  <Td right>{r.calls > 0 ? fmtPct1(r.closeRate) : '—'}</Td>
                </Tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
}

// ─── EOD form ─────────────────────────────────────────────────────────
function EodForm({ entries, onSubmitted }) {
  const [closer, setCloser] = useState('Ahmed');
  const [date, setDate] = useState(todayISO());
  const [energy, setEnergy] = useState(null);
  const [focus, setFocus] = useState(null);
  const [biology, setBiology] = useState(null);
  const [calls, setCalls] = useState('');
  const [offers, setOffers] = useState('');
  const [closes, setCloses] = useState('');
  const [rollup, setRollup] = useState('');
  const [objections, setObjections] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  // Prefill if there's already an entry for this closer + date
  useEffect(() => {
    const existing = entries.find(e => e.closer === closer && e.date === date);
    if (existing) {
      setEnergy(existing.energy);
      setFocus(existing.focus);
      setBiology(existing.biology ? 'Yes' : null);
      setCalls(String(existing.calls ?? ''));
      setOffers(String(existing.offers ?? ''));
      setCloses(String(existing.closes ?? ''));
      setRollup(existing.rollup ?? '');
      setObjections(existing.objections ?? '');
    } else {
      // Clear when switching to a new date
      setEnergy(null); setFocus(null); setBiology(null);
      setCalls(''); setOffers(''); setCloses('');
      setRollup(''); setObjections('');
    }
  }, [closer, date, entries]);

  const callsNum = Number(calls) || 0;
  const offersNum = Number(offers) || 0;
  const closesNum = Number(closes) || 0;
  const offerRate = callsNum > 0 ? (offersNum / callsNum) * 100 : 0;
  const closeRate = callsNum > 0 ? (closesNum / callsNum) * 100 : 0;
  const closeOfOffer = offersNum > 0 ? (closesNum / offersNum) * 100 : 0;

  const handleClear = () => {
    setEnergy(null); setFocus(null); setBiology(null);
    setCalls(''); setOffers(''); setCloses('');
    setRollup(''); setObjections('');
  };

  const handleSubmit = async () => {
    if (callsNum === 0 && offersNum === 0 && closesNum === 0) {
      setToast({ msg: 'Add at least one metric before submitting.', error: true });
      setTimeout(() => setToast(null), 2400);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/eod-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          closer, date,
          energy, focus,
          biology: biology === 'Yes',
          calls: callsNum, offers: offersNum, closes: closesNum,
          rollup, objections,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setToast({ msg: 'Save failed. ' + (json.error || ''), error: true });
      } else {
        setToast({ msg: json.replaced ? 'EOD updated.' : 'EOD submitted.', error: false });
        onSubmitted && onSubmitted();
      }
    } catch (err) {
      setToast({ msg: 'Network error.', error: true });
    }
    setSubmitting(false);
    setTimeout(() => setToast(null), 2400);
  };

  return (
    <>
      <Card style={{ padding: '24px 26px' }}>

        <FormSection title="Who & when" first>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="Closer">
              <SelectInline value={closer} onChange={setCloser} options={CLOSERS} />
            </Field>
            <Field label="Date">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Self-assessment">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="Energy today">
              <ScaleRow value={energy} onChange={setEnergy} />
            </Field>
            <Field label="Focus today">
              <ScaleRow value={focus} onChange={setFocus} />
            </Field>
          </div>
          <div style={{ marginTop: 18 }}>
            <Field label="Protected my biology (food, water, exercise, sleep)">
              <YnRow value={biology} onChange={setBiology} style={{ maxWidth: 220 }} />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Today's metrics">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <Field label="Calls connected"><input type="number" min="0" value={calls} onChange={(e) => setCalls(e.target.value)} placeholder="0" style={inputStyle} /></Field>
            <Field label="Offers given"><input type="number" min="0" value={offers} onChange={(e) => setOffers(e.target.value)} placeholder="0" style={inputStyle} /></Field>
            <Field label="Closes"><input type="number" min="0" value={closes} onChange={(e) => setCloses(e.target.value)} placeholder="0" style={inputStyle} /></Field>
          </div>
          <div style={{ fontSize: 11.5, color: '#8a7d6b', marginTop: 12, padding: '10px 12px', background: '#faf7f1', borderRadius: 8 }}>
            {(callsNum === 0 && offersNum === 0 && closesNum === 0) ? 'Close rate will calculate once you fill in calls and closes.' : (
              <>Offer rate: <strong>{offerRate.toFixed(1)}%</strong> · Close rate (of calls): <strong>{closeRate.toFixed(1)}%</strong> · Close rate (of offers): <strong>{closeOfOffer.toFixed(1)}%</strong></>
            )}
          </div>
        </FormSection>

        <FormSection title="Roll-up">
          <Field label="Daily roll-up — breakdown of all calls you took">
            <textarea value={rollup} onChange={(e) => setRollup(e.target.value)} placeholder="One line per call: prospect name, outcome, key takeaway…" style={{ ...inputStyle, minHeight: 90, resize: 'vertical', cursor: 'text' }} />
          </Field>
          <Field label="Most common objections you heard today">
            <textarea value={objections} onChange={(e) => setObjections(e.target.value)} placeholder="What came up most often today?" style={{ ...inputStyle, minHeight: 70, resize: 'vertical', cursor: 'text' }} />
          </Field>
        </FormSection>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <button onClick={handleClear} disabled={submitting} style={{
            padding: '11px 18px', background: 'transparent', color: '#1f1b16',
            border: '1px solid #d3cfc5', borderRadius: 11, cursor: 'pointer',
            fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
          }}>Clear form</button>
          <button onClick={handleSubmit} disabled={submitting} style={{
            padding: '11px 22px', background: '#1f1b16', color: '#f4f1ec',
            border: 'none', borderRadius: 11, cursor: submitting ? 'wait' : 'pointer',
            fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
            opacity: submitting ? 0.7 : 1,
          }}>{submitting ? 'Saving…' : 'Submit EOD report'}</button>
        </div>

      </Card>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: toast.error ? '#9a3924' : '#1f1b16',
          color: '#f4f1ec', padding: '12px 22px', borderRadius: 11,
          fontSize: 13, fontWeight: 500, boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
        }}>{toast.msg}</div>
      )}
    </>
  );
}

// ─── building blocks ──────────────────────────────────────────────────
function Card({ children, style = {} }) {
  return <div style={{
    background: 'white', border: '1px solid #e8e3da', borderRadius: 14,
    boxShadow: '0 1px 0 rgba(0,0,0,0.02), 0 4px 14px -8px rgba(60,40,20,0.06)',
    overflow: 'hidden', ...style,
  }}>{children}</div>;
}

function Kpi({ label, value, sub, tone = 'default' }) {
  const palette = {
    default: { bg: 'white', border: '#e8e3da', labelColor: '#8a7d6b', valueColor: '#1f1b16', subColor: '#8a7d6b' },
    accent:  { bg: '#e8e4ff', border: '#d4ccff', labelColor: '#4c3fb5', valueColor: '#1f1b16', subColor: '#4c3fb5' },
    good:    { bg: '#e8f3e3', border: '#c8e0bc', labelColor: '#3a6b29', valueColor: '#1f1b16', subColor: '#3a6b29' },
    warn:    { bg: '#fdf2dc', border: '#f0d99b', labelColor: '#8a6310', valueColor: '#1f1b16', subColor: '#8a6310' },
    muted:   { bg: 'white', border: '#e8e3da', labelColor: '#8a7d6b', valueColor: '#a99c87', subColor: '#a99c87' },
  }[tone] || { bg: 'white', border: '#e8e3da', labelColor: '#8a7d6b', valueColor: '#1f1b16', subColor: '#8a7d6b' };
  return (
    <div style={{ background: palette.bg, border: `1px solid ${palette.border}`, borderRadius: 14, padding: '14px 16px', minWidth: 0 }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: palette.labelColor, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: palette.valueColor, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: palette.subColor, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function FilterBar({ closer, setCloser, datePreset, setDatePreset }) {
  return (
    <div style={{ background: 'white', border: '1px solid #e8e3da', borderRadius: 14, padding: 12, marginBottom: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <SelectInline value={closer} onChange={setCloser} options={CLOSERS} />
      <SelectInline value={datePreset} onChange={setDatePreset} options={['Today', 'Yesterday', 'Last 7 days', 'Last 14 days', 'Last 30 days', 'Month to date']} />
    </div>
  );
}

const inputStyle = {
  width: '100%', appearance: 'none', background: 'white',
  border: '1px solid #e8e3da', borderRadius: 11,
  padding: '10px 13px', fontSize: 13.5, color: '#1f1b16',
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
};

function SelectInline({ value, onChange, options }) {
  return (
    <div style={{ position: 'relative' }}>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, paddingRight: 36, cursor: 'pointer' }}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-65%) rotate(45deg)', width: 7, height: 7, borderRight: '1.5px solid #8a7d6b', borderBottom: '1.5px solid #8a7d6b', pointerEvents: 'none' }} />
    </div>
  );
}

function FormSection({ title, children, first }) {
  return (
    <div style={{ paddingTop: first ? 0 : 18, marginTop: first ? 0 : 18, borderTop: first ? 'none' : '1px solid #f1ece4' }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', color: '#8a7d6b', textTransform: 'uppercase', marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: '#1f1b16', marginBottom: 8, display: 'block', lineHeight: 1.4 }}>{label}</label>
      {children}
    </div>
  );
}

function ScaleRow({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 5 }}>
      {[1,2,3,4,5,6,7,8,9,10].map(n => {
        const selected = value === n;
        return (
          <button key={n} type="button" onClick={() => onChange(n)} style={{
            flex: 1, padding: '9px 0',
            border: '1px solid ' + (selected ? '#1f1b16' : '#e8e3da'),
            borderRadius: 8,
            background: selected ? '#1f1b16' : 'white',
            color: selected ? '#f4f1ec' : '#3a3128',
            fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
            fontVariantNumeric: 'tabular-nums',
          }}>{n}</button>
        );
      })}
    </div>
  );
}

function YnRow({ value, onChange, style = {} }) {
  return (
    <div style={{ display: 'flex', gap: 6, ...style }}>
      {['Yes', 'No'].map(label => {
        const selected = value === label;
        const selectedBg = label === 'Yes' ? '#e8f3e3' : '#f6e6e2';
        const selectedBorder = label === 'Yes' ? '#c8e0bc' : '#e8c8be';
        const selectedColor = label === 'Yes' ? '#3a6b29' : '#9a3924';
        return (
          <button key={label} type="button" onClick={() => onChange(label)} style={{
            flex: 1, padding: '9px 0',
            border: '1px solid ' + (selected ? selectedBorder : '#e8e3da'),
            borderRadius: 8,
            background: selected ? selectedBg : 'white',
            color: selected ? selectedColor : '#3a3128',
            fontWeight: selected ? 500 : 400,
            fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
          }}>{label}</button>
        );
      })}
    </div>
  );
}

function Th({ children, right, style = {} }) {
  return <th style={{
    textAlign: right ? 'right' : 'left', padding: '11px 16px',
    fontSize: 10.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
    color: '#8a7d6b', borderBottom: '1px solid #efe9e0', whiteSpace: 'nowrap', ...style,
  }}>{children}</th>;
}

function Tr({ children, first }) {
  return <tr style={{ borderTop: first ? 'none' : '1px solid #f4efe7' }}>{children}</tr>;
}

function Td({ children, right, style = {} }) {
  return <td style={{ padding: '12px 16px', textAlign: right ? 'right' : 'left', color: '#3a3128', fontVariantNumeric: 'tabular-nums', verticalAlign: 'middle', ...style }}>{children}</td>;
}

function PastEntry({ entry, first }) {
  const submittedAt = entry.submittedAt ? new Date(entry.submittedAt) : null;
  const timeStr = submittedAt ? submittedAt.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
  const closeRate = entry.calls > 0 ? (entry.closes / entry.calls) * 100 : 0;
  return (
    <div style={{ padding: '16px 20px', borderTop: first ? 'none' : '1px solid #f4efe7' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{entry.date} · {entry.closer}</div>
        <div style={{ fontSize: 11.5, color: '#8a7d6b' }}>submitted {timeStr}</div>
      </div>
      <div style={{ fontSize: 12, color: '#5e5345' }}>
        <strong style={{ color: '#1f1b16', fontWeight: 500 }}>{entry.calls}</strong> calls ·
        {' '}<strong style={{ color: '#1f1b16', fontWeight: 500 }}>{entry.offers}</strong> offers ·
        {' '}<strong style={{ color: '#1f1b16', fontWeight: 500 }}>{entry.closes}</strong> closes ·
        {' '}<strong style={{ color: '#1f1b16', fontWeight: 500 }}>{closeRate.toFixed(1)}%</strong> close rate ·
        {' '}Energy <strong style={{ color: '#1f1b16', fontWeight: 500 }}>{entry.energy ?? '—'}</strong>/10 ·
        {' '}Focus <strong style={{ color: '#1f1b16', fontWeight: 500 }}>{entry.focus ?? '—'}</strong>/10
      </div>
    </div>
  );
}
