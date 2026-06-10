import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { useApp } from '../state/AppContext';
import { SectionTitle, Card, Stat, Pill, ProgressBar, Btn, fmt } from '../components/ui';
import { round1, STATUS_STYLES, registrantMetrics, downloadCSV, isInvited } from '../lib/compute';

const WEIGHT_LABEL = { high: 'High priority', medium: 'Medium priority', low: 'Low priority' };

export default function Dashboard() {
  const { metrics, evaluation, apiPeople, narrative } = useApp();
  const { results, score, rating } = evaluation;
  const reg = registrantMetrics(apiPeople);
  const printRef = useRef(null);
  const handlePrint = useReactToPrint({ contentRef: printRef, documentTitle: 'FIMCON 2026 Performance Summary' });

  const ratingStyle =
    rating === 'Strong'
      ? 'bg-emerald-600 text-white'
      : rating === 'Moderate'
      ? 'bg-amber-500 text-white'
      : 'bg-red-600 text-white';

  const exportAll = () => {
    const rows = [
      ...results.map((r) => ({
        Type: 'Criterion',
        Name: r.name,
        Target: `${r.op} ${r.target}`,
        Stretch: r.stretch ?? '',
        Actual: fmt(r.actual),
        Status: STATUS_STYLES[r.status].label,
        Weight: r.weight,
      })),
      { Type: 'Summary', Name: 'Overall event score (%)', Actual: fmt(score), Status: rating },
      { Type: 'Cohort', Name: 'Invited guests no-show rate (%)', Actual: fmt(reg.invited?.noShowRate) },
      { Type: 'Cohort', Name: 'Paid registrants no-show rate (%)', Actual: fmt(reg.paid?.noShowRate) },
      { Type: 'Metric', Name: 'Registered', Actual: metrics.registered },
      { Type: 'Metric', Name: 'Checked in', Actual: metrics.checkedIn },
      { Type: 'Metric', Name: 'Survey responses', Actual: metrics.surveyResponses },
      { Type: 'Metric', Name: 'Response rate (%)', Actual: fmt(metrics.responseRate) },
      { Type: 'Metric', Name: `Avg recommendation score (${metrics.recommendScale})`, Actual: fmt(metrics.avgRecommend) },
      { Type: 'Metric', Name: 'Peak session attendance', Actual: metrics.peakAttendance },
    ];
    downloadCSV('fimcon-2026-metrics.csv', rows);
  };

  return (
    <div ref={printRef} className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <SectionTitle sub="Live scorecard for FIMCON 2026 against the success criteria.">
          Performance Dashboard
        </SectionTitle>
        <div className="flex gap-2 no-print">
          <Btn variant="ghost" onClick={exportAll}>Export CSV</Btn>
          <Btn variant="ghost" onClick={handlePrint}>Export PDF</Btn>
        </div>
      </div>

      {/* Overall score */}
      <Card className="bg-emerald-900 text-white border-emerald-900">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-300">Overall event score</div>
            <div className="text-5xl font-extrabold mt-1">{score == null ? '—' : `${round1(score)}%`}</div>
          </div>
          <span className={`px-4 py-2 rounded-full text-sm font-bold ${ratingStyle}`}>{rating}</span>
        </div>
        <p className="text-xs text-emerald-200 mt-3">
          Weighted across {results.filter((r) => r.actual != null).length} criteria with data
          (high = 3, medium = 2, low = 1). Criteria without data are excluded.
        </p>
      </Card>

      {/* Callouts */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat label="Registered" value={metrics.registered ?? '—'} sub="vFairs" />
        <Stat label="Checked in" value={metrics.checkedIn ?? '—'} sub={`${fmt(metrics.checkinRate, '%')} check-in rate`} />
        <Stat label="No-shows" value={metrics.noShows ?? '—'} sub={fmt(metrics.noShowRate, '%')} accent="text-red-600" />
        <Stat label="Survey responses" value={metrics.surveyResponses ?? '—'} sub={`${fmt(metrics.responseRate, '%')} of attendees`} />
        <Stat label="Avg satisfaction" value={fmt(metrics.avgSatisfaction)} sub="of 5" />
        <Stat label="Peak attendance" value={metrics.peakAttendance ?? '—'} sub="Independence Ballroom" />
      </div>

      {/* KPI cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {results.map((r) => (
          <Card key={r.id}>
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-semibold text-stone-800">{r.name}</div>
              <Pill status={r.status} />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className={`text-3xl font-extrabold ${STATUS_STYLES[r.status].text}`}>{fmt(r.actual)}</span>
              <span className="text-sm text-stone-500">
                target {r.op === '<=' ? '≤' : r.op === '>=' ? '≥' : '='} {r.target}
                {r.stretch != null && ` · stretch ${r.stretch}`}
              </span>
            </div>
            <div className="mt-3">
              <ProgressBar perf={r.perf} status={r.status} />
            </div>
            <div className="mt-2 text-xs text-stone-400">{WEIGHT_LABEL[r.weight]}</div>
          </Card>
        ))}
      </div>

      {narrative && (
        <Card>
          <h3 className="font-semibold text-emerald-900 mb-2">Narrative</h3>
          <p className="text-sm text-stone-700 leading-relaxed">{narrative}</p>
        </Card>
      )}
    </div>
  );
}
