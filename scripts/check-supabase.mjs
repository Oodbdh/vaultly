/**
 * Supabase connection + schema check.  Run: npm run db:check
 *
 * Verifies, using only the publishable key from .env, that:
 *   1. the project host and auth endpoint respond,
 *   2. every table the app touches is exposed through PostgREST,
 *   3. the quota RPCs exist and are executable by client roles,
 *   4. the `receipts` storage bucket exists,
 *   5. RLS actually rejects an anonymous write.
 *
 * Note on method: this issues plain GET requests, never HEAD. A HEAD probe
 * (`select(..., { head: true })`) returns no body, and a missing table then
 * looks identical to an empty one — which reports absent tables as present.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');

if (!fs.existsSync(envPath)) {
  console.error('No .env found. Copy .env.example and fill in the Supabase keys.');
  process.exit(1);
}

const env = Object.fromEntries(
  fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const URL_ = env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!URL_ || !KEY) {
  console.error('EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY are not both set in .env.');
  process.exit(1);
}

const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const TABLES = ['profiles', 'vault_items', 'warranties', 'subscriptions', 'bonus_slots'];
const RPCS = ['is_premium', 'item_allowance'];

let failures = 0;
const ok = (m) => console.log(`  PASS  ${m}`);
const bad = (m) => { failures++; console.log(`  FAIL  ${m}`); };

console.log(`\nProject : ${URL_}`);
console.log(`Key     : ${KEY.slice(0, 20)}… (${KEY.length} chars)\n`);

console.log('Auth');
try {
  const res = await fetch(`${URL_}/auth/v1/settings`, { headers: H });
  if (!res.ok) bad(`auth settings returned HTTP ${res.status}`);
  else {
    const j = await res.json();
    const providers = Object.entries(j.external ?? {}).filter(([, v]) => v).map(([k]) => k);
    ok(`reachable — providers enabled: ${providers.join(', ') || 'none'}`);
    if (!j.external?.email) bad('email provider is disabled; the sign-in screen needs it');
  }
} catch (e) {
  bad(`cannot reach auth endpoint: ${e.message}`);
}

console.log('\nTables');
for (const t of TABLES) {
  try {
    const res = await fetch(`${URL_}/rest/v1/${t}?select=*&limit=1`, { headers: H });
    if (res.ok) ok(`${t} exposed`);
    else {
      const body = await res.json().catch(() => ({}));
      bad(`${t} — HTTP ${res.status} ${body.code ?? ''} ${body.message ?? ''}`);
    }
  } catch (e) {
    bad(`${t} — ${e.message}`);
  }
}

console.log('\nQuota RPCs');
for (const fn of RPCS) {
  const res = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid: '00000000-0000-0000-0000-000000000000' }),
  });
  if (res.ok) ok(`${fn} callable`);
  else {
    const body = await res.json().catch(() => ({}));
    bad(`${fn} — HTTP ${res.status} ${body.code ?? ''} ${body.message ?? ''}`);
  }
}

console.log('\nStorage');
{
  // Enumerating buckets needs privileges the anon key doesn't have — it returns
  // an empty list whether or not the bucket exists, so it cannot be used here.
  // Attempting an upload is decisive: a missing bucket answers 404 "Bucket not
  // found", while an existing one rejects on MIME type or RLS instead. The
  // text/plain body is deliberately disallowed, so nothing is ever written.
  const res = await fetch(`${URL_}/storage/v1/object/receipts/__probe__.txt`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'text/plain' },
    body: 'probe',
  });
  const body = await res.json().catch(() => ({}));
  if (body?.error === 'Bucket not found' || body?.statusCode === '404') {
    bad("bucket 'receipts' missing");
  } else if (body?.error === 'invalid_mime_type') {
    ok("bucket 'receipts' exists (MIME allow-list active)");
  } else if (res.status === 401 || res.status === 403) {
    ok("bucket 'receipts' exists (RLS rejected anonymous write)");
  } else if (res.ok) {
    bad("bucket 'receipts' accepted an ANONYMOUS upload — storage RLS is open");
  } else {
    ok(`bucket 'receipts' reachable (HTTP ${res.status})`);
  }
}

console.log('\nRLS');
{
  const res = await fetch(`${URL_}/rest/v1/vault_items`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({
      user_id: '00000000-0000-0000-0000-000000000000',
      merchant_name: '__rls_probe__',
    }),
  });
  if (res.status === 401 || res.status === 403) ok('anonymous insert rejected by RLS');
  else if (res.status === 404) console.log('  SKIP  table absent, cannot test RLS yet');
  else if (res.ok) bad('ANONYMOUS INSERT SUCCEEDED — RLS is not protecting vault_items');
  else ok(`anonymous insert rejected (HTTP ${res.status})`);
}

console.log(
  failures
    ? `\n${failures} check(s) failed. If tables are missing, run supabase/setup.sql in the SQL Editor.\n`
    : '\nAll checks passed — the app can run against this project.\n',
);
process.exit(failures ? 1 : 0);
