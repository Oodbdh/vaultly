/**
 * Checks the deployed `analyze-receipt` Edge Function without needing a user
 * session. Run: npm run fn:check
 *
 * Verifies it is deployed, that its method and auth guards fire, and that CORS
 * preflight works. Body validation (missing image, oversized, bad MIME) sits
 * behind the auth gate by design, so it is covered by `npm run db:smoke`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  fs.readFileSync(path.join(root, '.env'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const URL_ = env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const FN = `${URL_}/functions/v1/analyze-receipt`;
const H = { apikey: KEY, 'Content-Type': 'application/json' };

let failures = 0;

async function probe(label, init, expect) {
  let res, body;
  try {
    res = await fetch(FN, init);
    body = await res.text();
  } catch (e) {
    failures++;
    console.log(`  FAIL  ${label.padEnd(32)} threw ${e.message}`);
    return;
  }
  if (res.status === 404) {
    failures++;
    console.log(`  FAIL  ${label.padEnd(32)} HTTP 404 — function is not deployed`);
    return;
  }
  const pass = expect(res, body);
  if (!pass) failures++;
  console.log(
    `  ${pass ? 'PASS' : 'FAIL'}  ${label.padEnd(32)} HTTP ${res.status}  ${body.slice(0, 90)}`,
  );
}

// Syntactically valid but bogus — exercises JWT verification.
const FAKE_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAiLCJleHAiOjk5OTk5OTk5OTl9.' +
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

console.log(`\nFunction: ${FN}\n`);

await probe('CORS preflight (OPTIONS)', { method: 'OPTIONS', headers: H },
  (r) => r.status === 200 && !!r.headers.get('access-control-allow-origin'));

await probe('GET rejected (method guard)', { method: 'GET', headers: H },
  (r) => r.status === 405 || r.status === 401);

await probe('no auth -> 401', { method: 'POST', headers: H, body: '{}' },
  (r, b) => r.status === 401 && b.includes('"reason":"auth"'));

// The Supabase gateway verifies JWTs before the function runs, so this comes
// back in the platform's own error shape. Any 401 is correct; the client maps
// every 401 to reason 'auth'.
await probe('bogus JWT -> 401', {
  method: 'POST', headers: { ...H, Authorization: `Bearer ${FAKE_JWT}` }, body: '{}',
}, (r) => r.status === 401);

console.log(
  failures
    ? `\n${failures} check(s) failed.\n`
    : '\nFunction is deployed and its guards behave correctly.\n' +
      'Real OCR is covered by: npm run db:smoke -- --yes\n',
);
process.exitCode = failures ? 1 : 0;
