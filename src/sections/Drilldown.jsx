import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
  AreaChart, Area,
} from 'recharts';
import { useApp } from '../state/AppContext';
import { SectionTitle, Card, Tabs, Btn, fmt, Tile } from '../components/ui';
import { isInvited, peopleMetrics, round1, downloadCSV } from '../lib/compute';
import { ANONYMIZED } from '../lib/runtime';

const TABS = ['By ticket type', 'By state', 'By company', 'Demographics', 'No-show explorer', 'Speakers'];
const NAVY = '#0d4d8c';
const GREEN = '#6CB142';
const ORANGE = '#F58220';

function groupStats(list, keyFn) {
  const groups = {};
  for (const r of list) {
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

function CohortCard({ title, sub, data, accent, extra }) {
  return (
    <Card className={`border-t-4 ${accent}`}>
      <h3 className="font-bold text-stone-800">{title}</h3>
      {sub && <p className="text-xs text-stone-400 mt-0.5">{sub}</p>}
      <div className="grid grid-cols-4 gap-2 mt-3 text-center">
        {[
          ['Registered', data?.registered],
          ['Attended', data?.checkedIn],
          [extra?.noShowLabel || 'No-shows', extra?.noShowValue ?? data?.noShows],
          [extra?.rateLabel || 'No-show rate', extra?.rateValue ?? fmt(data?.noShowRate, '%')],
        ].map(([l, v]) => (
          <div key={l}>
            <div className="text-2xl font-extrabold text-brand-navy">{v ?? '—'}</div>
            <div className="text-[11px] text-stone-500 font-medium">{l}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Peruse-able name list with CSV export, collapsed by default.
// Public build: names/emails/orgs are stripped from the published data, so
// render the count + context only — no roster, no export.
function NameList({ title, sub, people, accent = 'text-stone-700', filename }) {
  const [open, setOpen] = useState(false);
  if (ANONYMIZED) {
    return (
      <div className="border border-stone-200 rounded-lg px-3 py-2.5">
        <span className="text-sm font-semibold text-stone-800">
          {title} <span className={`${accent} font-extrabold`}>({people.length})</span>
        </span>
        {sub && <p className="text-xs text-stone-400 mt-0.5">{sub}</p>}
        <p className="text-[11px] text-stone-400 mt-1">Individual names are available in the internal version only.</p>
      </div>
    );
  }
  const exportList = () =>
    downloadCSV(
      filename,
      people.map((p) => ({
        Name: p.name,
        Email: p.email,
        Organization: p.organization || '',
        'Ticket type': p.ticketType || '',
        Role: p.role || (p.isSpeaker ? 'Speaker' : 'Attendee'),
        'App logins': p.journey?.logins ?? 0,
      }))
    );
  return (
    <div className="border border-stone-200 rounded-lg">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left cursor-pointer hover:bg-stone-50"
      >
        <span className="text-sm font-semibold text-stone-800">
          {title} <span className={`${accent} font-extrabold`}>({people.length})</span>
        </span>
        <span className="text-xs text-stone-400">{open ? 'Hide ▲' : 'Show names ▼'}</span>
      </button>
      {sub && <p className="px-3 -mt-1 pb-2 text-xs text-stone-400">{sub}</p>}
      {open && (
        <div className="border-t border-stone-100">
          <div className="flex justify-end px-3 py-2">
            <Btn variant="ghost" onClick={exportList}>Export CSV</Btn>
          </div>
          <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-stone-200 sticky top-0 bg-white">
                <tr>
                  {['Name', 'Organization', 'Ticket / role', 'App logins'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase text-stone-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.email || p.id} className="border-b border-stone-100 last:border-0">
                    <td className="px-3 py-1.5 font-medium text-stone-800">{p.name}</td>
                    <td className="px-3 py-1.5 text-stone-600">{p.organization || '—'}</td>
                    <td className="px-3 py-1.5 text-xs text-stone-500">{p.ticketType || (p.isSpeaker ? 'Speaker' : '—')}</td>
                    <td className="px-3 py-1.5">{p.journey?.logins ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function NoShowAnalysisCard({ a }) {
  const pc = (n) => (n == null ? '—' : `${round1(n)}%`);
  return (
    <Card className="border-l-4 border-l-brand-navy">
      <h3 className="font-bold text-stone-800">No-show calculation — with &amp; without noted groups</h3>
      <p className="text-xs text-stone-400 mt-0.5">
        Base is the {a.registered}-person vFairs API pull. {a.cancelledExcluded} cancelled/withdrawn registrations
        were excluded. {a.checkedIn} checked in (badge or app); the API&apos;s own check-in flag alone shows {a.checkedInApiOnly} — the
        {' '}{a.checkedIn - a.checkedInApiOnly}-person gap is people who badge-scanned on site but weren&apos;t flagged in the API.
      </p>

      <div className="grid sm:grid-cols-2 gap-3 mt-4">
        <div className="bg-stone-50 rounded-lg p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">No-shows — with app-engaged included</div>
          <div className="text-3xl font-extrabold text-brand-navy mt-1">{a.withAll.count}</div>
          <div className="text-sm text-stone-500">{pc(a.withAll.rate)} of {a.withAll.base} accountable (excl. {a.speakerCount ? a.lists.speakersNoCheckin.length : 0} unbadged speakers)</div>
        </div>
        <div className="bg-brand-greenlight rounded-lg p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-brand-greendark">No-shows — excluding app-engaged (likely attended)</div>
          <div className="text-3xl font-extrabold text-brand-greendark mt-1">{a.withoutAppUsers.count}</div>
          <div className="text-sm text-stone-600">{pc(a.withoutAppUsers.rate)} of {a.withoutAppUsers.base} · sets aside {a.lists.appNoCheckin.length} who used the app but never badged</div>
        </div>
      </div>

      <p className="text-sm text-stone-600 mt-3">
        Invited guests: <span className="font-semibold">{a.invited.noShows}/{a.invited.registered}</span> no-show ({pc(a.invited.rate)}) ·
        Paid: <span className="font-semibold">{a.paid.noShows}/{a.paid.registered}</span> ({pc(a.paid.rate)}).
      </p>

      <div className="space-y-2 mt-4">
        <NameList
          title="Cancelled / withdrawn — excluded from the base"
          sub="In the historical export but absent from the live vFairs API (cancelled in the registration system)."
          people={a.lists.cancelled}
          accent="text-red-600"
          filename="fimcon-2026-cancelled-excluded.csv"
        />
        <NameList
          title="Speakers without a badge check-in — not counted as no-shows"
          sub="Acknowledged separately; most presented and departed without badging in."
          people={a.lists.speakersNoCheckin}
          accent="text-brand-orange"
          filename="fimcon-2026-speakers-not-badged.csv"
        />
        <NameList
          title="Used the event app but never checked in — likely present, missed the scanner"
          sub="Non-speakers with app logins but no badge scan. Shown with and without in the no-show counts above."
          people={a.lists.appNoCheckin}
          accent="text-brand-navy"
          filename="fimcon-2026-app-login-no-checkin.csv"
        />
      </div>
    </Card>
  );
}

export default function Drilldown() {
  const { apiPeople: people, hygiene, checkinFlow, registrationTimeline, noShowAnalysis } = useApp();
  // Public build: drop the organization-name tab (orgs are stripped for privacy).
  const tabs = ANONYMIZED ? TABS.filter((t) => t !== 'By company') : TABS;
  const [tab, setTab] = useState(tabs[0]);

  const reg = useMemo(() => peopleMetrics(people), [people]);
  const nonSpeakers = useMemo(() => people.filter((p) => !p.isSpeaker), [people]);
  const gap =
    reg.invited?.noShowRate != null && reg.paid?.noShowRate != null
      ? reg.invited.noShowRate - reg.paid.noShowRate
      : null;

  if (!people.length)
    return (
      <div>
        <SectionTitle>Attendance &amp; No-Show Drilldown</SectionTitle>
        <Card>No registrant data loaded yet. Sync vFairs or upload the registrant export on the Data Input tab.</Card>
      </div>
    );

  const flowData = Object.entries(checkinFlow)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({
      date,
      label:
        date === '2026-05-31' ? 'May 31 · early badge pickup' : date === '2026-06-01' ? 'Jun 1 · Day 1' : date === '2026-06-02' ? 'Jun 2 · Day 2' : date,
      count,
    }));

  return (
    <div className="space-y-6">
      <SectionTitle sub="Registration, check-in, and no-show performance. Base = the live vFairs API pull (currently-registered attendees only); cancelled/withdrawn registrations and platform/staff accounts are excluded, and duplicate speaker records merged.">
        Attendance &amp; No-Show Drilldown
      </SectionTitle>

      {noShowAnalysis && <NoShowAnalysisCard a={noShowAnalysis} />}

      {/* Top-line on the cleaned base */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          ['Unique registrants', reg.overall?.registered, 'after data cleaning'],
          ['Checked in', reg.overall?.checkedIn, 'badge or app check-in'],
          ['True no-shows', reg.overall?.noShows, 'excludes speakers'],
          ['Check-in rate', fmt(reg.overall?.checkinRate, '%'), `of ${reg.overall?.accountable} accountable`],
          ['Speakers not badged', reg.overall?.speakersNotCheckedIn, 'acknowledged below'],
        ].map(([l, v, sub]) => (
          <Card key={l} className="text-center">
            <div className="text-3xl font-extrabold text-brand-navy">{v ?? '—'}</div>
            <div className="text-xs text-stone-500 font-semibold uppercase tracking-wide mt-1">{l}</div>
            <div className="text-[11px] text-stone-400 mt-0.5">{sub}</div>
          </Card>
        ))}
      </div>

      {/* Cohort cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <CohortCard
          title="Invited guests"
          sub="Invited Guest + Friends of FIMCON tickets (non-speakers)"
          data={reg.invited}
          accent="border-t-brand-green"
        />
        <CohortCard
          title="Paid registrants"
          sub="General admission + comp codes (non-speakers)"
          data={reg.paid}
          accent="border-t-brand-navy"
        />
        <CohortCard
          title="Speakers"
          sub="Unique speaker registrations (dual records merged)"
          data={{ registered: reg.speakers?.registered, checkedIn: reg.speakers?.checkedIn }}
          accent="border-t-brand-orange"
          extra={{
            noShowLabel: 'Not badged',
            noShowValue: reg.speakers?.notCheckedIn,
            rateLabel: 'Badge rate',
            rateValue: fmt(reg.speakers?.checkinRate, '%'),
          }}
        />
      </div>

      {gap != null && (
        <p className="text-sm font-semibold text-stone-700 bg-brand-orangelight border border-orange-200 rounded-lg p-3">
          Invited no-show rate {fmt(reg.invited.noShowRate, '%')} vs paid {fmt(reg.paid.noShowRate, '%')} —{' '}
          <span className="text-brand-orange">{round1(Math.abs(gap))} pt gap</span>
          {gap > 0
            ? '. Invited guests no-show at a higher rate; the no-show explorer below is the re-engagement list for closing this gap at the next FIMCON.'
            : '.'}
        </p>
      )}

      {/* Check-in flow + registration timeline */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-semibold text-stone-800 mb-1">Check-in flow by day</h3>
          <p className="text-xs text-stone-400 mb-3">First badge check-in per person. Early pickup on May 31 absorbed {flowData[0]?.count ?? '—'} arrivals — a logistics win that kept Day 1 lines short.</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={flowData} margin={{ left: 0, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip formatter={(v) => [v, 'Check-ins']} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {flowData.map((d, i) => (
                  <Cell key={d.date} fill={[ORANGE, NAVY, GREEN][i % 3]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <h3 className="font-semibold text-stone-800 mb-1">Registration momentum</h3>
          <p className="text-xs text-stone-400 mb-3">Cumulative unique registrations over time — useful for pacing the next FIMCON's marketing pushes.</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={registrationTimeline} margin={{ left: 0, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={40} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v, n) => [v, n === 'cumulative' ? 'Total registered' : 'That day']} />
              <Area type="monotone" dataKey="cumulative" stroke={NAVY} fill="#dbeafe" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Data hygiene transparency */}
      {hygiene && (
        <Card className="bg-stone-50">
          <h3 className="font-semibold text-stone-800 mb-2">Data cleaning applied</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Tile value={hygiene.rawRows} label="Raw export rows" />
            <Tile value={hygiene.duplicateRowsMerged} label="Duplicate rows merged" sub={`${hygiene.speakerAttendeeMerged} speaker+attendee pairs`} />
            <Tile value={hygiene.vfairsStaffExcluded} label="vFairs accounts excluded" accent="text-brand-orange" />
            <Tile value={hygiene.arbStaffExcluded} label="ARB staff excluded" accent="text-brand-orange" />
            <Tile
              value={Object.values(hygiene.staffRolesExcluded || {}).reduce((a, b) => a + b, 0)}
              label="Staff roles excluded"
              sub={Object.entries(hygiene.staffRolesExcluded || {}).map(([k, v]) => `${k} ${v}`).join(' · ') || 'none'}
              accent="text-brand-orange"
            />
            <Tile value={hygiene.included} label="Unique real registrants" accent="text-brand-greendark" />
          </div>
          <p className="text-xs text-stone-400 mt-3">
            Exclusions: vfairs.com and arbmeetings.com email domains, plus Admin / Event Owner / Booth Admin platform roles. People with both a Speaker and an Attendee record are counted once as a Speaker.
          </p>
        </Card>
      )}

      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === 'By ticket type' && <TicketTab people={nonSpeakers} speakers={reg.speakers} />}
      {tab === 'By state' && <StateTab people={people} />}
      {tab === 'By company' && <CompanyTab people={people} />}
      {tab === 'Demographics' && <DemographicsTab people={people} />}
      {tab === 'No-show explorer' && <NoShowExplorer people={people} />}
      {tab === 'Speakers' && <SpeakersTab reg={reg} />}
    </div>
  );
}

const Th = ({ children, onClick, active, dir }) => (
  <th
    className={`px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide cursor-pointer select-none ${active ? 'text-brand-navy' : 'text-stone-500'}`}
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

function TicketTab({ people, speakers }) {
  const rows = groupStats(people, (r) => r.ticketType || '(no ticket on file)');
  const { sort, toggle, apply } = useSort('registered');
  return (
    <div className="space-y-3">
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
                    <span className="text-xs font-semibold text-brand-greendark bg-brand-greenlight px-2 py-0.5 rounded-full">Invited</span>
                  ) : (
                    <span className="text-xs font-semibold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">Paid</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-stone-400">
        Speakers ({speakers?.registered}) are tracked as their own cohort and excluded from this ticket-type table; many registered through speaker management rather than ticketing.
      </p>
    </div>
  );
}

function StateTab({ people }) {
  const withState = people.filter((p) => (p.state || '').trim());
  const all = groupStats(withState, (r) => (r.state || '').trim());
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
            <Tooltip
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
            <Bar dataKey="registered" radius={[0, 4, 4, 0]}>
              {top15.map((s) => (
                <Cell key={s.key} fill={s.checkinRate >= 85 ? NAVY : ORANGE} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-stone-400 mt-1">Orange bars indicate a check-in rate below 85%. State comes from the vFairs registration form (speakers without a form record are omitted).</p>
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

function CompanyTab({ people }) {
  const withOrg = people.filter((p) => (p.organization || '').trim());
  const all = groupStats(withOrg, (r) => (r.organization || '').trim());
  const top25 = [...all].sort((a, b) => b.registered - a.registered).slice(0, 25);
  const fullNoShow = all.filter((g) => g.checkedIn === 0 && g.key !== '(blank)');
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

function DemographicsTab({ people }) {
  const fields = [
    ['role', 'User role'],
    ['sector', 'Primary organization type'],
    ['jobTitle', 'Job title (top 15)'],
  ];
  return (
    <div className="space-y-4">
      {fields.map(([field, label]) => {
        const withField = people.filter((p) => (p[field] || '').trim());
        const groups = groupStats(withField, (r) => (r[field] || '').trim())
          .sort((a, b) => b.registered - a.registered)
          .slice(0, 15);
        if (!groups.length) return null;
        return (
          <Card key={field}>
            <h3 className="font-semibold text-stone-800 mb-3">{label} — registrants &amp; check-in rate</h3>
            <ResponsiveContainer width="100%" height={Math.max(160, groups.length * 32)}>
              <BarChart data={groups} layout="vertical" margin={{ left: 40, right: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="key" width={220} tick={{ fontSize: 11 }} />
                <Tooltip
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
                <Bar dataKey="registered" fill={GREEN} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        );
      })}
      <p className="text-xs text-stone-400">
        Demographic fields reflect what the vFairs registration form captured: role, primary organization type, job title, state, and organization.
      </p>
    </div>
  );
}

function NoShowExplorer({ people }) {
  const [cohort, setCohort] = useState('all');
  const [q, setQ] = useState('');
  // True no-shows only: speakers who didn't badge are acknowledged in the Speakers tab.
  const noShows = people.filter((r) => !r.checkedIn && !r.isSpeaker);

  // Public build: the re-engagement roster is personal data — show the aggregate
  // picture only and point to the internal version for the named list.
  if (ANONYMIZED) {
    const invited = noShows.filter((r) => isInvited(r.ticketType));
    const engaged = noShows.filter((r) => r.journey);
    const byState = {};
    for (const r of noShows) {
      const s = (r.state || '').trim() || '(not provided)';
      byState[s] = (byState[s] || 0) + 1;
    }
    const topStates = Object.entries(byState).sort((a, b) => b[1] - a[1]).slice(0, 8);
    return (
      <Card>
        <h3 className="font-semibold text-stone-800 mb-1">No-show overview <span className="text-stone-400 font-normal">({noShows.length} people)</span></h3>
        <p className="text-xs text-stone-500 mb-4">
          The named re-engagement list (names, emails, organizations) is available in the internal version only —
          this public view shows the aggregate picture.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Tile value={noShows.length} label="Total no-shows" />
          <Tile value={invited.length} label="Invited cohort" accent="text-brand-greendark" />
          <Tile value={noShows.length - invited.length} label="Paid cohort" accent="text-brand-navy" />
          <Tile value={engaged.length} label="Used the event app" sub="warmest re-engagement targets" accent="text-brand-orange" />
        </div>
        {topStates.length > 0 && (
          <div className="mt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">Top states among no-shows</h4>
            <p className="text-sm text-stone-600">{topStates.map(([s, n]) => `${s} (${n})`).join(' · ')}</p>
          </div>
        )}
      </Card>
    );
  }
  const filtered = noShows.filter((r) => {
    if (cohort === 'invited' && !isInvited(r.ticketType)) return false;
    if (cohort === 'paid' && isInvited(r.ticketType)) return false;
    if (cohort === 'engaged' && !r.journey) return false;
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
        'Ticket type': r.ticketType || '',
        Cohort: isInvited(r.ticketType) ? 'Invited' : 'Paid',
        'Used event app': r.journey ? 'Yes' : 'No',
        'App logins': r.journey?.logins ?? 0,
      }))
    );

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h3 className="font-semibold text-stone-800">
          No-show explorer <span className="text-stone-400 font-normal">({filtered.length} of {noShows.length})</span>
        </h3>
        <div className="flex gap-1 ml-auto" role="group" aria-label="Cohort filter">
          {[['all', 'All'], ['invited', 'Invited only'], ['paid', 'Paid only'], ['engaged', 'Used app']].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setCohort(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${cohort === v ? 'bg-brand-navy text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
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
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy"
        />
        <Btn onClick={exportList}>Export CSV</Btn>
      </div>
      <p className="text-xs text-stone-500 mb-3">
        The steering committee's re-engagement list — export respects the active filters. Speakers are excluded by definition.
        <span className="font-semibold text-brand-navy"> "Used app" no-shows engaged with FIMCON digitally but never arrived — the warmest re-engagement targets.</span>
      </p>
      <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-stone-200 sticky top-0 bg-white">
            <tr>
              {['Name', 'Email', 'Company', 'State', 'Ticket type', 'Cohort', 'App'].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase text-stone-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.email || r.id} className="border-b border-stone-100 last:border-0">
                <td className="px-3 py-1.5 font-medium text-stone-800">{r.name}</td>
                <td className="px-3 py-1.5 text-stone-600">{r.email}</td>
                <td className="px-3 py-1.5">{r.organization}</td>
                <td className="px-3 py-1.5">{r.state}</td>
                <td className="px-3 py-1.5 text-xs">{r.ticketType || '—'}</td>
                <td className="px-3 py-1.5">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isInvited(r.ticketType) ? 'text-brand-greendark bg-brand-greenlight' : 'text-stone-500 bg-stone-100'}`}>
                    {isInvited(r.ticketType) ? 'Invited' : 'Paid'}
                  </span>
                </td>
                <td className="px-3 py-1.5">
                  {r.journey ? (
                    <span className="text-xs font-semibold text-brand-orange bg-brand-orangelight px-2 py-0.5 rounded-full" title={`${r.journey.logins} logins · ${r.journey.notifClicks} notification clicks`}>
                      ● active
                    </span>
                  ) : (
                    <span className="text-xs text-stone-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function SpeakersTab({ reg }) {
  const list = reg.speakersNotCheckedInList || [];
  const exportList = () =>
    downloadCSV(
      'fimcon-2026-speakers-not-badged.csv',
      list.map((r) => ({ Name: r.name, Email: r.email, Organization: r.organization || '', 'App activity': r.journey ? 'Yes' : 'No' }))
    );
  return (
    <div className="space-y-4">
      <Card className="bg-brand-orangelight border-orange-200">
        <h3 className="font-semibold text-stone-800">
          Speakers without a badge check-in ({list.length} of {reg.speakers?.registered})
        </h3>
        <p className="text-sm text-stone-600 mt-1">
          These speakers are <span className="font-semibold">not counted as no-shows</span>. Most are high-profile
          presenters who arrived for their session and departed without badging in — their contribution is captured in the
          program, not the check-in log. They are acknowledged here for completeness.
        </p>
        {ANONYMIZED && (
          <p className="text-xs text-stone-500 mt-2">The named acknowledgment list is available in the internal version only.</p>
        )}
      </Card>
      {!ANONYMIZED && (
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-stone-800">Acknowledgment list</h3>
          <Btn variant="ghost" onClick={exportList}>Export CSV</Btn>
        </div>
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-stone-200 sticky top-0 bg-white">
              <tr>
                {['Name', 'Email', 'Organization', 'App activity'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase text-stone-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.email} className="border-b border-stone-100 last:border-0">
                  <td className="px-3 py-1.5 font-medium text-stone-800">{r.name}</td>
                  <td className="px-3 py-1.5 text-stone-600">{r.email}</td>
                  <td className="px-3 py-1.5">{r.organization || '—'}</td>
                  <td className="px-3 py-1.5 text-xs">{r.journey ? `${r.journey.logins} logins` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      )}
    </div>
  );
}
