import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { DEFAULT_CRITERIA, buildMetrics, evaluateAll, isInvited, noShowBreakdown } from '../lib/compute';
import { STATIC_BUILD } from '../lib/runtime';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const LS = {
  criteria: 'fimcon.criteria',
  manual: 'fimcon.manual',
  benchmarks: 'fimcon.benchmarks',
  survey: 'fimcon.survey', // locally-uploaded survey CSV (published build only)
};
const load = (k, fallback) => {
  try {
    const v = JSON.parse(localStorage.getItem(k));
    return v ?? fallback;
  } catch {
    return fallback;
  }
};

export function AppProvider({ children }) {
  // Cleaned, deduped people (API + xlsx merge with hygiene rules applied)
  const [people, setPeople] = useState([]);
  const [hygiene, setHygiene] = useState(null);
  const [checkinFlow, setCheckinFlow] = useState({});
  const [journeySummary, setJourneySummary] = useState({});
  const [registrationTimeline, setRegistrationTimeline] = useState([]);
  const [peopleSource, setPeopleSource] = useState(null);

  const [surveyRows, setSurveyRows] = useState([]);
  const [surveySource, setSurveySource] = useState(null);
  const [priorRows, setPriorRows] = useState([]);
  const [criteria, setCriteria] = useState(() => load(LS.criteria, DEFAULT_CRITERIA));
  const [manual, setManual] = useState(() =>
    load(LS.manual, { appAdoptionRate: '', pushOpenRate: '', pollParticipation: '', resourceDownloads: '', sessionOpens: '' })
  );
  const [benchmarks, setBenchmarks] = useState(() =>
    load(LS.benchmarks, { pushOpenRate: 60, appAdoptionRate: 70, pollParticipation: 30 })
  );
  const [narrative, setNarrative] = useState('');
  const [criteriaOpen, setCriteriaOpen] = useState(false);

  useEffect(() => localStorage.setItem(LS.criteria, JSON.stringify(criteria)), [criteria]);
  useEffect(() => localStorage.setItem(LS.manual, JSON.stringify(manual)), [manual]);
  useEffect(() => localStorage.setItem(LS.benchmarks, JSON.stringify(benchmarks)), [benchmarks]);

  const fetchPeople = useCallback(async (refresh = false) => {
    setPeopleSource((s) => ({ ...s, loading: true }));
    try {
      // Published build: load the baked, PII-stripped snapshot (no backend).
      // Local dev: pull live from the Express/vFairs API.
      const url = STATIC_BUILD ? '/data/people.json' : `/api/vfairs/people${refresh ? '?refresh=1' : ''}`;
      const r = await fetch(url);
      const j = await r.json();
      if (j.error && !j.data) throw new Error(j.error);
      setPeople(j.data.people || []);
      setHygiene(j.data.hygiene || null);
      setCheckinFlow(j.data.checkinFlow || {});
      setJourneySummary(j.data.journeySummary || {});
      setRegistrationTimeline(j.data.registrationTimeline || []);
      setPeopleSource({ source: STATIC_BUILD ? 'snapshot' : j.source, syncedAt: j.syncedAt, apiError: j.apiError || null, error: j.error || null, loading: false });
    } catch (e) {
      setPeopleSource({ source: null, error: String(e.message), loading: false });
    }
  }, []);

  const fetchJotform = useCallback(async (refresh = false) => {
    setSurveySource((s) => ({ ...s, loading: true }));
    try {
      const url = STATIC_BUILD ? '/data/jotform.json' : `/api/jotform/submissions${refresh ? '?refresh=1' : ''}`;
      const r = await fetch(url);
      const j = await r.json();
      if (j.error && !j.data) throw new Error(j.error);
      let rows = j.data?.rows || [];
      let syncedAt = j.syncedAt;
      let source = STATIC_BUILD ? 'snapshot' : j.source;
      let formTitle = j.data?.formTitle;
      // Published build: if the user uploaded a newer survey CSV in this browser,
      // prefer it over the baked baseline (lets responses be topped up post-deploy).
      if (STATIC_BUILD) {
        const up = load(LS.survey, null);
        if (up?.rows?.length && (!syncedAt || new Date(up.syncedAt) >= new Date(syncedAt))) {
          rows = up.rows;
          syncedAt = up.syncedAt;
          source = 'upload';
          formTitle = up.formTitle || formTitle;
        }
      }
      setSurveyRows(rows);
      setSurveySource({
        source,
        syncedAt,
        formTitle,
        formId: j.data?.formId,
        error: j.error || null,
        loading: false,
      });
    } catch (e) {
      setSurveySource({ source: null, error: String(e.message), loading: false });
    }
  }, []);

  // Published build: clear a locally-uploaded survey CSV and fall back to the
  // baked snapshot baseline.
  const clearSurveyUpload = useCallback(() => {
    try { localStorage.removeItem(LS.survey); } catch { /* ignore */ }
    fetchJotform();
  }, [fetchJotform]);

  useEffect(() => {
    fetchPeople();
    fetchJotform();
  }, [fetchPeople, fetchJotform]);

  // ---- fallback uploads ----
  const validateSurvey = (rows) => {
    if (!rows.length) return 'File contained no rows.';
    const keys = Object.keys(rows[0]).map((k) => k.trim());
    const missing = [1, 2, 3, 19, 20].filter((n) => !keys.some((k) => k.startsWith(n + '.')));
    if (missing.length)
      return `This does not look like the FIMCON post-conference survey export — missing question column(s) ${missing.join(', ')}. Expected headers numbered "1." through "22.".`;
    return null;
  };

  const uploadSurveyCSV = (file, target = 'current') =>
    new Promise((resolve) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: ({ data }) => {
          const err = validateSurvey(data);
          if (err) return resolve(err);
          if (target === 'prior') setPriorRows(data);
          else {
            const syncedAt = new Date().toISOString();
            setSurveyRows(data);
            // Published build: persist so the topped-up survey survives reloads in
            // this browser (no backend to store it server-side).
            if (STATIC_BUILD) {
              try {
                localStorage.setItem(LS.survey, JSON.stringify({ syncedAt, rows: data, formTitle: 'Uploaded CSV' }));
              } catch { /* quota / private mode — keep in-memory only */ }
            }
            setSurveySource({ source: 'upload', syncedAt, formTitle: 'Uploaded CSV', loading: false });
          }
          resolve(null);
        },
        error: (e) => resolve(String(e)),
      });
    });

  // Fallback registrant xlsx upload → maps to the same people shape (roles
  // unknown unless a User Role column exists; no journey data).
  const uploadRegistrantXlsx = async (file) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });
    if (!raw.length) return 'Workbook contained no rows.';
    const keys = Object.keys(raw[0]);
    const find = (...pats) =>
      keys.find((k) => pats.some((p) => k.toLowerCase().includes(p)));
    const map = {
      first: find('first name', 'firstname'),
      last: find('last name', 'lastname'),
      email: find('email'),
      ticket: find('ticket', 'package', 'registration type'),
      checkin: find('check-in', 'checked in', 'checkin', 'attendance'),
      role: find('user role', 'role'),
      state: find('state'),
      org: find('organization', 'company'),
      job: find('job title', 'title'),
      sector: find('describes your primary organization', 'sector'),
      regDate: find('registration date', 'date registered', 'registered'),
    };
    const seen = new Set();
    const normalized = [];
    for (const [i, r] of raw.entries()) {
      const email = String(r[map.email] || '').toLowerCase().trim();
      if (email && seen.has(email)) continue;
      seen.add(email);
      const role = String(r[map.role] || 'Attendee').trim();
      normalized.push({
        id: i,
        firstName: r[map.first] || '',
        lastName: r[map.last] || '',
        name: `${r[map.first] || ''} ${r[map.last] || ''}`.trim(),
        email,
        roles: [role],
        role,
        isSpeaker: /speaker/i.test(role),
        ticketType: String(r[map.ticket] || '').trim() || null,
        checkedIn: /yes|true|1|checked/i.test(String(r[map.checkin] || '')),
        state: r[map.state] || '',
        organization: r[map.org] || '',
        jobTitle: r[map.job] || '',
        sector: r[map.sector] || '',
        registeredAt: r[map.regDate] || null,
        journey: null,
      });
    }
    setPeople(normalized);
    setHygiene(null);
    setPeopleSource({ source: 'upload', syncedAt: new Date().toISOString(), loading: false, columnMap: map });
    return null;
  };

  // ---- email join: survey rows -> invited/paid (if survey captures email) ----
  const emailJoin = useMemo(() => {
    if (!surveyRows.length || !people.length) return { available: false };
    const keys = Object.keys(surveyRows[0]);
    const emailKey = keys.find((k) => /e-?mail/i.test(k));
    if (!emailKey) return { available: false };
    const regByEmail = new Map(people.map((p) => [p.email, p]));
    let joined = 0;
    const tagged = surveyRows.map((row) => {
      const reg = regByEmail.get(String(row[emailKey] || '').toLowerCase().trim());
      if (reg) joined += 1;
      return { row, cohort: reg ? (isInvited(reg.ticketType) ? 'invited' : 'paid') : null };
    });
    return { available: joined > 0, joined, tagged };
  }, [surveyRows, people]);

  // Registration vs. no-show base = the live vFairs API pull only. People in the
  // historical xlsx snapshot but absent from the API (cancelled/withdrawn) are
  // dropped. Falls back to the full set when no API flag is present (xlsx upload).
  const apiPeople = useMemo(() => {
    const apiKnown = people.some((p) => p.apiRegistered);
    return apiKnown ? people.filter((p) => p.apiRegistered) : people;
  }, [people]);

  const noShowAnalysis = useMemo(() => noShowBreakdown(people), [people]);

  const metrics = useMemo(
    () => buildMetrics({ people: apiPeople, surveyRows, manual: numifyManual(manual) }),
    [apiPeople, surveyRows, manual]
  );
  const evaluation = useMemo(() => evaluateAll(criteria, metrics), [criteria, metrics]);

  const value = {
    people,
    apiPeople,
    noShowAnalysis,
    hygiene,
    checkinFlow,
    journeySummary,
    registrationTimeline,
    peopleSource,
    surveyRows,
    surveySource,
    priorRows,
    setPriorRows,
    criteria,
    setCriteria,
    manual,
    setManual,
    benchmarks,
    setBenchmarks,
    metrics,
    evaluation,
    emailJoin,
    narrative,
    setNarrative,
    criteriaOpen,
    setCriteriaOpen,
    fetchPeople,
    fetchJotform,
    clearSurveyUpload,
    uploadSurveyCSV,
    uploadRegistrantXlsx,
    staticBuild: STATIC_BUILD,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function numifyManual(m) {
  const o = {};
  for (const [k, v] of Object.entries(m)) {
    const n = parseFloat(v);
    o[k] = Number.isFinite(n) ? n : null;
  }
  return o;
}
