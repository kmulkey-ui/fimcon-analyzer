import React, { useState } from 'react';
import { useApp } from '../state/AppContext';
import { Card, SectionTitle, Btn, StatusDot, Spinner } from '../components/ui';
import { PLENARIES, BREAKOUTS } from '../lib/sessions';

const MANUAL_FIELDS = [
  ['appAdoptionRate', 'App adoption rate (%)'],
  ['pushOpenRate', 'Push open rate (%)'],
  ['pollParticipation', 'Poll/Q&A participation (%)'],
  ['resourceDownloads', 'Resource downloads (#)'],
  ['sessionOpens', 'Session opens (#)'],
];

export default function DataInput() {
  const {
    registrants, registrantSource, surveyRows, surveySource,
    fetchVfairs, fetchJotform, uploadSurveyCSV, uploadRegistrantXlsx,
    manual, setManual, priorRows,
  } = useApp();
  const [uploadMsg, setUploadMsg] = useState({});

  const handleFile = async (e, kind) => {
    const file = e.target.files?.[0];
    if (!file) return;
    let err = null;
    if (kind === 'xlsx') err = await uploadRegistrantXlsx(file);
    else err = await uploadSurveyCSV(file, kind === 'prior' ? 'prior' : 'current');
    setUploadMsg((m) => ({ ...m, [kind]: err || 'Loaded successfully.' }));
    e.target.value = '';
  };

  const sync = (s) => s?.syncedAt ? new Date(s.syncedAt).toLocaleString() : '—';

  return (
    <div className="space-y-6">
      <SectionTitle sub="Live API sync status, fallback uploads, and manual engagement entry.">
        Data Input / Sync
      </SectionTitle>

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-stone-800">
              <StatusDot ok={registrants.length > 0 && !registrantSource?.error} /> vFairs API
            </div>
            <Btn variant="ghost" onClick={() => fetchVfairs(true)} disabled={registrantSource?.loading}>
              {registrantSource?.loading ? <Spinner /> : 'Refresh'}
            </Btn>
          </div>
          <dl className="mt-3 text-sm text-stone-600 space-y-1">
            <div className="flex justify-between"><dt>Registrants</dt><dd className="font-semibold text-stone-900">{registrants.length || '—'}</dd></div>
            <div className="flex justify-between"><dt>Last sync</dt><dd>{sync(registrantSource)}</dd></div>
            <div className="flex justify-between"><dt>Source</dt><dd>{registrantSource?.source || '—'}</dd></div>
          </dl>
          {registrantSource?.error && <p className="mt-2 text-xs text-red-600">{registrantSource.error}</p>}
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-stone-800">
              <StatusDot ok={surveyRows.length > 0 && !surveySource?.error} /> Jotform API
            </div>
            <Btn variant="ghost" onClick={() => fetchJotform(true)} disabled={surveySource?.loading}>
              {surveySource?.loading ? <Spinner /> : 'Refresh'}
            </Btn>
          </div>
          <dl className="mt-3 text-sm text-stone-600 space-y-1">
            <div className="flex justify-between"><dt>Form</dt><dd className="font-semibold text-stone-900 truncate max-w-[160px]" title={surveySource?.formTitle}>{surveySource?.formTitle ? 'Found' : surveySource?.source === 'upload' ? 'CSV upload' : '—'}</dd></div>
            <div className="flex justify-between"><dt>Submissions</dt><dd className="font-semibold text-stone-900">{surveyRows.length || '—'}</dd></div>
            <div className="flex justify-between"><dt>Last sync</dt><dd>{sync(surveySource)}</dd></div>
          </dl>
          {surveySource?.error && <p className="mt-2 text-xs text-red-600">{surveySource.error}</p>}
        </Card>

        <Card>
          <div className="flex items-center gap-2 font-semibold text-stone-800">
            <StatusDot ok /> Session data
          </div>
          <dl className="mt-3 text-sm text-stone-600 space-y-1">
            <div className="flex justify-between"><dt>Plenaries / keynotes</dt><dd className="font-semibold text-stone-900">{PLENARIES.length}</dd></div>
            <div className="flex justify-between"><dt>Open breakouts</dt><dd className="font-semibold text-stone-900">{BREAKOUTS.length}</dd></div>
            <div className="flex justify-between"><dt>Source</dt><dd>Pre-loaded manual counts</dd></div>
          </dl>
        </Card>
      </div>

      <Card>
        <h3 className="font-semibold text-stone-800 mb-3">Fallback uploads</h3>
        <div className="grid sm:grid-cols-3 gap-4 text-sm">
          {[
            ['xlsx', 'Registrant export (.xlsx)', '.xlsx'],
            ['csv', 'Survey export (.csv)', '.csv'],
            ['prior', 'Prior-event survey (.csv)', '.csv'],
          ].map(([kind, label, accept]) => (
            <label key={kind} className="block">
              <span className="font-medium text-stone-700">{label}</span>
              <input
                type="file"
                accept={accept}
                onChange={(e) => handleFile(e, kind)}
                className="mt-1.5 block w-full text-xs text-stone-500 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-emerald-50 file:text-emerald-800 file:font-semibold file:cursor-pointer hover:file:bg-emerald-100"
              />
              {uploadMsg[kind] && (
                <p className={`mt-1 text-xs ${uploadMsg[kind].includes('success') ? 'text-emerald-700' : 'text-red-600'}`}>{uploadMsg[kind]}</p>
              )}
            </label>
          ))}
        </div>
        {priorRows.length > 0 && (
          <p className="mt-3 text-xs text-emerald-700">Prior-event survey loaded: {priorRows.length} responses (used in Comparisons).</p>
        )}
      </Card>

      <Card>
        <h3 className="font-semibold text-stone-800 mb-1">Manual entry — app engagement</h3>
        <p className="text-xs text-stone-500 mb-3">These figures are not in the vFairs pull; they feed the metrics registry and the Engagement tab.</p>
        <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {MANUAL_FIELDS.map(([key, label]) => (
            <label key={key} className="block text-sm">
              <span className="font-medium text-stone-700">{label}</span>
              <input
                type="number"
                inputMode="decimal"
                value={manual[key] ?? ''}
                onChange={(e) => setManual({ ...manual, [key]: e.target.value })}
                className="mt-1.5 w-full rounded-lg border border-stone-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </label>
          ))}
        </div>
      </Card>

      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
        Security note: the vFairs and Jotform API keys used to build this tool were shared in plaintext —
        rotate both keys after the build and update <code>.env</code>.
      </p>
    </div>
  );
}
