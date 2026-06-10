# FIMCON 2026 — Event Performance Analyzer

Production event performance analysis app for ARB Meetings & Events.
**Event:** FIMCON 2026 (Food is Medicine conference), June 1–2, 2026, Grand Hyatt Washington.
**Audience:** funders and the steering committee.

## Run

```bash
npm install
npm run dev        # Express API on :3001 + Vite on :5173 (proxied /api)
```

Create `.env` from `.env.example` (never commit it):

```
VFAIRS_API_KEY=...
VFAIRS_APP_KEY=...
JOTFORM_API_KEY=...
ANTHROPIC_API_KEY=...   # required only for "Generate insight" / themes / narrative
API_PORT=3001
```

> **Security:** the vFairs and Jotform keys used during the build were shared in
> plaintext — rotate both and update `.env`.

## vFairs API discovery (verified 2026-06-09 for this account)

- **Base URL:** `https://api.vfairs.com/rest/v5` (US region)
- **Auth:** `X-API-Key: <key>` + `X-App-Key: <app key>` headers.
  OAuth `POST /oauth/token` (`grant_type=client_credentials`, `app_key`, `app_secret`) also works.
- **Registrants:** `GET /users/attendees?limit=100&page=N&payment_details=1`
  - 795 registrants, paginated via `meta.last_page`
  - Check-in: `is_checked_in` / `checked_in_at` (event-level; session-level check-in is **not** exposed on this account)
  - Ticket type: `payment.packages[0].package_name` (requires `payment_details=1`); registrants
    without a package registered via comp codes (`enter_code`)
  - Profile fields: `state___territory`, `organization_name`, `job_title`,
    `which_best_describes_your_primary_organization_select_one`

## Jotform

- Form: "FIMCON 2026 Post-Conference Survey" (two forms share the title — the one with
  submissions is selected automatically)
- Submissions normalized server-side to the same flat row shape as the CSV export,
  matrix questions (Q8/Q13) flattened to `"8. … >> {subquestion}"` columns, sparse rows
  filled to a uniform column set.

## Data notes

- **NPS is excluded by design.** Q20 is reported as a simple average only. The live form
  uses a 1–5 scale (the original spec assumed 0–10) — the label auto-detects the scale.
- Q10 multi-select is newline-separated in live data (`;`/`,` fallbacks retained).
- Q19 return intent uses the prototype heuristic (starts with "yes" or contains
  "definitely") — "Probably yes" (28 of 103) intentionally does not count; unmatched
  values are logged in dev.
- The survey does not capture respondent email, so survey rows cannot be joined to
  vFairs registrants — the invited-vs-paid survey sentiment split is disabled with an
  explanatory note in the UI.
- Session attendance is hard-coded from manual agenda counts (`src/lib/sessions.js`).
  Day 2 Research Pt 1 & 2 were one audience (counted once). Closed-door sessions are
  excluded and footnoted.

## Architecture

- Vite + React 18 + Tailwind; Recharts; PapaParse (CSV fallback); SheetJS (xlsx fallback)
- Express (`server/index.js`) proxies vFairs / Jotform / Anthropic — keys never reach the client
- API pulls cached to `server/cache/*.json` with per-source "Refresh" buttons and
  last-synced timestamps
- Criteria / manual entries / benchmarks persist in `localStorage`
- AI (claude-sonnet-4-5): per-question insight, open-ended themes (Q5/Q6/Q7/Q22),
  funder narrative — all server-side
