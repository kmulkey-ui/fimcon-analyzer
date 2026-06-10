// Enriched vFairs data layer.
//
// Merges three sources into one cleaned "people" dataset:
//   1. vFairs API attendees (ticket package, profile fields, is_checked_in)
//   2. data/vfairs-export.xlsx "registered" tab   — user ROLES (Attendee/Speaker/Admin/…)
//   3. data/vfairs-export.xlsx "checked in" tab   — badge check-in activity log
//   4. data/vfairs-export.xlsx "user journey stats" tab — app engagement events
//
// Cleaning rules (requested by ARB):
//   - Exclude anyone with a vfairs.com or arbmeetings.com email (platform/ARB staff)
//   - Exclude pure staff roles (Admin / Event Owner / Booth Admin) from the
//     attendance funnel — reported separately for transparency
//   - Dedupe by lowercase email: speakers often have a Speaker AND an Attendee
//     record; merged into one person (role = Speaker wins)
//   - Speakers who never badge-checked-in are NOT no-shows — they are
//     acknowledged separately (most presented and departed without check-in)

import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

const EXCLUDED_DOMAINS = ['vfairs.com', 'arbmeetings.com'];
const STAFF_ROLES = ['Admin', 'Event Owner', 'Booth Admin'];

const emailDomain = (e) => String(e || '').split('@').pop().toLowerCase().trim();
const lcEmail = (e) => String(e || '').toLowerCase().trim();

function sheetRows(wb, name) {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
}

const JOURNEY_KEYS = {
  Login: 'logins',
  'VJF Top Menus (All)': 'menuViews',
  'Notification clicks': 'notifClicks',
  'Chat Clicks': 'chatClicks',
  'Scan Qr Code': 'qrScans',
  'Upload profile picture (mobile)': 'profileUploads',
};

export function buildPeople(apiUsers, exportPath) {
  const buf = fs.readFileSync(exportPath);
  const wb = XLSX.read(buf, { type: 'buffer' });

  const registered = sheetRows(wb, 'registered');
  const checkins = sheetRows(wb, 'checked in');
  const journey = sheetRows(wb, 'user journey stats');

  // ---- check-in log: first check-in per email + daily flow ----
  const checkinByEmail = new Map();
  const checkinFlow = {};
  for (const c of checkins) {
    const em = lcEmail(c.Email);
    if (!em) continue;
    const dt = String(c['Date & Time'] || '');
    const day = dt.slice(0, 10);
    if (day) checkinFlow[day] = (checkinFlow[day] || 0) + (checkinByEmail.has(em) ? 0 : 1);
    if (!checkinByEmail.has(em)) {
      checkinByEmail.set(em, { at: dt, type: c.Type || '', by: c['Checked By'] || '' });
    }
  }

  // ---- journey: per-email aggregates + per-activity totals ----
  const journeyByEmail = new Map();
  const journeyTotals = {};
  for (const j of journey) {
    const em = lcEmail(j.Email);
    const act = String(j.Activity || '').trim();
    const views = parseFloat(j.Views) || 0;
    if (!em || !act) continue;
    const internal = EXCLUDED_DOMAINS.includes(emailDomain(em));
    if (!journeyTotals[act]) journeyTotals[act] = { events: 0, views: 0, users: new Set(), internalViews: 0 };
    journeyTotals[act].events += 1;
    journeyTotals[act].views += views;
    if (internal) journeyTotals[act].internalViews += views;
    else journeyTotals[act].users.add(em);
    if (internal) continue;
    if (!journeyByEmail.has(em)) {
      journeyByEmail.set(em, {
        logins: 0, menuViews: 0, notifClicks: 0, chatClicks: 0,
        qrScans: 0, profileUploads: 0, totalViews: 0, activityKinds: 0,
      });
    }
    const agg = journeyByEmail.get(em);
    const key = JOURNEY_KEYS[act];
    if (key) {
      if (agg[key] === 0) agg.activityKinds += 1;
      agg[key] += views;
    }
    agg.totalViews += views;
  }
  const journeySummary = Object.fromEntries(
    Object.entries(journeyTotals).map(([act, t]) => [
      act,
      { events: t.events, views: Math.round(t.views), uniqueUsers: t.users.size, internalViews: Math.round(t.internalViews) },
    ])
  );

  // ---- API attendees by email (ticket, profile, event-level check-in) ----
  const apiByEmail = new Map();
  for (const u of apiUsers) {
    const em = lcEmail(u.email);
    if (em && !apiByEmail.has(em)) apiByEmail.set(em, u);
  }

  // ---- registered tab → dedupe into people ----
  const ROLE_PRIORITY = ['Speaker', 'Attendee', 'Booth Admin', 'Event Owner', 'Admin'];
  const byEmail = new Map();
  const excludedList = [];
  let duplicateRowsMerged = 0;
  let speakerAttendeeMerged = 0;

  for (const r of registered) {
    const em = lcEmail(r.Email);
    if (!em) continue;
    const role = String(r['User Role'] || 'Attendee').trim();
    if (byEmail.has(em)) {
      const p = byEmail.get(em);
      duplicateRowsMerged += 1;
      if (!p.roles.includes(role)) {
        p.roles.push(role);
        if (
          (role === 'Speaker' && p.roles.includes('Attendee')) ||
          (role === 'Attendee' && p.roles.includes('Speaker'))
        ) {
          speakerAttendeeMerged += 1;
        }
      }
      continue;
    }
    byEmail.set(em, {
      id: r.UserID,
      firstName: r['First Name'] || '',
      lastName: r['Last Name'] || '',
      name: `${r['First Name'] || ''} ${r['Last Name'] || ''}`.trim(),
      email: em,
      roles: [role],
      registeredAt: r['Date Registered'] || null,
    });
  }

  const people = [];
  const staffRoleCounts = {};
  let vfairsStaff = 0;
  let arbStaff = 0;

  for (const p of byEmail.values()) {
    const domain = emailDomain(p.email);
    const api = apiByEmail.get(p.email);
    const ck = checkinByEmail.get(p.email);
    const primaryRole = ROLE_PRIORITY.find((r) => p.roles.includes(r)) || p.roles[0];

    const person = {
      ...p,
      role: primaryRole,
      isSpeaker: p.roles.includes('Speaker'),
      // True only when this email is present in the live vFairs API pull.
      // The API returns only currently-"Registered" attendees, so a person in
      // the historical xlsx export but absent here has cancelled/withdrawn —
      // these are excluded from the registration vs. no-show base.
      apiRegistered: !!api,
      checkedInApi: !!api?.checkedIn, // API is_checked_in flag only (reference)
      ticketType: api?.ticketType || null,
      checkedIn: !!(api?.checkedIn || ck),
      checkedInAt: api?.checkedInAt || ck?.at || null,
      checkinDay: (ck?.at || api?.checkedInAt || '').slice(0, 10) || null,
      state: api?.state || '',
      city: api?.city || '',
      organization: api?.organization || '',
      jobTitle: api?.jobTitle || '',
      sector: api?.sector || '',
      registeredAt: api?.registeredAt || p.registeredAt,
      journey: journeyByEmail.get(p.email) || null,
    };

    // exclusion rules
    if (EXCLUDED_DOMAINS.includes(domain)) {
      if (domain === 'vfairs.com') vfairsStaff += 1;
      else arbStaff += 1;
      excludedList.push({ name: person.name, email: person.email, role: primaryRole, reason: `${domain} (platform/staff)` });
      continue;
    }
    if (STAFF_ROLES.includes(primaryRole)) {
      staffRoleCounts[primaryRole] = (staffRoleCounts[primaryRole] || 0) + 1;
      excludedList.push({ name: person.name, email: person.email, role: primaryRole, reason: `staff role: ${primaryRole}` });
      continue;
    }
    people.push(person);
  }

  // ---- registration timeline (cumulative) ----
  const regByDay = {};
  for (const p of people) {
    const d = String(p.registeredAt || '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) regByDay[d] = (regByDay[d] || 0) + 1;
  }
  let cum = 0;
  const registrationTimeline = Object.keys(regByDay)
    .sort()
    .map((d) => ({ date: d, count: regByDay[d], cumulative: (cum += regByDay[d]) }));

  return {
    people,
    hygiene: {
      rawRows: registered.length,
      uniquePeople: byEmail.size,
      included: people.length,
      duplicateRowsMerged,
      speakerAttendeeMerged,
      vfairsStaffExcluded: vfairsStaff,
      arbStaffExcluded: arbStaff,
      staffRolesExcluded: staffRoleCounts,
      excludedList,
    },
    checkinFlow,
    journeySummary,
    registrationTimeline,
  };
}
