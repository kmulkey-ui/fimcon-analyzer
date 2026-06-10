import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, 'cache');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

const VFAIRS_BASE = 'https://api.vfairs.com/rest/v5';
const JOTFORM_BASE = 'https://api.jotform.com';
const SURVEY_FORM_TITLE = 'FIMCON 2026 Post-Conference Survey';

// ---------- cache helpers ----------
const cachePath = (name) => path.join(CACHE_DIR, `${name}.json`);
function readCache(name) {
  try {
    return JSON.parse(fs.readFileSync(cachePath(name), 'utf8'));
  } catch {
    return null;
  }
}
function writeCache(name, data) {
  const payload = { syncedAt: new Date().toISOString(), data };
  fs.writeFileSync(cachePath(name), JSON.stringify(payload));
  return payload;
}

// ---------- vFairs ----------
// Discovery notes (verified 2026-06-09 against this account's key):
//   Base: https://api.vfairs.com/rest/v5  (US region)
//   Auth: X-API-Key + X-App-Key headers (OAuth client_credentials also works)
//   GET /users/attendees?limit=100&page=N&payment_details=1
//   795 registrants; is_checked_in / checked_in_at exposed; ticket type =
//   payment.packages[0].package_name; session-level check-in NOT exposed on
//   this account, so event-level check-in only (per spec v1).
async function vfairsFetchAll() {
  const headers = {
    'X-API-Key': process.env.VFAIRS_API_KEY,
    'X-App-Key': process.env.VFAIRS_APP_KEY,
    Accept: 'application/json',
  };
  const users = [];
  let page = 1;
  let lastPage = 1;
  do {
    const res = await fetch(
      `${VFAIRS_BASE}/users/attendees?limit=100&page=${page}&payment_details=1`,
      { headers }
    );
    if (!res.ok) throw new Error(`vFairs HTTP ${res.status}`);
    const json = await res.json();
    if (!json.status) throw new Error(`vFairs error: ${json.message}`);
    users.push(...(json.users || []));
    lastPage = json.meta?.last_page ?? page;
    page += 1;
  } while (page <= lastPage);
  return users.map(normalizeRegistrant);
}

// Normalized registrant shape shared by API pull and xlsx import (client-side
// import maps to this same shape).
function normalizeRegistrant(u) {
  const pkg = u.payment?.packages?.[0]?.package_name || '';
  return {
    id: u.id,
    firstName: u.first_name || '',
    lastName: u.last_name || '',
    name: `${u.first_name || ''} ${u.last_name || ''}`.trim(),
    email: (u.email || u.username || '').toLowerCase(),
    ticketType: pkg.trim() || (u.enter_code ? 'COMP CODE' : 'UNSPECIFIED'),
    enterCode: u.enter_code || null,
    checkedIn: !!u.is_checked_in,
    checkedInAt: u.checked_in_at || null,
    registeredAt: u.registered_at || null,
    state: u.state___territory || u.state || '',
    city: u.city || '',
    organization: u.organization_name || '',
    jobTitle: u.job_title || '',
    sector: u.which_best_describes_your_primary_organization_select_one || '',
    registrationStatus: u.registration_status || '',
  };
}

app.get('/api/vfairs/registrants', async (req, res) => {
  const refresh = req.query.refresh === '1';
  if (!refresh) {
    const cached = readCache('vfairs');
    if (cached) return res.json({ ...cached, source: 'cache' });
  }
  try {
    const data = await vfairsFetchAll();
    const payload = writeCache('vfairs', data);
    res.json({ ...payload, source: 'api' });
  } catch (err) {
    const cached = readCache('vfairs');
    if (cached) return res.json({ ...cached, source: 'cache', error: String(err.message) });
    res.status(502).json({ error: String(err.message) });
  }
});

// ---------- Jotform ----------
async function jotformFindForm() {
  const res = await fetch(
    `${JOTFORM_BASE}/user/forms?apiKey=${process.env.JOTFORM_API_KEY}&limit=100`
  );
  if (!res.ok) throw new Error(`Jotform HTTP ${res.status}`);
  const json = await res.json();
  const forms = json.content || [];
  // Two forms share the title; pick the one with submissions.
  const matches = forms.filter(
    (f) => (f.title || '').trim().toLowerCase() === SURVEY_FORM_TITLE.toLowerCase()
  );
  matches.sort((a, b) => Number(b.count || 0) - Number(a.count || 0));
  if (!matches.length) throw new Error(`Form "${SURVEY_FORM_TITLE}" not found`);
  return matches[0];
}

async function jotformFetchSubmissions(formId) {
  const out = [];
  let offset = 0;
  const limit = 1000;
  for (;;) {
    const res = await fetch(
      `${JOTFORM_BASE}/form/${formId}/submissions?apiKey=${process.env.JOTFORM_API_KEY}&limit=${limit}&offset=${offset}`
    );
    if (!res.ok) throw new Error(`Jotform HTTP ${res.status}`);
    const json = await res.json();
    const batch = json.content || [];
    out.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }
  return out;
}

// Normalize a Jotform submission's `answers` object to the same flat row shape
// the CSV export produces: columns keyed by question text ("1. ..." .. "22. ..."),
// matrix sub-rows flattened to "8. ... >> {subquestion}".
function normalizeSubmission(sub) {
  const row = { 'Submission Date': sub.created_at || '' };
  for (const a of Object.values(sub.answers || {})) {
    const text = (a.text || '').trim();
    if (!/^\d{1,2}\./.test(text)) continue; // skip headers/non-questions
    const ans = a.answer;
    if (ans == null) {
      if (!(text in row)) row[text] = '';
      continue;
    }
    if (a.type === 'control_matrix' && typeof ans === 'object') {
      // Matrix: answer keyed by row index or row label
      const rowLabels = (a.mrows || '').split('|');
      for (const [k, v] of Object.entries(ans)) {
        const label = rowLabels[Number(k)] !== undefined && /^\d+$/.test(k)
          ? rowLabels[Number(k)]
          : k;
        row[`${text} >> ${String(label).trim()}`] = typeof v === 'object' ? Object.values(v).join(', ') : String(v ?? '');
      }
    } else if (Array.isArray(ans)) {
      row[text] = ans.join('\n');
    } else if (typeof ans === 'object') {
      row[text] = Object.values(ans).join(' ');
    } else {
      row[text] = String(ans);
    }
  }
  return row;
}

app.get('/api/jotform/submissions', async (req, res) => {
  const refresh = req.query.refresh === '1';
  if (!refresh) {
    const cached = readCache('jotform');
    if (cached) return res.json({ ...cached, source: 'cache' });
  }
  try {
    const form = await jotformFindForm();
    const subs = await jotformFetchSubmissions(form.id);
    let rows = subs.map(normalizeSubmission);
    // Rows are sparse (only answered questions present) — fill the union of
    // columns so the client sees the same uniform shape as the CSV export.
    const allKeys = new Set(['Submission Date']);
    for (const r of rows) for (const k of Object.keys(r)) allKeys.add(k);
    rows = rows.map((r) => {
      const o = {};
      for (const k of allKeys) o[k] = r[k] ?? '';
      return o;
    });
    const payload = writeCache('jotform', {
      formId: form.id,
      formTitle: form.title,
      rows,
    });
    res.json({ ...payload, source: 'api' });
  } catch (err) {
    const cached = readCache('jotform');
    if (cached) return res.json({ ...cached, source: 'cache', error: String(err.message) });
    res.status(502).json({ error: String(err.message) });
  }
});

// ---------- Anthropic ----------
const BRAND_RULES = `Brand rules (mandatory): write "Food is Medicine" with a lowercase "is" always; write "FIMCON" in all caps always; tone is professional, confident, and movement-building. NEVER compute, mention, or reference Net Promoter Score or NPS — the "Would you recommend FIMCON to a colleague?" question is reported only as a simple average labeled "Avg recommendation score".`;

function anthropicClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    const e = new Error('ANTHROPIC_API_KEY is not set. Add it to .env and restart the server.');
    e.status = 400;
    throw e;
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

async function askClaude(system, user, maxTokens = 600) {
  const client = anthropicClient();
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  });
  return msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}

app.post('/api/ai/insight', async (req, res) => {
  try {
    const { question, distribution, context } = req.body;
    const text = await askClaude(
      `You are an event analytics writer for FIMCON 2026 (the Food is Medicine conference). ${BRAND_RULES} Produce exactly 2-3 sentences. Connect this survey question's results to overall event success and the cross-context data provided (check-in rates, invited vs paid no-show gap, session attendance patterns, criteria status). Be specific with numbers.`,
      `Survey question: ${question}\n\nDistribution / results:\n${JSON.stringify(distribution, null, 2)}\n\nCross-context event data:\n${JSON.stringify(context, null, 2)}`,
      400
    );
    res.json({ text });
  } catch (err) {
    res.status(err.status || 502).json({ error: String(err.message) });
  }
});

app.post('/api/ai/themes', async (req, res) => {
  try {
    const { questions } = req.body; // [{ label, responses: [] }]
    const blocks = questions
      .map(
        (q) =>
          `### ${q.label}\n${q.responses.slice(0, 60).join(' | ')}`
      )
      .join('\n\n');
    const text = await askClaude(
      `You are an event analytics writer for FIMCON 2026 (the Food is Medicine conference). ${BRAND_RULES} For each open-ended question below, identify the top 3-4 themes with a rough frequency for each (e.g. "~15 mentions" or "about a quarter of responses"). Format as a markdown section per question with a bulleted theme list.`,
      blocks,
      1500
    );
    res.json({ text });
  } catch (err) {
    res.status(err.status || 502).json({ error: String(err.message) });
  }
});

app.post('/api/ai/narrative', async (req, res) => {
  try {
    const { criteria, score, rating, attendance } = req.body;
    const text = await askClaude(
      `You are writing for FIMCON 2026 funders and the steering committee. ${BRAND_RULES} Write ONE paragraph of 4-6 sentences making the case for the event's success from the data. Frame any missed targets forward-looking (as opportunities for the next FIMCON), never as failures. No headers, no bullets — a single polished paragraph.`,
      `Overall event score: ${score}% — rating: ${rating}\n\nCriteria results:\n${JSON.stringify(criteria, null, 2)}\n\nAttendance & no-show highlights:\n${JSON.stringify(attendance, null, 2)}`,
      700
    );
    res.json({ text });
  } catch (err) {
    res.status(err.status || 502).json({ error: String(err.message) });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    anthropicKeySet: !!process.env.ANTHROPIC_API_KEY,
  });
});

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => console.log(`FIMCON analyzer server on :${PORT}`));
