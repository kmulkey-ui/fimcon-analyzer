import React, { useMemo } from 'react';
import { useApp } from '../state/AppContext';
import { SectionTitle, Card, fmt } from '../components/ui';
import { round1, surveyMetrics, registrantMetrics, colFor, avgFor } from '../lib/compute';
import { BREAKOUTS, PLENARIES, CLOSED_DOOR_NOTE, sessionStats, breakoutBlocks } from '../lib/sessions';

export default function Comparisons() {
  const { surveyRows, priorRows, apiPeople, emailJoin } = useApp();
  const s = sessionStats();
  const reg = registrantMetrics(apiPeople);

  return (
    <div className="space-y-6">
      <SectionTitle sub="Day-over-day, plenary-vs-breakout, cohort, sector, and prior-event comparisons.">
        Comparisons
      </SectionTitle>

      <DayComparison />
      <PlenaryVsBreakout s={s} />
      <InvitedVsPaid reg={reg} emailJoin={emailJoin} surveyRows={surveyRows} />
      <SectorComparison surveyRows={surveyRows} />
      <PriorEvent surveyRows={surveyRows} priorRows={priorRows} />
    </div>
  );
}

function DayComparison() {
  const blocks = breakoutBlocks();
  const day1 = BREAKOUTS.filter((b) => b.day === 1);
  const day2 = BREAKOUTS.filter((b) => b.day === 2);
  const sum = (L) => L.reduce((a, b) => a + b.count, 0);
  const avg = (L) => sum(L) / L.length;
  const pctDiff = ((sum(day2) - sum(day1)) / sum(day1)) * 100;
  return (
    <Card>
      <h3 className="font-semibold text-stone-800 mb-3">Day 1 vs Day 2 — open breakouts</h3>
      <div className="grid sm:grid-cols-3 gap-3 text-center mb-4">
        {[
          ['Day 1 total', sum(day1), `${day1.length} sessions · avg ${round1(avg(day1))}`],
          ['Day 2 total', sum(day2), `${day2.length} sessions · avg ${round1(avg(day2))}`],
          ['Difference', `${round1(pctDiff)}%`, 'Day 2 vs Day 1'],
        ].map(([l, v, sub]) => (
          <div key={l} className="bg-stone-50 rounded-lg p-3">
            <div className="text-2xl font-extrabold text-emerald-900">{v}</div>
            <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide">{l}</div>
            <div className="text-xs text-stone-400 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {blocks.map((b) => (
          <div key={`${b.day}-${b.block}`} className="border border-stone-200 rounded-lg p-3">
            <div className="text-sm font-semibold text-stone-700 mb-2">Day {b.day} — {b.block} <span className="text-stone-400 font-normal">(block total {b.total})</span></div>
            <ul className="space-y-1 text-sm">
              {b.sessions.map((sess) => (
                <li key={sess.title} className="flex justify-between gap-2">
                  <span className="text-stone-600">{sess.title}</span>
                  <span className="font-semibold text-stone-900">{sess.count}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="text-xs text-stone-500 bg-stone-100 rounded-lg p-3 mt-4">{CLOSED_DOOR_NOTE}</p>
    </Card>
  );
}

function PlenaryVsBreakout({ s }) {
  const pl = PLENARIES.map((p) => p.count);
  const br = BREAKOUTS.map((b) => b.count);
  const rows = [
    ['Sessions', PLENARIES.length, BREAKOUTS.length],
    ['Average', round1(s.avgPlenary), round1(s.avgBreakout)],
    ['High', Math.max(...pl), Math.max(...br)],
    ['Low', Math.min(...pl), Math.min(...br)],
  ];
  return (
    <Card>
      <h3 className="font-semibold text-stone-800 mb-3">Plenary vs breakout</h3>
      <table className="min-w-full text-sm max-w-md">
        <thead className="border-b border-stone-200">
          <tr>
            {['', 'Plenaries', 'Open breakouts'].map((h, i) => (
              <th key={i} className="px-3 py-2 text-left text-xs font-semibold uppercase text-stone-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([l, a, b]) => (
            <tr key={l} className="border-b border-stone-100 last:border-0">
              <td className="px-3 py-2 font-medium text-stone-700">{l}</td>
              <td className="px-3 py-2">{a}</td>
              <td className="px-3 py-2">{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-sm text-stone-600 mt-3">
        Plenary retention held at <span className="font-semibold">{round1(s.plenaryRetention)}%</span> — the lowest plenary
        ({s.lowestPlenary}) kept {round1(s.plenaryRetention)}% of the {s.peak} peak, signaling the main-stage program held the
        room across both days of FIMCON 2026.
      </p>
    </Card>
  );
}

function InvitedVsPaid({ reg, emailJoin, surveyRows }) {
  const gap =
    reg.invited?.noShowRate != null && reg.paid?.noShowRate != null
      ? reg.invited.noShowRate - reg.paid.noShowRate
      : null;
  return (
    <Card>
      <h3 className="font-semibold text-stone-800 mb-3">Invited vs paid registrants</h3>
      <table className="min-w-full text-sm max-w-lg">
        <thead className="border-b border-stone-200">
          <tr>
            {['', 'Invited guests', 'Paid registrants'].map((h, i) => (
              <th key={i} className="px-3 py-2 text-left text-xs font-semibold uppercase text-stone-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[
            ['Registered', reg.invited?.registered, reg.paid?.registered],
            ['Attended', reg.invited?.checkedIn, reg.paid?.checkedIn],
            ['No-show rate', fmt(reg.invited?.noShowRate, '%'), fmt(reg.paid?.noShowRate, '%')],
          ].map(([l, a, b]) => (
            <tr key={l} className="border-b border-stone-100 last:border-0">
              <td className="px-3 py-2 font-medium text-stone-700">{l}</td>
              <td className="px-3 py-2">{a ?? '—'}</td>
              <td className="px-3 py-2">{b ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {gap != null && (
        <p className="text-sm text-stone-600 mt-3">
          Gap: <span className="font-semibold text-amber-700">{round1(Math.abs(gap))} percentage points</span>{' '}
          {gap > 0 ? 'higher no-show among invited guests.' : 'higher no-show among paid registrants.'}
        </p>
      )}
      <p className="text-xs text-stone-400 mt-2">
        {emailJoin?.available
          ? `Survey sentiment split by cohort is available in the Survey explorer (email join matched ${emailJoin.joined} respondents).`
          : 'Survey sentiment by cohort is unavailable — the post-conference survey does not capture respondent email, so responses cannot be joined to vFairs registrants.'}
      </p>
    </Card>
  );
}

function SectorComparison({ surveyRows }) {
  const data = useMemo(() => {
    if (!surveyRows.length) return [];
    const rows = surveyRows.map((r) => {
      const o = {};
      for (const [k, v] of Object.entries(r)) o[k.trim()] = v;
      return o;
    });
    const keys = Object.keys(rows[0]);
    const sectorCol = colFor(keys, 15);
    const satCol = colFor(keys, 1);
    const retCol = colFor(keys, 19);
    if (!sectorCol) return [];
    const groups = {};
    for (const r of rows) {
      const g = String(r[sectorCol] ?? '').trim();
      if (!g) continue;
      if (!groups[g]) groups[g] = { sat: [], ret: [] };
      const sat = parseFloat(r[satCol]);
      if (Number.isFinite(sat)) groups[g].sat.push(sat);
      const ret = String(r[retCol] ?? '').trim().toLowerCase();
      if (ret) groups[g].ret.push(ret.startsWith('yes') || ret.includes('definitely') ? 1 : 0);
    }
    return Object.entries(groups)
      .filter(([, v]) => v.sat.length >= 3)
      .map(([g, v]) => ({
        sector: g,
        n: v.sat.length,
        avgSat: round1(v.sat.reduce((a, b) => a + b, 0) / v.sat.length),
        pctReturn: v.ret.length ? round1((v.ret.reduce((a, b) => a + b, 0) / v.ret.length) * 100) : null,
      }))
      .sort((a, b) => b.n - a.n);
  }, [surveyRows]);

  if (!data.length) return null;
  return (
    <Card>
      <h3 className="font-semibold text-stone-800 mb-3">By respondent sector <span className="text-stone-400 font-normal text-sm">(n ≥ 3)</span></h3>
      <table className="min-w-full text-sm">
        <thead className="border-b border-stone-200">
          <tr>
            {['Sector', 'n', 'Avg satisfaction', 'Return intent'].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase text-stone-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.sector} className="border-b border-stone-100 last:border-0">
              <td className="px-3 py-2 font-medium text-stone-700">{d.sector}</td>
              <td className="px-3 py-2">{d.n}</td>
              <td className="px-3 py-2 font-semibold">{d.avgSat}</td>
              <td className="px-3 py-2">{d.pctReturn != null ? `${d.pctReturn}%` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function PriorEvent({ surveyRows, priorRows }) {
  const current = useMemo(() => surveyMetrics(surveyRows), [surveyRows]);
  const prior = useMemo(() => surveyMetrics(priorRows), [priorRows]);
  const METRICS = [
    ['avgSatisfaction', 'Overall satisfaction (avg, 1–5)'],
    ['avgSpeakers', 'Speaker quality (avg, 1–5)'],
    ['avgLogistics', 'Logistics satisfaction (avg, 1–5)'],
    ['avgRecommend', 'Avg recommendation score'],
    ['pctReturn', 'Return intent (%)'],
    ['pctConnections', 'Connections made (%)'],
  ];
  return (
    <Card>
      <h3 className="font-semibold text-stone-800 mb-3">Vs prior event</h3>
      {!priorRows.length ? (
        <p className="text-sm text-stone-500">
          Upload a prior-event survey CSV on the Data Input tab to unlock a side-by-side comparison.
        </p>
      ) : (
        <table className="min-w-full text-sm max-w-2xl">
          <thead className="border-b border-stone-200">
            <tr>
              {['Metric', 'Prior event', 'FIMCON 2026', 'Delta'].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase text-stone-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRICS.map(([k, label]) => {
              const a = prior[k];
              const b = current[k];
              const d = a != null && b != null ? b - a : null;
              return (
                <tr key={k} className="border-b border-stone-100 last:border-0">
                  <td className="px-3 py-2 font-medium text-stone-700">{label}</td>
                  <td className="px-3 py-2">{fmt(a)}</td>
                  <td className="px-3 py-2 font-semibold">{fmt(b)}</td>
                  <td className={`px-3 py-2 font-bold ${d == null ? 'text-stone-400' : d >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {d == null ? '—' : `${d >= 0 ? '+' : ''}${round1(d)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );
}
