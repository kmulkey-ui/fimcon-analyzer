// Computation logic ported from the working prototype — preserve exactly.
import { sessionStats } from './sessions';

export const round1 = (n) =>
  n == null || Number.isNaN(n) ? null : Math.round(n * 10) / 10;

export const isInvited = (ticketType) =>
  /invited guest|friends of fimcon/i.test(ticketType || '');

// ---------- survey column lookup ----------
export function colFor(keys, n) {
  return keys.find((k) => k.trim().startsWith(n + '.'));
}
export function matrixColsFor(keys, n) {
  return keys.filter((k) => k.trim().startsWith(n + '.') && k.includes('>>'));
}
export function subLabel(key) {
  const i = key.indexOf('>>');
  return i >= 0 ? key.slice(i + 2).trim() : key;
}

const num = (v) => {
  const x = parseFloat(String(v ?? '').trim());
  return Number.isFinite(x) ? x : null;
};

export function avgFor(rows, keys, n) {
  const col = colFor(keys, n);
  if (!col) return null;
  const vals = rows.map((r) => num(r[col])).filter((v) => v != null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

export function pctMatching(rows, keys, n, testFn) {
  const col = colFor(keys, n);
  if (!col) return { pct: null, unmatched: [] };
  const vals = rows
    .map((r) => String(r[col] ?? '').trim())
    .filter((v) => v !== '');
  if (!vals.length) return { pct: null, unmatched: [] };
  const unmatched = [];
  let hits = 0;
  for (const v of vals) {
    if (testFn(v.toLowerCase())) hits += 1;
    else unmatched.push(v);
  }
  return { pct: (hits / vals.length) * 100, unmatched };
}

// Q10 multi-select: live export is newline-separated; spec fallback ; then ,
export function splitMulti(v) {
  const s = String(v ?? '').trim();
  if (!s) return [];
  const sep = s.includes('\n') ? '\n' : s.includes(';') ? ';' : ',';
  return s.split(sep).map((p) => p.trim()).filter((p) => p.length > 2);
}

export function distributionFor(rows, col) {
  const counts = {};
  let n = 0;
  for (const r of rows) {
    const v = String(r[col] ?? '').trim();
    if (!v) continue;
    n += 1;
    counts[v] = (counts[v] || 0) + 1;
  }
  return { counts, n };
}

// ---------- survey metrics ----------
export function surveyMetrics(rows) {
  if (!rows?.length) return {};
  const keys = Object.keys(rows[0]).map((k) => k.trim());
  // re-key rows with trimmed headers
  const trimmed = rows.map((r) => {
    const o = {};
    for (const [k, v] of Object.entries(r)) o[k.trim()] = v;
    return o;
  });

  const q19 = pctMatching(trimmed, keys, 19, (v) => v.startsWith('yes') || v.includes('definitely'));
  const q14 = pctMatching(trimmed, keys, 14, (v) => v.startsWith('yes'));
  if (import.meta.env?.DEV) {
    if (q19.unmatched.length) console.log('[dev] Q19 unmatched values:', [...new Set(q19.unmatched)]);
    if (q14.unmatched.length) console.log('[dev] Q14 unmatched values:', [...new Set(q14.unmatched)]);
  }

  // Q8 matrix: % strengthened across all sub-question answers
  const q8cols = matrixColsFor(keys, 8);
  let q8total = 0;
  let q8strength = 0;
  for (const c of q8cols) {
    for (const r of trimmed) {
      const v = String(r[c] ?? '').trim();
      if (!v) continue;
      q8total += 1;
      if (!/not at all|no change|none|n\/a/i.test(v)) q8strength += 1;
    }
  }

  // Q20 scale detection: the spec assumed 0–10 but the live form uses 1–5 —
  // label the average with whichever scale the data actually shows. Simple
  // average only — NO NPS, ever.
  const q20col = colFor(keys, 20);
  const q20vals = q20col
    ? trimmed.map((r) => num(r[q20col])).filter((v) => v != null)
    : [];
  const recommendScale = q20vals.some((v) => v > 5) ? '0–10' : '1–5';

  return {
    responses: trimmed.length,
    avgSatisfaction: avgFor(trimmed, keys, 1),
    avgRelevance: avgFor(trimmed, keys, 2),
    avgSpeakers: avgFor(trimmed, keys, 3),
    avgLogistics: avgFor(trimmed, keys, 4),
    avgNetworking: avgFor(trimmed, keys, 12),
    avgRecommend: avgFor(trimmed, keys, 20), // simple average only — NO NPS
    recommendScale,
    pctReturn: q19.pct,
    pctConnections: q14.pct,
    pctStrengthened: q8total ? (q8strength / q8total) * 100 : null,
  };
}

// ---------- vFairs metrics ----------
export function registrantMetrics(registrants) {
  if (!registrants?.length) return {};
  const cohort = (list) => {
    const registered = list.length;
    const checkedIn = list.filter((r) => r.checkedIn).length;
    return {
      registered,
      checkedIn,
      noShows: registered - checkedIn,
      checkinRate: registered ? (checkedIn / registered) * 100 : null,
      noShowRate: registered ? 100 - (checkedIn / registered) * 100 : null,
    };
  };
  const invited = registrants.filter((r) => isInvited(r.ticketType));
  const paid = registrants.filter((r) => !isInvited(r.ticketType));
  return {
    overall: cohort(registrants),
    invited: cohort(invited),
    paid: cohort(paid),
  };
}

// ---------- combined metrics registry ----------
export function buildMetrics({ registrants, surveyRows, manual }) {
  const reg = registrantMetrics(registrants);
  const survey = surveyMetrics(surveyRows);
  const sess = sessionStats();
  const responses = survey.responses ?? null;
  const checkedIn = reg.overall?.checkedIn ?? null;
  return {
    // survey
    avgSatisfaction: survey.avgSatisfaction ?? null,
    avgRelevance: survey.avgRelevance ?? null,
    avgSpeakers: survey.avgSpeakers ?? null,
    avgLogistics: survey.avgLogistics ?? null,
    avgNetworking: survey.avgNetworking ?? null,
    avgRecommend: survey.avgRecommend ?? null,
    recommendScale: survey.recommendScale ?? '1–5',
    pctReturn: survey.pctReturn ?? null,
    pctConnections: survey.pctConnections ?? null,
    pctStrengthened: survey.pctStrengthened ?? null,
    surveyResponses: responses,
    responseRate:
      responses != null && checkedIn ? (responses / checkedIn) * 100 : null,
    // vFairs
    registered: reg.overall?.registered ?? null,
    checkedIn,
    noShows: reg.overall?.noShows ?? null,
    checkinRate: reg.overall?.checkinRate ?? null,
    noShowRate: reg.overall?.noShowRate ?? null,
    invitedNoShowRate: reg.invited?.noShowRate ?? null,
    paidNoShowRate: reg.paid?.noShowRate ?? null,
    // sessions
    peakAttendance: sess.peak,
    avgPlenary: sess.avgPlenary,
    avgBreakout: sess.avgBreakout,
    plenaryRetention: sess.plenaryRetention,
    // manual engagement entries
    appAdoptionRate: manual?.appAdoptionRate ?? null,
    pushOpenRate: manual?.pushOpenRate ?? null,
    pollParticipation: manual?.pollParticipation ?? null,
    resourceDownloads: manual?.resourceDownloads ?? null,
    sessionOpens: manual?.sessionOpens ?? null,
  };
}

export const METRIC_OPTIONS = [
  ['avgSatisfaction', 'Overall satisfaction (avg, 1–5)'],
  ['avgRelevance', 'Content relevance (avg, 1–5)'],
  ['avgSpeakers', 'Speaker & panelist quality (avg, 1–5)'],
  ['avgLogistics', 'Logistics satisfaction (avg, 1–5)'],
  ['avgNetworking', 'Networking satisfaction (avg, 1–5)'],
  ['avgRecommend', 'Avg recommendation score'],
  ['pctReturn', 'Return intent (%)'],
  ['pctConnections', 'Connections made (%)'],
  ['pctStrengthened', 'Understanding strengthened (%)'],
  ['responseRate', 'Survey response rate (%)'],
  ['checkinRate', 'Overall check-in rate (%)'],
  ['noShowRate', 'Overall no-show rate (%)'],
  ['invitedNoShowRate', 'Invited guest no-show rate (%)'],
  ['paidNoShowRate', 'Paid registrant no-show rate (%)'],
  ['peakAttendance', 'Peak session attendance'],
  ['avgPlenary', 'Avg plenary attendance'],
  ['avgBreakout', 'Avg breakout attendance'],
  ['appAdoptionRate', 'App adoption rate (%)'],
  ['pushOpenRate', 'Push open rate (%)'],
  ['pollParticipation', 'Poll/Q&A participation (%)'],
  ['resourceDownloads', 'Resource downloads (#)'],
  ['sessionOpens', 'Session opens (#)'],
];

// ---------- criteria ----------
export const DEFAULT_CRITERIA = [
  { id: 'c1', name: 'Overall satisfaction (avg, 1–5)', metric: 'avgSatisfaction', op: '>=', target: 4.0, stretch: 4.5, weight: 'high' },
  { id: 'c2', name: 'Overall check-in rate (%)', metric: 'checkinRate', op: '>=', target: 85, stretch: 92, weight: 'high' },
  { id: 'c3', name: 'Return intent (% would attend again)', metric: 'pctReturn', op: '>=', target: 75, stretch: 85, weight: 'high' },
  { id: 'c4', name: 'Invited guest no-show rate (%)', metric: 'invitedNoShowRate', op: '<=', target: 20, stretch: 12, weight: 'medium' },
  { id: 'c5', name: 'Speaker & panelist quality (avg, 1–5)', metric: 'avgSpeakers', op: '>=', target: 4.0, stretch: 4.5, weight: 'medium' },
  { id: 'c6', name: 'Connections made (% yes)', metric: 'pctConnections', op: '>=', target: 60, stretch: 75, weight: 'medium' },
  { id: 'c7', name: 'Peak session attendance', metric: 'peakAttendance', op: '>=', target: 700, stretch: 745, weight: 'medium' },
  { id: 'c8', name: 'Logistics satisfaction (avg, 1–5)', metric: 'avgLogistics', op: '>=', target: 4.0, stretch: 4.5, weight: 'low' },
];

export const WEIGHTS = { high: 3, medium: 2, low: 1 };

export function evaluateCriterion(c, metrics) {
  const actual = c.manualActual != null && c.manualActual !== ''
    ? Number(c.manualActual)
    : metrics[c.metric];
  if (actual == null || Number.isNaN(actual)) {
    return { ...c, actual: null, status: 'nodata', perf: null };
  }
  let status = 'missed';
  let perf = 0;
  if (c.op === '>=') {
    if (c.stretch != null && actual >= c.stretch) status = 'stretch';
    else if (actual >= c.target) status = 'met';
    else if (actual >= c.target * 0.9) status = 'near';
    perf = Math.min(actual / c.target, 1);
  } else if (c.op === '<=') {
    if (c.stretch != null && actual <= c.stretch) status = 'stretch';
    else if (actual <= c.target) status = 'met';
    else if (actual <= c.target * 1.1) status = 'near';
    perf = actual > 0 ? Math.min(c.target / actual, 1) : 1;
  } else {
    status = actual === c.target ? 'met' : 'missed';
    perf = actual === c.target ? 1 : 0;
  }
  return { ...c, actual, status, perf };
}

export function evaluateAll(criteria, metrics) {
  const results = criteria.map((c) => evaluateCriterion(c, metrics));
  const withData = results.filter((r) => r.actual != null);
  const wSum = withData.reduce((a, r) => a + WEIGHTS[r.weight], 0);
  const score = wSum
    ? (withData.reduce((a, r) => a + WEIGHTS[r.weight] * r.perf, 0) / wSum) * 100
    : null;
  const metShare = wSum
    ? withData.reduce(
        (a, r) => a + (r.status === 'met' || r.status === 'stretch' ? WEIGHTS[r.weight] : 0),
        0
      ) / wSum
    : 0;
  const rating =
    metShare >= 0.8 ? 'Strong' : metShare >= 0.55 ? 'Moderate' : 'Needs Improvement';
  return { results, score, rating, metShare };
}

export const STATUS_STYLES = {
  stretch: { label: '★ Stretch', pill: 'bg-teal-600 text-white', bar: 'bg-teal-600', text: 'text-teal-600' },
  met: { label: 'Met', pill: 'bg-emerald-600 text-white', bar: 'bg-emerald-600', text: 'text-emerald-700' },
  near: { label: 'Near', pill: 'bg-amber-500 text-white', bar: 'bg-amber-500', text: 'text-amber-600' },
  missed: { label: 'Missed', pill: 'bg-red-600 text-white', bar: 'bg-red-600', text: 'text-red-600' },
  nodata: { label: 'No data', pill: 'bg-stone-300 text-stone-700', bar: 'bg-stone-300', text: 'text-stone-500' },
};

export function findingSentence(r) {
  const s = STATUS_STYLES[r.status].label.replace('★ ', '');
  const fmt = (v) => round1(v);
  if (r.status === 'nodata')
    return `No data is available yet for ${r.name.toLowerCase()}.`;
  const dir = r.op === '<=' ? 'at or below' : 'at or above';
  if (r.status === 'stretch')
    return `${r.name} reached ${fmt(r.actual)}, surpassing the stretch goal of ${fmt(r.stretch)} — a standout result for FIMCON 2026.`;
  if (r.status === 'met')
    return `${r.name} came in at ${fmt(r.actual)}, meeting the target of ${dir} ${fmt(r.target)}.`;
  if (r.status === 'near')
    return `${r.name} landed at ${fmt(r.actual)}, just shy of the ${fmt(r.target)} target — within striking distance for the next FIMCON.`;
  return `${r.name} finished at ${fmt(r.actual)} against a target of ${dir} ${fmt(r.target)}, a clear focus area for future planning.`;
}

// ---------- CSV export helper ----------
export function toCSV(rows) {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [keys.join(','), ...rows.map((r) => keys.map((k) => esc(r[k])).join(','))].join('\n');
}

export function downloadCSV(filename, rows) {
  const blob = new Blob([toCSV(rows)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
