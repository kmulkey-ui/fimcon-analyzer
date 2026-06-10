import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import { useApp } from '../state/AppContext';
import { SectionTitle, Card, Tabs, Btn, fmt } from '../components/ui';
import { isInvited, registrantMetrics, round1, downloadCSV } from '../lib/compute';

const TABS = ['By ticket type', 'By state', 'By company', 'Demographics', 'No-show explorer'];

function groupStats(registrants, keyFn) {
  const groups = {};
  for (const r of registrants) {
    const k = keyFn(r) || '(blank)';
    if (!groups[k]) groups[k] = { key: k, registered: 0, checkedIn: 0 };
    groups[k].registered += 1;
    if (r.checkedIn) groups[k].checkedIn += 1;
  }
  return Object.values(groups).map((g) => ({
    ...g,
    noShows: g.registered - g.checkedIn,
    checkinRate: (g.checkedIn / g.registered) * 100,
    noShowRate: 100 - (g.checkedIn / g.registered) * 100,
  }));
}

function CohortCard({ title, data, accent }) {
  return (
    <Card className={`border-t-4 ${accent}`}>
      <h3 className="font-bold text-stone-800">{title}</h3>
      <div className="grid grid-cols-4 gap-2 mt-3 text-center">
        {[
          ['Registered', data?.registered],
          ['Attended', data?.checkedIn],
          ['No-shows', data?.noShows],
          ['No-show rate', fmt(data?.noShowRate, '%')],
        ].map(([l, v]) => (
          <div key={l}>
            <div className="text-2xl font-extrabold text-emerald-900">{v ?? '—'}</div>
            <div className="text-[11px] text-stone-500 font-medium">{l}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function Drilldown() {
  const { registrants } = useApp();
  const [tab, setTab] = useState(TABS[0]);

  const reg = useMemo(() => registrantMetrics(registrants), [registrants]);
  const gap =
    reg.invited?.noShowRate != null && reg.paid?.noShowRate != null
      ? reg.invited.noShowRate - reg.paid.noShowRate
      : null;

  if (!registrants.length)
    return (
      <div>
        <SectionTitle>Attendance &amp; No-Show Drilldown</SectionTitle>
        <Card>No registrant data loaded yet. Sync vFairs or upload the registrant export on the Data Input tab.</Card>
      </div>
    );

  return (
    <div className="space-y-6">
      <SectionTitle sub="Registration, check-in, and no-show performance from vFairs — the steering committee's re-engagement source.">
        Attendance &amp; No-Show Drilldown
      </SectionTitle>

      {/* Top-line */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Registered', reg.overall?.registered],
          ['Checked in', reg.overall?.checkedIn],
          ['No-shows', reg.overall?.noShows],
          ['Check-in rate', fmt(reg.overall?.checkinRate, '%')],
        ].map(([l, v]) => (
          <Card key={l} className="text-center">
            <div className="text-3xl font-extrabold text-emerald-900">{v ?? '—'}</div>
            <div className="text-xs text-stone-500 font-semibold uppercase tracking-wide mt-1">{l}</div>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <CohortCard title="Invited guests (Invited Guest + Friends of FIMCON)" data={reg.invited} accent="border-t-teal-600" />
        <CohortCard title="Paid registrants" data={reg.paid} accent="border-t-emerald-700" />
      </div>

      {gap != null && (
        <p className="text-sm font-semibold text-stone-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
          Invited no-show rate {fmt(reg.invited.noShowRate, '%')} vs paid {fmt(reg.paid.noShowRate, '%')} —{' '}
          <span className="text-amber-700">{round1(Math.abs(gap))} pt gap</span>
          {gap > 0 ? '. Invited guests no-show at a meaningfully higher rate; a re-engagement strategy can close this for the next FIMCON.' : '.'}
        </p>
      )}

      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'By ticket type' && <TicketTab registrants={registrants} />}
      {tab === 'By state' && <StateTab registrants={registrants} />}
      {tab === 'By company' && <CompanyTab registrants={registrants} />}
      {tab === 'Demographics' && <DemographicsTab registrants={registrants} />}
      {tab === 'No-show explorer' && <NoShowExplorer registrants={registrants} />}
    </div>
  );
}

const Th = ({ children, onClick, active, dir }) => (
  <th
    className={`px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide cursor-pointer select-none ${active ? 'text-emerald-800' : 'text-stone-500'}`}
    onClick={onClick}
    aria-sort={active ? (dir === 1 ? 'ascending' : 'descending') : 'none'}
  >
    {children} {active ? (dir === 1 ? '↑' : '↓') : ''}
  </th>
);

function useSort(defaultKey, defaultDir = -1) {
  const [sort, setSort] = useState({ key: defaultKey, dir: defaultDir });
  const toggle = (key) =>
    setSort((s) => ({ key, dir: s.key === key ? -s.dir : -1 }));
  const apply = (rows) =>
    [...rows].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (typeof av === 'string') return sort.dir * av.localeCompare(bv);
      return sort.dir * ((av ?? -Infinity) - (bv ?? -Infinity));
    });
  return { sort, toggle, apply };
}

function TicketTab({ registrants }) {
  const rows = groupStats(registrants, (r) => r.ticketType);
  const { sort, toggle, apply } = useSort('registered');
  return (
    <Card className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="border-b border-stone-200">
          <tr>
            <Th onClick={() => toggle('key')} active={sort.key === 'key'} dir={sort.dir}>Ticket type</Th>
            <Th onClick={() => toggle('registered')} active={sort.key === 'registered'} dir={sort.dir}>Registered</Th>
            <Th onClick={() => toggle('checkedIn')} active={sort.key === 'checkedIn'} dir={sort.dir}>Checked in</Th>
            <Th onClick={() => toggle('noShowRate')} active={sort.key === 'noShowRate'} dir={sort.dir}>No-show rate</Th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-stone-500">Cohort</th>
          </tr>
        </thead>
        <tbody>
          {apply(rows).map((g) => (
            <tr key={g.key} className="border-b border-stone-100 last:border-0">
              <td className="px-3 py-2 font-medium text-stone-800">{g.key}</td>
              <td className="px-3 py-2">{g.registered}</td>
              <td className="px-3 py-2">{g.checkedIn}</td>
              <td className={`px-3 py-2 font-semibold ${g.noShowRate > 20 ? 'text-red-600' : 'text-stone-700'}`}>{fmt(g.noShowRate, '%')}</td>
              <td className="px-3 py-2">
                {isInvited(g.key) ? (
                  <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">Invited</span>
                ) : (
                  <span className="text-xs font-semibold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">Paid</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function StateTab({ registrants }) {
  const all = groupStats(registrants, (r) => (r.state || '').trim());
  const { sort, toggle, apply } = useSort('registered');
  const top15 = [...all].sort((a, b) => b.registered - a.registered).slice(0, 15);
  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-semibold text-stone-800 mb-3">Top 15 states by registrants</h3>
        <ResponsiveContainer width="100%" height={420}>
          <BarChart data={top15} layout="vertical" margin={{ left: 30, right: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="key" width={110} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v, name) => [name === 'registered' ? v : `${round1(v)}%`, name === 'registered' ? 'Registered' : 'Check-in rate']} />
            <Bar dataKey="registered" fill="#047857" radius={[0, 4, 4, 0]} name="registered">
              {top15.map((s) => (
                <Cell key={s.key} fill={s.checkinRate >= 85 ? '#047857' : '#f59e0b'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-stone-400 mt-1">Amber bars indicate a check-in rate below 85%.</p>
      </Card>
      <Card className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-stone-200">
            <tr>
              <Th onClick={() => toggle('key')} active={sort.key === 'key'} dir={sort.dir}>State</Th>
              <Th onClick={() => toggle('registered')} active={sort.key === 'registered'} dir={sort.dir}>Registered</Th>
              <Th onClick={() => toggle('checkedIn')} active={sort.key === 'checkedIn'} dir={sort.dir}>Checked in</Th>
              <Th onClick={() => toggle('checkinRate')} active={sort.key === 'checkinRate'} dir={sort.dir}>Check-in rate</Th>
            </tr>
          </thead>
          <tbody>
            {apply(all).map((g) => (
              <tr key={g.key} className="border-b border-stone-100 last:border-0">
                <td className="px-3 py-2 font-medium text-stone-800">{g.key}</td>
                <td className="px-3 py-2">{g.registered}</td>
                <td className="px-3 py-2">{g.checkedIn}</td>
                <td className="px-3 py-2">{fmt(g.checkinRate, '%')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function CompanyTab({ registrants }) {
  const all = groupStats(registrants, (r) => (r.organization || '').trim());
  const top25 = [...all].sort((a, b) => b.registered - a.registered).slice(0, 25);
  const fullNoShow = all.filter((g) => g.checkedIn === 0 && g.registered >= 1 && g.key !== '(blank)');
  return (
    <div className="space-y-4">
      <Card className="overflow-x-auto">
        <h3 className="font-semibold text-stone-800 mb-3">Top 25 organizations by registrant count</h3>
        <table className="min-w-full text-sm">
          <thead className="border-b border-stone-200">
            <tr>
              {['Organization', 'Registered', 'Checked in', 'Check-in rate'].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase text-stone-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {top25.map((g) => (
              <tr key={g.key} className="border-b border-stone-100 last:border-0">
                <td className="px-3 py-2 font-medium text-stone-800">{g.key}</td>
                <td className="px-3 py-2">{g.registered}</td>
                <td className="px-3 py-2">{g.checkedIn}</td>
                <td className={`px-3 py-2 font-semibold ${g.checkedIn === 0 ? 'text-red-600' : 'text-stone-700'}`}>
                  {fmt(g.checkinRate, '%')}
                  {g.checkedIn === 0 && ' ⚠'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {fullNoShow.length > 0 && (
        <Card>
          <h3 className="font-semibold text-red-700 mb-2">Outreach targets — organizations with 100% no-show ({fullNoShow.length})</h3>
          <p className="text-sm text-stone-600">
            {fullNoShow
              .sort((a, b) => b.registered - a.registered)
              .map((g) => `${g.key} (${g.registered})`)
              .join(' · ')}
          </p>
        </Card>
      )}
    </div>
  );
}

function DemographicsTab({ registrants }) {
  const fields = [
    ['sector', 'Primary organization type'],
    ['jobTitle', 'Job title (top 15)'],
  ];
  return (
    <div className="space-y-4">
      {fields.map(([field, label]) => {
        const groups = groupStats(registrants, (r) => (r[field] || '').trim())
          .filter((g) => g.key !== '(blank)')
          .sort((a, b) => b.registered - a.registered)
          .slice(0, 15);
        if (!groups.length) return null;
        return (
          <Card key={field}>
            <h3 className="font-semibold text-stone-800 mb-3">{label} — registrants &amp; check-in rate</h3>
            <ResponsiveContainer width="100%" height={Math.max(200, groups.length * 32)}>
              <BarChart data={groups} layout="vertical" margin={{ left: 40, right: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="key" width={220} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v) => v}
                  content={({ payload }) =>
                    payload?.length ? (
                      <div className="bg-white border border-stone-200 rounded-lg shadow p-2 text-xs">
                        <div className="font-semibold">{payload[0].payload.key}</div>
                        <div>Registered: {payload[0].payload.registered}</div>
                        <div>Check-in rate: {round1(payload[0].payload.checkinRate)}%</div>
                      </div>
                    ) : null
                  }
                />
                <Bar dataKey="registered" fill="#047857" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        );
      })}
      <p className="text-xs text-stone-400">
        Demographic fields reflect what the vFairs registration form captured: primary organization type, job title, state, and organization.
      </p>
    </div>
  );
}

function NoShowExplorer({ registrants }) {
  const [cohort, setCohort] = useState('all');
  const [q, setQ] = useState('');
  const noShows = registrants.filter((r) => !r.checkedIn);
  const filtered = noShows.filter((r) => {
    if (cohort === 'invited' && !isInvited(r.ticketType)) return false;
    if (cohort === 'paid' && isInvited(r.ticketType)) return false;
    if (q) {
      const hay = `${r.name} ${r.email} ${r.organization} ${r.state} ${r.ticketType}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const exportList = () =>
    downloadCSV(
      `fimcon-2026-no-shows-${cohort}.csv`,
      filtered.map((r) => ({
        Name: r.name,
        Email: r.email,
        Company: r.organization,
        State: r.state,
        'Ticket type': r.ticketType,
        Cohort: isInvited(r.ticketType) ? 'Invited' : 'Paid',
      }))
    );

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h3 className="font-semibold text-stone-800">
          No-show explorer <span className="text-stone-400 font-normal">({filtered.length} of {noShows.length})</span>
        </h3>
        <div className="flex gap-1 ml-auto" role="group" aria-label="Cohort filter">
          {[['all', 'All'], ['invited', 'Invited only'], ['paid', 'Paid only']].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setCohort(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${cohort === v ? 'bg-emerald-700 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
            >
              {l}
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email, company…"
          aria-label="Search no-shows"
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
        />
        <Btn onClick={exportList}>Export CSV</Btn>
      </div>
      <p className="text-xs text-stone-500 mb-3">This is the steering committee's re-engagement list — export respects the active filters.</p>
      <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-stone-200 sticky top-0 bg-white">
            <tr>
              {['Name', 'Email', 'Company', 'State', 'Ticket type', 'Cohort'].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase text-stone-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-stone-100 last:border-0">
                <td className="px-3 py-1.5 font-medium text-stone-800">{r.name}</td>
                <td className="px-3 py-1.5 text-stone-600">{r.email}</td>
                <td className="px-3 py-1.5">{r.organization}</td>
                <td className="px-3 py-1.5">{r.state}</td>
                <td className="px-3 py-1.5 text-xs">{r.ticketType}</td>
                <td className="px-3 py-1.5">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isInvited(r.ticketType) ? 'text-teal-700 bg-teal-50' : 'text-stone-500 bg-stone-100'}`}>
                    {isInvited(r.ticketType) ? 'Invited' : 'Paid'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
