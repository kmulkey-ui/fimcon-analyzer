import React, { useState } from 'react';
import { useApp } from '../state/AppContext';
import { SectionTitle, Card, Pill, ProgressBar, Btn, fmt, Spinner } from '../components/ui';
import { round1, findingSentence, registrantMetrics, STATUS_STYLES } from '../lib/compute';

export default function Outcomes() {
  const { evaluation, metrics, registrants, narrative, setNarrative } = useApp();
  const { results, score, rating } = evaluation;
  const [loading, setLoading] = useState(false);

  const generateNarrative = async () => {
    setLoading(true);
    try {
      const reg = registrantMetrics(registrants);
      const res = await fetch('/api/ai/narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score: round1(score),
          rating,
          criteria: results.map((r) => ({
            name: r.name,
            target: `${r.op} ${r.target}`,
            stretch: r.stretch,
            actual: round1(r.actual),
            status: r.status,
            weight: r.weight,
          })),
          attendance: {
            registered: metrics.registered,
            checkedIn: metrics.checkedIn,
            checkinRate: round1(metrics.checkinRate),
            invitedNoShowRate: round1(reg.invited?.noShowRate),
            paidNoShowRate: round1(reg.paid?.noShowRate),
            peakAttendance: metrics.peakAttendance,
            surveyResponses: metrics.surveyResponses,
            avgSatisfaction: round1(metrics.avgSatisfaction),
            avgRecommendationScore: round1(metrics.avgRecommend),
            recommendationScale: metrics.recommendScale,
          },
        }),
      });
      const j = await res.json();
      setNarrative(j.text || j.error);
    } catch (e) {
      setNarrative(String(e.message));
    }
    setLoading(false);
  };

  const delta = (r) => {
    if (r.actual == null) return null;
    const d = r.op === '<=' ? r.target - r.actual : r.actual - r.target;
    return d;
  };

  return (
    <div className="space-y-5">
      <SectionTitle sub="Each success criterion against its target, with template findings and a funder-ready narrative.">
        Outcomes Against Criteria
      </SectionTitle>

      <div className="space-y-3">
        {results.map((r) => {
          const d = delta(r);
          return (
            <Card key={r.id}>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[200px]">
                  <div className="font-semibold text-stone-800">{r.name}</div>
                  <div className="text-xs text-stone-500 mt-0.5">
                    Target {r.op === '<=' ? '≤' : r.op === '>=' ? '≥' : '='} {r.target}
                    {r.stretch != null && <> · stretch {r.stretch}</>}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-extrabold ${STATUS_STYLES[r.status].text}`}>{fmt(r.actual)}</div>
                  {d != null && (
                    <div className={`text-xs font-bold ${d >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      {d >= 0 ? '+' : ''}{round1(d)} vs target
                    </div>
                  )}
                </div>
                <Pill status={r.status} />
              </div>
              <div className="mt-3">
                <ProgressBar perf={r.perf} status={r.status} />
              </div>
              <p className="mt-2.5 text-sm text-stone-600">{findingSentence(r)}</p>
            </Card>
          );
        })}
      </div>

      <Card className="bg-emerald-900 text-white border-emerald-900">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-bold">Funder-ready narrative</h3>
            <p className="text-xs text-emerald-300 mt-0.5">
              Claude writes a 4–6 sentence case-for-success paragraph from the full criteria results — misses framed forward-looking.
            </p>
          </div>
          <Btn onClick={generateNarrative} disabled={loading} className="bg-white !text-emerald-900 hover:bg-emerald-50">
            {loading ? <Spinner /> : narrative ? 'Regenerate narrative' : 'Generate narrative'}
          </Btn>
        </div>
        {narrative && (
          <p className="mt-4 text-sm leading-relaxed bg-emerald-800/60 rounded-lg p-4">{narrative}</p>
        )}
      </Card>
    </div>
  );
}
