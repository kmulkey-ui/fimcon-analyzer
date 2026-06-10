import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { DEFAULT_CRITERIA, buildMetrics, evaluateAll, isInvited } from '../lib/compute';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const LS = {
  criteria: 'fimcon.criteria',
  manual: 'fimcon.manual',
  benchmarks: 'fimcon.benchmarks',
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
  const [registrants, setRegistrants] = useState([]);
  const [registrantSource, setRegistrantSource] = useState(null); // {source, syncedAt, error}
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

  const fetchVfairs = useCallback(async (refresh = false) => {
    setRegistrantSource((s) => ({ ...s, loading: true }));
    try {
      const r = await fetch(`/api/vfairs/registrants${refresh ? '?refresh=1' : ''}`);
      const j = await r.json();
      if (j.error && !j.data) throw new Error(j.error);
      setRegistrants(j.data || []);
      setRegistrantSource({ source: j.source, syncedAt: j.syncedAt, error: j.error || null, loading: false });
    } catch (e) {
      setRegistrantSource({ source: null, error: String(e.message), loading: false });
    }
  }, []);

  const fetchJotform = useCallback(async (refresh = false) => {
    setSurveySource((s) => ({ ...s, loading: true }));
    try {
      const r = await fetch(`/api/jotform/submissions${refresh ? '?refresh=1' : ''}`);
      const j = await r.json();
      if (j.error && !j.data) throw new Error(j.error);
      setSurveyRows(j.data?.rows || []);
      setSurveySource({
        source: j.source,
        syncedAt: j.syncedAt,
        formTitle: j.data?.formTitle,
        formId: j.data?.formId,
        error: j.error || null,
        loading: false,
      });
    } catch (e) {
      setSurveySource({ source: null, error: String(e.message), loading: false });
    }
  }, []);

  useEffect(() => {
    fetchVfairs();
    fetchJotform();
  }, [fetchVfairs, fetchJotform]);

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
            setSurveyRows(data);
            setSurveySource({ source: 'upload', syncedAt: new Date().toISOString(), loading: false });
          }
          resolve(null);
        },
        error: (e) => resolve(String(e)),
      });
    });

  const uploadRegistrantXlsx = async (file) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });
    if (!raw.length) return 'Workbook contained no rows.';
    // best-effort column mapping to the normalized registrant shape
    const keys = Object.keys(raw[0]);
    const find = (...pats) =>
      keys.find((k) => pats.some((p) => k.toLowerCase().includes(p)));
    const map = {
      first: find('first name', 'firstname'),
      last: find('last name', 'lastname'),
      email: find('email'),
      ticket: find('ticket', 'package', 'registration type'),
      checkin: find('check-in', 'checked in', 'checkin', 'attendance'),
      state: find('state'),
      org: find('organization', 'company'),
      job: find('job title', 'title'),
      sector: find('describes your primary organization', 'sector'),
      regDate: find('registration date', 'registered'),
    };
    const normalized = raw.map((r, i) => ({
      id: i,
      firstName: r[map.first] || '',
      lastName: r[map.last] || '',
      name: `${r[map.first] || ''} ${r[map.last] || ''}`.trim(),
      email: String(r[map.email] || '').toLowerCase(),
      ticketType: String(r[map.ticket] || 'UNSPECIFIED').trim(),
      checkedIn: /yes|true|1|checked/i.test(String(r[map.checkin] || '')),
      state: r[map.state] || '',
      organization: r[map.org] || '',
      jobTitle: r[map.job] || '',
      sector: r[map.sector] || '',
      registeredAt: r[map.regDate] || null,
    }));
    setRegistrants(normalized);
    setRegistrantSource({ source: 'upload', syncedAt: new Date().toISOString(), loading: false, columnMap: map });
    return null;
  };

  // ---- email join: survey rows -> invited/paid (if survey captures email) ----
  const emailJoin = useMemo(() => {
    if (!surveyRows.length || !registrants.length) return { available: false };
    const keys = Object.keys(surveyRows[0]);
    const emailKey = keys.find((k) => /e-?mail/i.test(k));
    if (!emailKey) return { available: false };
    const regByEmail = new Map(registrants.map((r) => [r.email, r]));
    let joined = 0;
    const tagged = surveyRows.map((row) => {
      const reg = regByEmail.get(String(row[emailKey] || '').toLowerCase().trim());
      if (reg) joined += 1;
      return { row, cohort: reg ? (isInvited(reg.ticketType) ? 'invited' : 'paid') : null };
    });
    return { available: joined > 0, joined, tagged };
  }, [surveyRows, registrants]);

  const metrics = useMemo(
    () => buildMetrics({ registrants, surveyRows, manual: numifyManual(manual) }),
    [registrants, surveyRows, manual]
  );
  const evaluation = useMemo(() => evaluateAll(criteria, metrics), [criteria, metrics]);

  const value = {
    registrants,
    registrantSource,
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
    fetchVfairs,
    fetchJotform,
    uploadSurveyCSV,
    uploadRegistrantXlsx,
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
