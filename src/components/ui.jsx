import React from 'react';
import { round1, STATUS_STYLES } from '../lib/compute';

export const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-xl border border-stone-200 shadow-sm p-5 ${className}`}>{children}</div>
);

export const SectionTitle = ({ children, sub }) => (
  <div className="mb-5">
    <h2 className="text-xl font-bold text-brand-navy">{children}</h2>
    {sub && <p className="text-sm text-stone-500 mt-1">{sub}</p>}
  </div>
);

export const Stat = ({ label, value, sub, accent = 'text-brand-navy' }) => (
  <Card>
    <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</div>
    <div className={`text-3xl font-extrabold mt-1 ${accent}`}>{value ?? '—'}</div>
    {sub && <div className="text-xs text-stone-500 mt-1">{sub}</div>}
  </Card>
);

export const Pill = ({ status }) => {
  const s = STATUS_STYLES[status] || STATUS_STYLES.nodata;
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.pill}`}>
      {s.label}
    </span>
  );
};

export const ProgressBar = ({ perf, status }) => {
  const s = STATUS_STYLES[status] || STATUS_STYLES.nodata;
  return (
    <div className="h-2 rounded-full bg-stone-100 overflow-hidden" role="progressbar" aria-valuenow={perf == null ? 0 : Math.round(perf * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full ${s.bar} transition-all`} style={{ width: `${(perf ?? 0) * 100}%` }} />
    </div>
  );
};

export const Btn = ({ children, onClick, variant = 'primary', disabled, className = '', ...rest }) => {
  const styles = {
    primary: 'bg-brand-navy hover:bg-brand-navydark text-white',
    green: 'bg-brand-green hover:bg-brand-greendark text-white',
    ghost: 'bg-white border border-stone-300 hover:bg-stone-50 text-stone-700',
    danger: 'bg-white border border-red-300 hover:bg-red-50 text-red-700',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${styles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
};

export const Tabs = ({ tabs, active, onChange }) => (
  <div className="flex gap-1 border-b border-stone-200 mb-5 overflow-x-auto" role="tablist">
    {tabs.map((t) => (
      <button
        key={t}
        role="tab"
        aria-selected={active === t}
        onClick={() => onChange(t)}
        className={`px-4 py-2 text-sm font-semibold whitespace-nowrap rounded-t-lg cursor-pointer border-b-2 -mb-px transition-colors ${
          active === t
            ? 'border-brand-green text-brand-navy bg-brand-greenlight'
            : 'border-transparent text-stone-500 hover:text-stone-800'
        }`}
      >
        {t}
      </button>
    ))}
  </div>
);

export const fmt = (v, suffix = '') => (v == null ? '—' : `${round1(v)}${suffix}`);

export const StatusDot = ({ ok }) => (
  <span
    aria-label={ok ? 'connected' : 'not connected'}
    className={`inline-block w-2.5 h-2.5 rounded-full ${ok ? 'bg-brand-green' : 'bg-red-500'}`}
  />
);

export const Spinner = () => (
  <span className="inline-block w-4 h-4 border-2 border-brand-navy border-t-transparent rounded-full animate-spin align-middle" aria-label="loading" />
);

// Small labeled big-number tile used across drilldowns
export const Tile = ({ value, label, sub, accent = 'text-brand-navy' }) => (
  <div className="bg-stone-50 rounded-lg p-3 text-center">
    <div className={`text-2xl font-extrabold ${accent}`}>{value ?? '—'}</div>
    <div className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide mt-0.5">{label}</div>
    {sub && <div className="text-[11px] text-stone-400 mt-0.5">{sub}</div>}
  </div>
);
