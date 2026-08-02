// Permanent account deletion.
//
// This has to be a function, not a client call: removing a row from
// `auth.users` requires the service role, and that key must never reach the
// app. RLS lets a user delete their own vault rows but there is deliberately no
// delete policy on `profiles`, and none is possible on `auth.users`.
//
// Deploy:
//   supabase functions deploy delete-account --use-api
//
// The caller's own JWT identifies the account, so a user can only ever delete
// themselves — the id is never taken from the request body.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return fail('Use POST', 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return fail('Missing Authorization header', 401);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: userRes } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
  const user = userRes?.user;
  if (!user) return fail('Invalid session', 401);

  try {
    // 1. Stored receipt images. The bucket is keyed <user_id>/<file>, so one
    //    listing covers everything this account ever uploaded.
    const { data: files } = await admin.storage.from('receipts').list(user.id);
    if (files?.length) {
      await admin.storage
        .from('receipts')
        .remove(files.map((f) => `${user.id}/${f.name}`));
    }

    // 2. Vault rows. warranties and subscriptions cascade from vault_items.
    await admin.from('vault_items').delete().eq('user_id', user.id);
    await admin.from('bonus_slots').delete().eq('user_id', user.id);
    await admin.from('profiles').delete().eq('id', user.id);

    // 3. The auth row last — everything above is scoped by it.
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) return fail(error.message, 500);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('delete-account failed', e);
    return fail(e instanceof Error ? e.message : String(e), 500);
  }
});

function fail(message: string, status: number) {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
