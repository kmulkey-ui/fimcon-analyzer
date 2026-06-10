import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';
import { useApp } from '../state/AppContext';
import { SectionTitle, Card, Tabs, Btn, fmt, Spinner } from '../components/ui';
import {
  colFor, matrixColsFor, subLabel, distributionFor, splitMulti, round1, registrantMetrics,
} from '../lib/compute';
import { PLENARIES, BREAKOUTS, CLOSED_DOOR_NOTE, sessionStats, breakoutBlocks } from '../lib/sessions';
import { AI_ENABLED } from '../lib/runtime';

const TABS = ['Attendance', 'Engagement', 'Survey'];

export default function DeepAnalysis() {
  const [tab, setTab] = useState('Survey');
  return (
    <div>
      <SectionTitle sub="Session-level attendance, app engagement vs benchmarks, and the per-question survey explorer.">
        Deep Analysis
      </SectionTitle>
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'Attendance' && <AttendanceTab />}
      {tab === 'Engagement' && <EngagementTab />}
      {tab === 'Survey' && <SurveyTab />}
    </div>
  );
}

// ---------------- Attendance ----------------
function AttendanceTab() {
  const s = sessionStats();
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Peak attendance', s.peak],
          ['Avg plenary', round1(s.avgPlenary)],
          ['Avg breakout', round1(s.avgBreakout)],
          ['Plenary retention', `${round1(s.plenaryRetention)}%`],
        ].map(([l, v]) => (
          <Card key={l} className="text-center">
            <div className="text-3xl font-extrabold text-emerald-900">{v}</div>
            <div className="text-xs text-stone-500 font-semibold uppercase tracking-wide mt-1">{l}</div>
          </Card>
        ))}
      </div>

      <Card>
        <h3 className="font-semibold text-stone-800 mb-3">Open breakout sessions</h3>
        <ResponsiveContainer width="100%" height={BREAKOUTS.length * 34 + 40}>
          <BarChart data={BREAKOUTS} layout="vertical" margin={{ left: 60, right: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="title" width={260} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => [v, 'Attendance']} labelFormatter={(l, p) => `${l} — Day ${p?.[0]?.payload?.day}, ${p?.[0]?.payload?.block || ''}`} />
            <Bar dataKey="count" fill="#047857" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="overflow-x-auto">
        <h3 className="font-semibold text-stone-800 mb-3">Plenaries &amp; keynotes (Independence Ballroom)</h3>
        <table className="min-w-full text-sm">
          <thead className="border-b border-stone-200">
            <tr>
              {['Day', 'Session', 'Attendance', '% of peak'].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase text-stone-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PLENARIES.map((p) => (
              <tr key={p.title} className="border-b border-stone-100 last:border-0">
                <td className="px-3 py-2">Day {p.day}</td>
                <td className="px-3 py-2 font-medium text-stone-800">{p.title}</td>
                <td className="px-3 py-2">{p.count}</td>
                <td className="px-3 py-2">{round1((p.count / s.peak) * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="text-xs text-stone-500 bg-stone-100 rounded-lg p-3">{CLOSED_DOOR_NOTE}</p>
    </div>
  );
}

// ---------------- Engagement ----------------
function EngagementTab() {
  const { manual, benchmarks, setBenchmarks, metrics } = useApp();
  const rows = [
    ['appAdoptionRate', 'App adoption rate (%)'],
    ['pushOpenRate', 'Push open rate (%)'],
    ['pollParticipation', 'Poll/Q&A participation (%)'],
  ];
  return (
    <div className="space-y-4">
      {rows.map(([key, label]) => {
        const actual = metrics[key];
        const bench = benchmarks[key];
        const status =
          actual == null ? 'nodata' : actual >= bench ? 'met' : actual >= bench * 0.85 ? 'near' : 'missed';
        const barColor = { met: '#059669', near: '#f59e0b', missed: '#dc2626', nodata: '#d6d3d1' }[status];
        return (
          <Card key={key}>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <h3 className="font-semibold text-stone-800">{label}</h3>
              <label className="text-xs text-stone-500">
                Benchmark{' '}
                <input
                  type="number"
                  value={bench}
                  onChange={(e) => setBenchmarks({ ...benchmarks, [key]: parseFloat(e.target.value) || 0 })}
                  className="w-20 rounded-lg border border-stone-300 px-2 py-1 ml-1 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </label>
            </div>
            <ResponsiveContainer width="100%" height={70}>
              <BarChart data={[{ name: label, value: actual ?? 0 }]} layout="vertical" margin={{ left: 0, right: 40 }}>
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" hide />
                <Tooltip formatter={(v) => [`${round1(v)}%`, 'Actual']} />
                <ReferenceLine x={bench} stroke="#0f766e" strokeWidth={2} label={{ value: `benchmark ${bench}%`, fontSize: 10, fill: '#0f766e', position: 'top' }} />
                <Bar dataKey="value" fill={barColor} radius={[0, 4, 4, 0]} barSize={22} />
              </BarChart>
            </ResponsiveContainer>
            {actual == null && (
              <p className="text-xs text-stone-400">No value entered yet — add it under Data Input → Manual entry.</p>
            )}
          </Card>
        );
      })}
      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center">
          <div className="text-3xl font-extrabold text-emerald-900">{manual.resourceDownloads || '—'}</div>
          <div className="text-xs text-stone-500 font-semibold uppercase tracking-wide mt-1">Resource downloads</div>
        </Card>
        <Card className="text-center">
          <div className="text-3xl font-extrabold text-emerald-900">{manual.sessionOpens || '—'}</div>
          <div className="text-xs text-stone-500 font-semibold uppercase tracking-wide mt-1">Session opens</div>
        </Card>
      </div>
    </div>
  );
}

// ---------------- Survey explorer ----------------
const OPEN_ENDED = [5, 6, 7, 22];
const LIKERT = [1, 2, 3, 4, 12, 20, 21];
const MULTI = [10, 18];
const MATRIX = [8, 13];
const SEGMENTS = [
  [15, 'Sector'],
  [16, 'Role'],
  [17, 'Region'],
];

function questionLabel(keys, n) {
  const col = colFor(keys, n);
  if (col) return col.includes('>>') ? col.slice(0, col.indexOf('>>')).trim() : col;
  return `Question ${n}`;
}

function SurveyTab() {
  const { surveyRows, metrics, apiPeople, evaluation, emailJoin } = useApp();
  const [qn, setQn] = useState(1);
  const [insights, setInsights] = useState({});
  const [loading, setLoading] = useState({});
  const [themes, setThemes] = useState('');
  const [themesLoading, setThemesLoading] = useState(false);
  const [segment, setSegment] = useState('none');

  const rows = useMemo(
    () =>
      surveyRows.map((r) => {
        const o = {};
        for (const [k, v] of Object.entries(r)) o[k.trim()] = v;
        return o;
      }),
    [surveyRows]
  );
  const keys = rows.length ? Object.keys(rows[0]) : [];

  if (!rows.length)
    return <Card>No survey data loaded. Sync Jotform or upload the survey CSV on the Data Input tab.</Card>;

  const reg = registrantMetrics(apiPeople);
  const crossContext = {
    checkinRate: round1(metrics.checkinRate),
    invitedNoShowRate: round1(metrics.invitedNoShowRate),
    paidNoShowRate: round1(metrics.paidNoShowRate),
    invitedVsPaidGapPts:
      metrics.invitedNoShowRate != null && metrics.paidNoShowRate != null
        ? round1(metrics.invitedNoShowRate - metrics.paidNoShowRate)
        : null,
    peakAttendance: metrics.peakAttendance,
    avgPlenary: round1(metrics.avgPlenary),
    avgBreakout: round1(metrics.avgBreakout),
    surveyResponses: metrics.surveyResponses,
    responseRate: round1(metrics.responseRate),
    pctConnections: round1(metrics.pctConnections),
    pctReturn: round1(metrics.pctReturn),
    overallScore: round1(evaluation.score),
    rating: evaluation.rating,
    criteriaStatus: evaluation.results.map((r) => `${r.name}: ${r.status}`),
    topBreakoutsByDraw: [...BREAKOUTS].sort((a, b) => b.count - a.count).slice(0, 4).map((b) => `${b.title} (${b.count})`),
  };

  const generateInsight = async (n, distribution) => {
    setLoading((l) => ({ ...l, [n]: true }));
    try {
      const res = await fetch('/api/ai/insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: questionLabel(keys, n), distribution, context: crossContext }),
      });
      const j = await res.json();
      setInsights((s) => ({ ...s, [n]: j.text || j.error }));
    } catch (e) {
      setInsights((s) => ({ ...s, [n]: String(e.message) }));
    }
    setLoading((l) => ({ ...l, [n]: false }));
  };

  const analyzeThemes = async () => {
    setThemesLoading(true);
    try {
      const questions = OPEN_ENDED.map((n) => {
        const col = colFor(keys, n);
        return {
          label: questionLabel(keys, n),
          responses: rows.map((r) => String(r[col] ?? '').trim()).filter(Boolean),
        };
      });
      const res = await fetch('/api/ai/themes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions }),
      });
      const j = await res.json();
      setThemes(j.text || j.error);
    } catch (e) {
      setThemes(String(e.message));
    }
    setThemesLoading(false);
  };

  return (
    <div className="grid lg:grid-cols-[280px,1fr] gap-5">
      {/* Question selector */}
      <div className="space-y-1 max-h-[70vh] overflow-y-auto pr-1" role="listbox" aria-label="Survey questions">
        {Array.from({ length: 22 }, (_, i) => i + 1).map((n) => {
          const label = questionLabel(keys, n);
          return (
            <button
              key={n}
              role="option"
              aria-selected={qn === n}
              onClick={() => setQn(n)}
              className={`block w-full text-left px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                qn === n ? 'bg-emerald-700 text-white font-semibold' : 'bg-white border border-stone-200 text-stone-600 hover:border-emerald-400'
              }`}
            >
              {label.length > 80 ? label.slice(0, 80) + '…' : label}
            </button>
          );
        })}
        {AI_ENABLED && (
          <Btn className="w-full mt-3" onClick={analyzeThemes} disabled={themesLoading}>
            {themesLoading ? <Spinner /> : 'Analyze all open-ended themes'}
          </Btn>
        )}
      </div>

      {/* Question detail */}
      <div className="space-y-4 min-w-0">
        <QuestionDetail
          n={qn}
          rows={rows}
          keys={keys}
          segment={segment}
          setSegment={setSegment}
          emailJoin={emailJoin}
          onInsight={generateInsight}
          insight={insights[qn]}
          insightLoading={loading[qn]}
        />
        {themes && (
          <Card>
            <h3 className="font-semibold text-emerald-900 mb-2">Open-ended themes (Q5 / Q6 / Q7 / Q22)</h3>
            <div className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">{themes}</div>
          </Card>
        )}
      </div>
    </div>
  );
}

function QuestionDetail({ n, rows, keys, segment, setSegment, emailJoin, onInsight, insight, insightLoading }) {
  const label = questionLabel(keys, n);
  const isMatrix = MATRIX.includes(n);
  const isMulti = MULTI.includes(n);
  const isOpen = OPEN_ENDED.includes(n);
  const col = colFor(keys, n);

  // distribution payload also handed to the AI insight route
  let distribution;
  let body;

  if (isMatrix) {
    const cols = matrixColsFor(keys, n);
    const data = cols.map((c) => {
      const { counts, n: count } = distributionFor(rows, c);
      const ordered = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      return { sub: subLabel(c), counts, n: count, top: ordered[0]?.[0] };
    });
    distribution = data.map((d) => ({ subQuestion: d.sub, responses: d.n, counts: d.counts }));
    body = (
      <div className="space-y-4">
        {data.map((d) => {
          const chartData = Object.entries(d.counts).map(([k, v]) => ({ name: k, value: v }));
          return (
            <div key={d.sub}>
              <h4 className="text-sm font-semibold text-stone-700 mb-1">{d.sub} <span className="text-stone-400 font-normal">(n={d.n})</span></h4>
              <ResponsiveContainer width="100%" height={chartData.length * 28 + 10}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 40 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#0d9488" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>
    );
  } else if (isMulti && col) {
    const counts = {};
    let respondents = 0;
    for (const r of rows) {
      const parts = splitMulti(r[col]);
      if (parts.length) respondents += 1;
      for (const p of parts) counts[p] = (counts[p] || 0) + 1;
    }
    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    distribution = { respondents, ranked: Object.fromEntries(ranked) };
    body = (
      <ol className="space-y-1.5">
        {ranked.map(([item, count], i) => (
          <li key={item} className="flex items-center gap-3 text-sm">
            <span className="w-6 text-right font-bold text-emerald-800">{i + 1}.</span>
            <span className="flex-1 text-stone-700">{item}</span>
            <span className="font-semibold text-stone-900">{count}</span>
            <span className="text-xs text-stone-400 w-14">{round1((count / respondents) * 100)}%</span>
          </li>
        ))}
      </ol>
    );
  } else if (isOpen && col) {
    const responses = rows.map((r) => String(r[col] ?? '').trim()).filter(Boolean);
    distribution = { responseCount: responses.length, sample: responses.slice(0, 40) };
    body = (
      <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
        {responses.map((r, i) => (
          <p key={i} className="text-sm text-stone-700 bg-stone-50 rounded-lg p-3 border border-stone-100">{r}</p>
        ))}
      </div>
    );
  } else if (col) {
    const { counts, n: count } = distributionFor(rows, col);
    const isNumeric = LIKERT.includes(n);
    const entries = Object.entries(counts).sort((a, b) =>
      isNumeric ? Number(a[0]) - Number(b[0]) : b[1] - a[1]
    );
    const chartData = entries.map(([k, v]) => ({ name: k, value: v }));
    distribution = { responses: count, counts };
    body = (
      <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 32)}>
        <BarChart data={chartData} layout={chartData.length > 6 || !isNumeric ? 'vertical' : 'horizontal'} margin={{ left: 10, right: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
          {chartData.length > 6 || !isNumeric ? (
            <>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 11 }} />
            </>
          ) : (
            <>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            </>
          )}
          <Tooltip />
          <Bar dataKey="value" fill="#047857" radius={4} />
        </BarChart>
      </ResponsiveContainer>
    );
  } else {
    body = <p className="text-sm text-stone-500">Column for question {n} not found in this dataset.</p>;
  }

  const respCount = (() => {
    if (isMatrix) return rows.filter((r) => matrixColsFor(keys, n).some((c) => String(r[c] ?? '').trim())).length;
    if (!col) return 0;
    return rows.filter((r) => String(r[col] ?? '').trim()).length;
  })();

  // segment splits
  const segOptions = [['none', 'No split'], ...SEGMENTS.map(([sn, sl]) => [String(sn), `By ${sl.toLowerCase()} (Q${sn})`])];
  if (emailJoin?.available) segOptions.push(['cohort', 'Invited vs paid (email join)']);

  let segmentBody = null;
  if (segment !== 'none' && col && !isOpen && !isMatrix && !isMulti) {
    const groups = {};
    if (segment === 'cohort' && emailJoin?.available) {
      for (const t of emailJoin.tagged) {
        if (!t.cohort) continue;
        const v = String(t.row[col] ?? '').trim();
        if (!v) continue;
        if (!groups[t.cohort]) groups[t.cohort] = [];
        groups[t.cohort].push(v);
      }
    } else {
      const segCol = colFor(keys, Number(segment));
      for (const r of rows) {
        const g = String(r[segCol] ?? '').trim() || '(blank)';
        const v = String(r[col] ?? '').trim();
        if (!v) continue;
        if (!groups[g]) groups[g] = [];
        groups[g].push(v);
      }
    }
    const isNumeric = LIKERT.includes(n);
    const segRows = Object.entries(groups)
      .filter(([, vals]) => vals.length >= 3)
      .map(([g, vals]) => {
        if (isNumeric) {
          const nums = vals.map(Number).filter((x) => Number.isFinite(x));
          return { group: g, n: vals.length, value: nums.length ? round1(nums.reduce((a, b) => a + b, 0) / nums.length) : '—', kind: 'avg' };
        }
        const top = Object.entries(vals.reduce((m, v) => ((m[v] = (m[v] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1])[0];
        return { group: g, n: vals.length, value: `${top[0]} (${round1((top[1] / vals.length) * 100)}%)`, kind: 'top' };
      })
      .sort((a, b) => b.n - a.n);
    segmentBody = (
      <table className="min-w-full text-sm mt-2">
        <thead className="border-b border-stone-200">
          <tr>
            {['Segment', 'n', segRows[0]?.kind === 'avg' ? 'Average' : 'Most common'].map((h) => (
              <th key={h} className="px-3 py-1.5 text-left text-xs font-semibold uppercase text-stone-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {segRows.map((s) => (
            <tr key={s.group} className="border-b border-stone-100 last:border-0">
              <td className="px-3 py-1.5 text-stone-700">{s.group}</td>
              <td className="px-3 py-1.5">{s.n}</td>
              <td className="px-3 py-1.5 font-semibold text-stone-900">{s.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-semibold text-stone-800">{label}</h3>
          <p className="text-xs text-stone-400 mt-0.5">
            {respCount} responses · {round1((respCount / rows.length) * 100)}% of survey respondents
            {n === 20 && ' · reported as a simple average only'}
          </p>
        </div>
        {AI_ENABLED && (
          <Btn onClick={() => onInsight(n, distribution)} disabled={insightLoading}>
            {insightLoading ? <Spinner /> : 'Generate insight'}
          </Btn>
        )}
      </div>

      {!isOpen && !isMatrix && !isMulti && (
        <div className="mt-3">
          <label className="text-xs text-stone-500">
            Segment split{' '}
            <select
              value={segment}
              onChange={(e) => setSegment(e.target.value)}
              className="rounded-lg border border-stone-300 px-2 py-1 ml-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              {segOptions.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </label>
          {!emailJoin?.available && (
            <span className="text-[11px] text-stone-400 ml-2">
              Invited-vs-paid split unavailable — the survey does not capture respondent email, so responses cannot be joined to vFairs registrants.
            </span>
          )}
        </div>
      )}

      <div className="mt-4">{body}</div>

      {n === 19 && col && (() => {
        const { counts, n: total } = distributionFor(rows, col);
        const yes = Object.entries(counts)
          .filter(([k]) => k.toLowerCase().includes('yes'))
          .reduce((a, [, v]) => a + v, 0);
        if (!total) return null;
        return (
          <p className="mt-3 text-sm font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            Counting responses featuring &ldquo;yes&rdquo;, the return intent (% would attend again) would be{' '}
            {round1((yes / total) * 100)}% ({yes} of {total}).
          </p>
        );
      })()}

      {segmentBody}

      {insight && (
        <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          <div className="text-xs font-bold text-emerald-800 uppercase tracking-wide mb-1">Insight</div>
          <p className="text-sm text-stone-700 leading-relaxed">{insight}</p>
        </div>
      )}
    </Card>
  );
}
