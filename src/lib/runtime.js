// Runtime mode flags.
//
// `npm run dev` (Vite dev server + Express API) → DEV: live vFairs/Jotform pulls
// and the Claude-powered AI buttons all work, full attendee roster shown.
//
// `npm run build` (what Azure Static Web Apps deploys) → PROD: there is no
// backend. The app loads the baked, PII-stripped snapshot in /public/data,
// the AI buttons are hidden, and individual attendee rosters are suppressed.
export const STATIC_BUILD = import.meta.env.PROD; // published, no-backend snapshot
export const AI_ENABLED = import.meta.env.DEV; // Claude CLI only exists locally
export const ANONYMIZED = STATIC_BUILD; // no names/emails/orgs in the public build
