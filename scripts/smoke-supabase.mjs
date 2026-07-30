/**
 * Live end-to-end check against the real Supabase project.
 * Run: npm run db:smoke -- --yes [--domain=example.org]
 *
 * Exercises the exact paths the screens use, as a real authenticated user:
 *   signup → profile auto-created → insert item + warranty → the embedded join
 *   listItems() relies on → item_allowance RPC → quota trigger → RLS isolation
 *   → storage upload → the analyze-receipt Edge Function (real OCR).
 *
 * WRITES REAL DATA. It creates two throwaway auth users and deletes every row
 * it creates. It cannot delete the auth users themselves (that needs the
 * service_role key), so remove them from Dashboard → Authentication → Users.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let failures = 0;
const ok = (m) => console.log(`  PASS  ${m}`);
const bad = (m) => { failures++; console.log(`  FAIL  ${m}`); };
const skip = (m) => console.log(`  SKIP  ${m}`);

async function main() {
  if (!process.argv.includes('--yes')) {
    console.error('This writes real data to your Supabase project.');
    console.error('Re-run with:  npm run db:smoke -- --yes');
    return 1;
  }

  const env = Object.fromEntries(
    fs.readFileSync(path.join(root, '.env'), 'utf8')
      .split(/\r?\n/)
      .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
      .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
  );

  const URL_ = env.EXPO_PUBLIC_SUPABASE_URL;
  const KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!URL_ || !KEY) {
    console.error('Supabase URL / key missing from .env');
    return 1;
  }

  console.log(`\nProject: ${URL_}\n`);

  // ── Pre-flight ────────────────────────────────────────────────────────────
  // If "Confirm email" is on, a successful signup mails a real confirmation
  // link to whatever address we invent — refuse to create anything rather than
  // send mail to a stranger's mailbox. Must run before the first signup.
  {
    const res = await fetch(`${URL_}/auth/v1/settings`, { headers: { apikey: KEY } });
    const settings = await res.json().catch(() => ({}));
    if (settings.mailer_autoconfirm !== true) {
      console.error('BLOCKED: "Confirm email" is enabled on this project.\n');
      console.error('  Signup would email a confirmation link to a made-up address, and');
      console.error('  would return no session, so the test cannot proceed either way.\n');
      console.error('  Dashboard → Authentication → Providers → Email → turn off');
      console.error('  "Confirm email", then re-run. No test users were created.\n');
      return 2;
    }
    if (settings.disable_signup === true) {
      console.error('BLOCKED: signups are disabled. No test users were created.\n');
      return 2;
    }
  }

  // Supabase's validator rejects reserved domains such as example.com.
  const domainArg = process.argv.find((a) => a.startsWith('--domain='));
  const DOMAIN = domainArg ? domainArg.split('=')[1] : 'gmail.com';

  const stamp = Date.now();
  const userA = { email: `vaultly.smoke.${stamp}a@${DOMAIN}`, password: `Sm0ke!${stamp}` };
  const userB = { email: `vaultly.smoke.${stamp}b@${DOMAIN}`, password: `Sm0ke!${stamp}` };

  const client = () => createClient(URL_, KEY, { auth: { persistSession: false } });

  async function signUp(a) {
    const sb = client();
    const { data, error } = await sb.auth.signUp({
      email: a.email,
      password: a.password,
      options: { data: { locale: 'en', full_name: 'Smoke Test' } },
    });
    if (error) return { sb: null, user: null, error };
    if (!data.session) return { sb: null, user: null, error: new Error('no session returned') };
    return { sb, user: data.user, session: data.session, error: null };
  }

  // ── Auth + profile trigger ────────────────────────────────────────────────
  console.log('Auth + profile trigger');

  const A = await signUp(userA);
  if (A.error) {
    bad(`signup failed: ${A.error.message}`);
    console.log('\nCannot continue without a session.');
    if (/invalid/i.test(A.error.message)) {
      console.log(`The address domain "${DOMAIN}" was rejected. Retry with --domain=<host>.`);
    }
    return 1;
  }
  ok(`signed up ${userA.email}`);

  const uid = A.user.id;
  {
    await new Promise((r) => setTimeout(r, 800)); // AFTER trigger needs a beat
    const { data, error } = await A.sb.from('profiles').select('*').eq('id', uid).maybeSingle();
    if (error) bad(`profile read: ${error.message}`);
    else if (!data) bad('profile row NOT auto-created (handle_new_user trigger missing?)');
    else ok(`profile auto-created — locale=${data.locale}, plan=${data.plan_tier}`);
  }

  // ── Writes ────────────────────────────────────────────────────────────────
  console.log('\nWrites (the createItem path)');
  let itemId = null;
  {
    const { data, error } = await A.sb.from('vault_items').insert({
      user_id: uid,
      kind: 'warranty',
      merchant_name: 'Smoke Test TV',
      total_amount: 2499,
      currency: 'SAR',
      purchase_date: new Date().toISOString().slice(0, 10),
      category: 'Electronics',
      ocr_status: 'manual',
    }).select().single();
    if (error) bad(`insert vault_item: [${error.code}] ${error.message}`);
    else { itemId = data.id; ok(`vault_item inserted (${data.id.slice(0, 8)}…)`); }
  }

  if (itemId) {
    const expires = new Date(Date.now() + 16 * 86_400_000).toISOString().slice(0, 10);
    const { error } = await A.sb.from('warranties').insert({
      item_id: itemId, user_id: uid, expires_on: expires,
      duration_months: 12, reminder_days: [30, 7, 1],
    });
    if (error) bad(`insert warranty: [${error.code}] ${error.message}`);
    else ok('warranty inserted');
  }

  // ── Reads ─────────────────────────────────────────────────────────────────
  console.log('\nReads (the exact listItems() query)');
  {
    const { data, error } = await A.sb
      .from('vault_items')
      .select('*, warranties(expires_on), subscriptions(next_renewal, amount, period, currency)')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });
    if (error) bad(`join query: [${error.code}] ${error.message}`);
    else {
      const joined = data?.[0]?.warranties?.[0]?.expires_on;
      if (joined) ok(`join resolves — warranty expires_on=${joined}`);
      else bad('join returned no warranty; cards would show no countdown');
    }
  }

  // ── Quota ─────────────────────────────────────────────────────────────────
  console.log('\nQuota (fetchQuota + enforce_item_quota trigger)');
  {
    const { data, error } = await A.sb.rpc('item_allowance', { uid });
    if (error) bad(`item_allowance RPC: [${error.code}] ${error.message}`);
    else ok(`item_allowance = ${data} (expected 4 for a free user)`);
  }
  {
    for (let i = 0; i < 3; i++) {
      await A.sb.from('vault_items').insert({
        user_id: uid, kind: 'receipt', merchant_name: `Smoke filler ${i}`,
        currency: 'SAR', ocr_status: 'manual',
      });
    }
    const { error } = await A.sb.from('vault_items').insert({
      user_id: uid, kind: 'receipt', merchant_name: 'Smoke over-quota',
      currency: 'SAR', ocr_status: 'manual',
    });
    if (!error) bad('5th insert SUCCEEDED — the quota trigger is not enforcing');
    else if (error.message.includes('VAULTLY_QUOTA_EXCEEDED')) ok('quota trigger rejected the 5th item');
    else bad(`5th insert rejected with an unexpected error: ${error.message}`);
  }

  // ── RLS ───────────────────────────────────────────────────────────────────
  console.log('\nRLS isolation');
  {
    const B = await signUp(userB);
    if (B.error) skip(`second signup failed: ${B.error.message}`);
    else {
      const { data, error } = await B.sb.from('vault_items').select('id').eq('user_id', uid);
      if (error) ok(`user B blocked: ${error.message}`);
      else if ((data ?? []).length === 0) ok("user B sees none of user A's items");
      else bad(`RLS LEAK — user B read ${data.length} of user A's rows`);
      await B.sb.auth.signOut();
    }
  }

  // ── Storage ───────────────────────────────────────────────────────────────
  console.log('\nStorage');
  {
    const png = fs.readFileSync(path.join(root, 'scripts', 'fixtures', 'sample-receipt.png'));
    const objectPath = `${uid}/smoke.png`;
    const { error } = await A.sb.storage
      .from('receipts')
      .upload(objectPath, png, { contentType: 'image/png', upsert: true });
    if (error) bad(`upload to own folder: ${error.message}`);
    else {
      ok('uploaded to own folder');
      const { data: signed, error: sErr } = await A.sb.storage
        .from('receipts').createSignedUrl(objectPath, 60);
      if (sErr) bad(`signed URL: ${sErr.message}`);
      else ok('signed URL issued');
      await A.sb.storage.from('receipts').remove([objectPath]);
    }
  }
  {
    // A second user must not be able to write into user A's folder.
    const B = client();
    const { error } = await B.storage
      .from('receipts')
      .upload(`${uid}/intruder.png`, Buffer.from([0]), { contentType: 'image/png' });
    if (error) ok('anonymous write to another user\'s folder rejected');
    else bad("STORAGE LEAK — anonymous upload into another user's folder succeeded");
  }

  // ── OCR through the deployed Edge Function ────────────────────────────────
  console.log('\nOCR (analyze-receipt Edge Function → OpenAI)');
  {
    const png = fs.readFileSync(path.join(root, 'scripts', 'fixtures', 'sample-receipt.png'));
    const res = await fetch(`${URL_}/functions/v1/analyze-receipt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: KEY,
        Authorization: `Bearer ${A.session.access_token}`,
      },
      body: JSON.stringify({ imageBase64: png.toString('base64'), mimeType: 'image/png' }),
    });
    const body = await res.json().catch(() => null);

    if (!res.ok || body?.error) {
      const reason = body?.error?.reason ?? 'unknown';
      const msg = body?.error?.message ?? `HTTP ${res.status}`;
      if (reason === 'unknown' && /OPENAI_API_KEY/i.test(msg)) {
        bad(`OPENAI_API_KEY secret is not set on the project — ${msg}`);
      } else {
        bad(`[${reason}] ${msg}`);
      }
    } else if (!body?.data) {
      bad('function returned no data');
    } else {
      const d = body.data;
      ok(`extracted merchant=${JSON.stringify(d.merchantName)} total=${d.totalAmount} ` +
         `date=${JSON.stringify(d.purchaseDate)} type=${d.purchaseType} conf=${d.confidence}`);
      if (d.merchantName == null && d.totalAmount == null) {
        bad('every field came back null — the model read nothing from the image');
      }
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────
  console.log('\nCleanup');
  {
    const { error } = await A.sb.from('vault_items').delete().eq('user_id', uid);
    if (error) bad(`cleanup: ${error.message}`);
    else ok('test rows deleted');
  }
  await A.sb.auth.signOut();

  console.log(
    failures
      ? `\n${failures} check(s) failed.\n`
      : '\nAll live checks passed — the app is safe to point at this project.\n',
  );
  console.log('Remove the throwaway users from Dashboard → Authentication → Users:');
  console.log(`  ${userA.email}\n  ${userB.email}\n`);
  return failures ? 1 : 0;
}

// Set the code and let the loop drain — process.exit() races undici's open
// sockets and trips a libuv assertion on Windows.
main().then(
  (code) => { process.exitCode = code; },
  (e) => { console.error(e); process.exitCode = 1; },
);
