// Bake the current server cache into the published static snapshot.
//
//   npm run snapshot
//
// Copies server/cache/{people,jotform}.json → public/data/ and strips all
// personal data (names, emails, organizations, and the staff exclusion list)
// so the public site never ships PII. Run `npm run dev` first and let the app
// sync (or hit Refresh) so the cache is current, then run this and commit.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(root, 'server', 'cache');
const OUT = path.join(root, 'public', 'data');
fs.mkdirSync(OUT, { recursive: true });

const PII_KEYS = ['name', 'firstName', 'lastName', 'email', 'organization'];
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

// people.json — strip per-person PII and the hygiene exclusion roster.
const people = JSON.parse(fs.readFileSync(path.join(CACHE, 'people.json'), 'utf8'));
people.data.people = people.data.people.map((p) => {
  const o = { ...p };
  for (const k of PII_KEYS) delete o[k];
  return o;
});
if (people.data.hygiene) delete people.data.hygiene.excludedList;

// jotform.json — survey is anonymous (no email captured), copy as-is.
const jotform = JSON.parse(fs.readFileSync(path.join(CACHE, 'jotform.json'), 'utf8'));

// Safety gate: refuse to write a snapshot that still contains PII.
function assertClean(label, obj) {
  const hits = [];
  (function walk(v, p) {
    if (typeof v === 'string') {
      if (EMAIL_RE.test(v)) hits.push(`${p} => ${v.slice(0, 60)}`);
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}[${i}]`));
    else if (v && typeof v === 'object') {
      for (const k of Object.keys(v)) {
        if (PII_KEYS.includes(k)) hits.push(`${p}.${k} (PII field)`);
        walk(v[k], `${p}.${k}`);
      }
    }
  })(obj, label);
  if (hits.length) {
    console.error(`REFUSING to write ${label} — PII found:\n` + hits.slice(0, 20).join('\n'));
    process.exit(1);
  }
}
assertClean('people.json', people);
assertClean('jotform.json', jotform);

fs.writeFileSync(path.join(OUT, 'people.json'), JSON.stringify(people));
fs.writeFileSync(path.join(OUT, 'jotform.json'), JSON.stringify(jotform));
console.log(`Snapshot written to public/data/ (people: ${people.data.people.length}, survey rows: ${jotform.data.rows.length}, synced ${people.syncedAt})`);
console.log('Commit and push to publish: git add public/data && git commit -m "Update data snapshot" && git push');
