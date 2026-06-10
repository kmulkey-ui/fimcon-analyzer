import React from 'react';
import { useApp } from '../state/AppContext';
import { SectionTitle, Card, Btn, fmt } from '../components/ui';
import { METRIC_OPTIONS, DEFAULT_CRITERIA } from '../lib/compute';

export function CriteriaEditor({ compact = false }) {
  const { criteria, setCriteria, metrics } = useApp();

  const update = (id, patch) =>
    setCriteria(criteria.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const remove = (id) => setCriteria(criteria.filter((c) => c.id !== id));
  const move = (i, dir) => {
    const next = [...criteria];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setCriteria(next);
  };
  const add = () =>
    setCriteria([
      ...criteria,
      {
        id: 'c' + Date.now(),
        name: 'New criterion',
        metric: 'avgSatisfaction',
        op: '>=',
        target: 4,
        stretch: null,
        weight: 'medium',
        manualActual: '',
      },
    ]);

  const inp = 'w-full rounded-lg border border-stone-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600';

  return (
    <div className="space-y-3">
      {criteria.map((c, i) => (
        <Card key={c.id} className={compact ? 'p-3' : ''}>
          <div className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-end">
            <label className="col-span-2 sm:col-span-3 text-xs font-medium text-stone-600">
              Name
              <input className={inp} value={c.name} onChange={(e) => update(c.id, { name: e.target.value })} />
            </label>
            <label className="col-span-2 sm:col-span-3 text-xs font-medium text-stone-600">
              Metric
              <select className={inp} value={c.metric} onChange={(e) => update(c.id, { metric: e.target.value })}>
                {METRIC_OPTIONS.map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-stone-600">
              Op
              <select className={inp} value={c.op} onChange={(e) => update(c.id, { op: e.target.value })}>
                <option value=">=">≥</option>
                <option value="<=">≤</option>
                <option value="=">=</option>
              </select>
            </label>
            <label className="text-xs font-medium text-stone-600">
              Target
              <input type="number" step="any" className={inp} value={c.target} onChange={(e) => update(c.id, { target: parseFloat(e.target.value) })} />
            </label>
            <label className="text-xs font-medium text-stone-600">
              Stretch
              <input type="number" step="any" className={inp} value={c.stretch ?? ''} onChange={(e) => update(c.id, { stretch: e.target.value === '' ? null : parseFloat(e.target.value) })} />
            </label>
            <label className="text-xs font-medium text-stone-600">
              Weight
              <select className={inp} value={c.weight} onChange={(e) => update(c.id, { weight: e.target.value })}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
            <label className="text-xs font-medium text-stone-600">
              Manual actual
              <input type="number" step="any" className={inp} placeholder={fmt(metrics[c.metric])} value={c.manualActual ?? ''} onChange={(e) => update(c.id, { manualActual: e.target.value })} />
            </label>
            <div className="col-span-2 sm:col-span-2 flex gap-1 justify-end">
              <Btn variant="ghost" onClick={() => move(i, -1)} aria-label="Move up" className="px-2">↑</Btn>
              <Btn variant="ghost" onClick={() => move(i, 1)} aria-label="Move down" className="px-2">↓</Btn>
              <Btn variant="danger" onClick={() => remove(c.id)} className="px-2" aria-label={`Remove ${c.name}`}>✕</Btn>
            </div>
          </div>
          <p className="text-xs text-stone-400 mt-1.5">
            Live value: <span className="font-semibold text-stone-600">{fmt(metrics[c.metric])}</span>
            {c.manualActual !== '' && c.manualActual != null && ' (overridden by manual actual)'}
          </p>
        </Card>
      ))}
      <div className="flex gap-2">
        <Btn onClick={add}>+ Add criterion</Btn>
        <Btn variant="ghost" onClick={() => setCriteria(DEFAULT_CRITERIA)}>Reset to defaults</Btn>
      </div>
    </div>
  );
}

export default function CriteriaBuilder() {
  return (
    <div>
      <SectionTitle sub="Define what success means for FIMCON 2026. Weights: high = 3, medium = 2, low = 1. Criteria persist across sessions and drive the dashboard, outcomes, and overall score.">
        Success Criteria Builder
      </SectionTitle>
      <CriteriaEditor />
    </div>
  );
}
