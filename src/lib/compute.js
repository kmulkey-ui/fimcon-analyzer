// Computation logic ported from the working prototype — preserve exactly —
// plus the cleaned-cohort rules requested by ARB (staff exclusions, unique
// users, speaker no-show handling) and user-journey engagement metrics.
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

  // Return intent (Q19): count any response featuring "yes" (e.g. "Definitely
  // yes", "Probably yes"). The old matcher only caught "definitely" and silently
  // dropped every "Probably yes" — understating return intent.
  const q19 = pctMatching(trimmed, keys, 19, (v) => v.includes('yes'));
  const q14 = pctMatching(trimmed, keys, 14, (v) => v.includes('yes'));

  // Full Q19 distribution, surfaced so the UI can show the breakdown alongside
  // the headline "% featuring yes" figure.
  const q19col = colFor(keys, 19);
  const returnIntentDist = q19col ? distributionFor(trimmed, q19col) : { counts: {}, n: 0 };
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
    pctReturn: q19.pct, // % of responses featuring "yes" (would attend again)
    returnIntentDist, // { counts: { 'Definitely yes': n, ... }, n }
    pctConnections: q14.pct,
    pctStrengthened: q8total ? (q8strength / q8total) * 100 : null,
  };
}

// ---------- cleaned people cohorts ----------
// people = output of /api/vfairs/people (staff excluded, deduped by email).
// Rules: speakers who never badge-checked-in are NOT no-shows — they are
// acknowledged separately. Rates use the "accountable" base, which excludes
// speaker non-check-ins so checkinRate + noShowRate = 100.
export function peopleMetrics(people) {
  if (!people?.length) return {};
  const speakers = people.filter((p) => p.isSpeaker);
  const nonSpeakers = people.filter((p) => !p.isSpeaker);
  const speakersIn = speakers.filter((p) => p.checkedIn);
  const speakersNotIn = speakers.filter((p) => !p.checkedIn);

  const cohort = (list) => {
    const registered = list.length;
    const checkedIn = list.filter((p) => p.checkedIn).length;
    return {
      registered,
      checkedIn,
      noShows: registered - checkedIn,
      checkinRate: registered ? (checkedIn / registered) * 100 : null,
      noShowRate: registered ? 100 - (checkedIn / registered) * 100 : null,
    };
  };

  const invited = nonSpeakers.filter((p) => isInvited(p.ticketType));
  const paid = nonSpeakers.filter((p) => !isInvited(p.ticketType));

  const registered = people.length;
  const checkedIn = people.filter((p) => p.checkedIn).length;
  const accountable = registered - speakersNotIn.length;
  const noShows = nonSpeakers.filter((p) => !p.checkedIn).length;

  return {
    overall: {
      registered,
      checkedIn,
      noShows,
      accountable,
      speakersNotCheckedIn: speakersNotIn.length,
      checkinRate: accountable ? (checkedIn / accountable) * 100 : null,
      noShowRate: accountable ? (noShows / accountable) * 100 : null,
    },
    invited: cohort(invited),
    paid: cohort(paid),
    speakers: {
      registered: speakers.length,
      checkedIn: speakersIn.length,
      notCheckedIn: speakersNotIn.length,
      checkinRate: speakers.length ? (speakersIn.length / speakers.length) * 100 : null,
    },
    speakersNotCheckedInList: speakersNotIn,
  };
}

export { peopleMetrics as registrantMetrics };

// ---------- API-based no-show analysis ----------
// The registration vs. no-show comparison uses the live vFairs API pull as the
// base — only currently-"Registered" attendees. People present in the historical
// xlsx export but absent from the API have cancelled/withdrawn and are excluded.
// Speakers who never badged in and registrants who used the event app but never
// checked in are surfaced as separate noted groups; no-shows are reported both
// with and without them, with full name lists to peruse.
export function noShowBreakdown(people) {
  if (!people?.length) return null;
  const apiKnown = people.some((p) => p.apiRegistered);
  const base = apiKnown ? people.filter((p) => p.apiRegistered) : people;
  // Cancelled = in the xlsx snapshot but not in the live API, never checked in,
  // not a speaker (e.g. the "unspecified" ghost registrations).
  const cancelled = apiKnown
    ? people.filter((p) => !p.apiRegistered && !p.isSpeaker && !p.checkedIn)
    : [];

  const speakers = base.filter((p) => p.isSpeaker);
  const nonSpeakers = base.filter((p) => !p.isSpeaker);
  const loggedIn = (p) => (p.journey?.logins || 0) > 0;

  const speakersNoCheckin = speakers.filter((p) => !p.checkedIn);
  const appNoCheckin = nonSpeakers.filter((p) => !p.checkedIn && loggedIn(p));
  const hardNoShows = nonSpeakers.filter((p) => !p.checkedIn && !loggedIn(p));
  const allNoShows = nonSpeakers.filter((p) => !p.checkedIn);

  const registered = base.length;
  const accountable = registered - speakersNoCheckin.length; // unbadged speakers set aside
  const invited = nonSpeakers.filter((p) => isInvited(p.ticketType));
  const paid = nonSpeakers.filter((p) => !isInvited(p.ticketType));
  const pct = (a, b) => (b ? (a / b) * 100 : null);
  const cohort = (list) => {
    const ns = list.filter((p) => !p.checkedIn).length;
    return { registered: list.length, noShows: ns, rate: pct(ns, list.length) };
  };

  return {
    registered,
    cancelledExcluded: cancelled.length,
    checkedIn: base.filter((p) => p.checkedIn).length,
    checkedInApiOnly: base.filter((p) => p.checkedInApi).length,
    speakerCount: speakers.length,
    nonSpeakerCount: nonSpeakers.length,
    accountable,
    // no-show count WITH all noted groups vs WITHOUT the app-login group
    withAll: { count: allNoShows.length, base: accountable, rate: pct(allNoShows.length, accountable) },
    withoutAppUsers: {
      count: hardNoShows.length,
      base: accountable - appNoCheckin.length,
      rate: pct(hardNoShows.length, accountable - appNoCheckin.length),
    },
    invited: cohort(invited),
    paid: cohort(paid),
    lists: { cancelled, speakersNoCheckin, appNoCheckin, hardNoShows, allNoShows },
  };
}

// ---------- user-journey engagement metrics ----------
export function journeyMetrics(people) {
  if (!people?.length) return {};
  const active = people.filter((p) => p.journey);
  const checkedIn = people.filter((p) => p.checkedIn);
  const checkedInActive = checkedIn.filter((p) => p.journey);
  const noShowEngaged = people.filter((p) => !p.checkedIn && !p.isSpeaker && p.journey);
  const chatUsers = active.filter((p) => p.journey.chatClicks > 0);
  const loginUsers = active.filter((p) => p.journey.logins > 0);
  const notifUsers = active.filter((p) => p.journey.notifClicks > 0);
  const sum = (L, k) => L.reduce((a, p) => a + (p.journey?.[k] || 0), 0);
  const depth = { light: 0, regular: 0, power: 0 };
  for (const p of active) {
    const kinds = p.journey.activityKinds || 0;
    if (kinds >= 4) depth.power += 1;
    else if (kinds >= 2) depth.regular += 1;
    else depth.light += 1;
  }
  return {
    appActiveUsers: active.length,
    appAdoptionRate: (active.length / people.length) * 100,
    checkedInAdoptionRate: checkedIn.length ? (checkedInActive.length / checkedIn.length) * 100 : null,
    activeCheckinRate: active.length ? (active.filter((p) => p.checkedIn).length / active.length) * 100 : null,
    inactiveCheckinRate:
      people.length - active.length
        ? (people.filter((p) => !p.journey && p.checkedIn).length / (people.length - active.length)) * 100
        : null,
    noShowEngagedCount: noShowEngaged.length,
    noShowEngagedList: noShowEngaged,
    chatUsers: chatUsers.length,
    chatUsageRate: checkedIn.length ? (chatUsers.length / checkedIn.length) * 100 : null,
    notifUsers: notifUsers.length,
    notifEngagementRate: active.length ? (notifUsers.length / active.length) * 100 : null,
    totalLogins: sum(people, 'logins'),
    avgLoginsPerActive: loginUsers.length ? sum(people, 'logins') / loginUsers.length : null,
    totalMenuViews: sum(people, 'menuViews'),
    totalChatClicks: sum(people, 'chatClicks'),
    totalNotifClicks: sum(people, 'notifClicks'),
    totalQrScans: sum(people, 'qrScans'),
    depth,
  };
}

// ---------- combined metrics registry ----------
export function buildMetrics({ people, surveyRows, manual }) {
  const reg = peopleMetrics(people);
  const journey = journeyMetrics(people);
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
    returnIntentDist: survey.returnIntentDist ?? { counts: {}, n: 0 },
    pctConnections: survey.pctConnections ?? null,
    pctStrengthened: survey.pctStrengthened ?? null,
    surveyResponses: responses,
    responseRate:
      responses != null && checkedIn ? (responses / checkedIn) * 100 : null,
    // cleaned vFairs cohorts
    registered: reg.overall?.registered ?? null,
    checkedIn,
    noShows: reg.overall?.noShows ?? null,
    accountable: reg.overall?.accountable ?? null,
    speakersNotCheckedIn: reg.overall?.speakersNotCheckedIn ?? null,
    checkinRate: reg.overall?.checkinRate ?? null,
    noShowRate: reg.overall?.noShowRate ?? null,
    invitedNoShowRate: reg.invited?.noShowRate ?? null,
    paidNoShowRate: reg.paid?.noShowRate ?? null,
    speakerCheckinRate: reg.speakers?.checkinRate ?? null,
    // sessions
    peakAttendance: sess.peak,
    avgPlenary: sess.avgPlenary,
    avgBreakout: sess.avgBreakout,
    plenaryRetention: sess.plenaryRetention,
    // app engagement — manual entry overrides journey-derived values
    appAdoptionRate: manual?.appAdoptionRate ?? journey.appAdoptionRate ?? null,
    appAdoptionDerived: journey.appAdoptionRate ?? null,
    pushOpenRate: manual?.pushOpenRate ?? journey.notifEngagementRate ?? null,
    pollParticipation: manual?.pollParticipation ?? null,
    resourceDownloads: manual?.resourceDownloads ?? null,
    sessionOpens: manual?.sessionOpens ?? journey.totalLogins ?? null,
    chatUsageRate: journey.chatUsageRate ?? null,
    noShowEngagedCount: journey.noShowEngagedCount ?? null,
    avgLoginsPerActive: journey.avgLoginsPerActive ?? null,
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
  ['speakerCheckinRate', 'Speaker check-in rate (%)'],
  ['peakAttendance', 'Peak session attendance'],
  ['avgPlenary', 'Avg plenary attendance'],
  ['avgBreakout', 'Avg breakout attendance'],
  ['appAdoptionRate', 'App adoption rate (%)'],
  ['pushOpenRate', 'Push engagement rate (%)'],
  ['chatUsageRate', 'App chat usage (% of attendees)'],
  ['pollParticipation', 'Poll/Q&A participation (%)'],
  ['resourceDownloads', 'Resource downloads (#)'],
  ['sessionOpens', 'App logins (#)'],
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
  met: { label: 'Met', pill: 'bg-[#6CB142] text-white', bar: 'bg-[#6CB142]', text: 'text-[#4e8f2f]' },
  near: { label: 'Near', pill: 'bg-amber-500 text-white', bar: 'bg-amber-500', text: 'text-amber-600' },
  missed: { label: 'Missed', pill: 'bg-red-600 text-white', bar: 'bg-red-600', text: 'text-red-600' },
  nodata: { label: 'No data', pill: 'bg-stone-300 text-stone-700', bar: 'bg-stone-300', text: 'text-stone-500' },
};

export function findingSentence(r) {
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
