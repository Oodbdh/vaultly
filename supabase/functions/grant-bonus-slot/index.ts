// Mints a rewarded-ad bonus slot for the calling user.
// Runs with the service role so it can write bonus_slots (clients cannot),
// and enforces the 2-concurrent-slot ceiling server-side.
//
// Deploy: supabase functions deploy grant-bonus-slot
import { createClient } from 'jsr:@supabase/supabase-js@2';

const TTL_HOURS = 24;
const MAX_CONCURRENT = 2;

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'unauthorised' }, 401);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: userRes } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
  const user = userRes?.user;
  if (!user) return json({ error: 'unauthorised' }, 401);

  // Premium users have no reason to earn slots — reject rather than pollute data.
  const { data: premium } = await admin.rpc('is_premium', { uid: user.id });
  if (premium) return json({ error: 'already_unlimited' }, 409);

  const { count } = await admin
    .from('bonus_slots')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gt('expires_at', new Date().toISOString());

  if ((count ?? 0) >= MAX_CONCURRENT) return json({ error: 'max_slots_reached' }, 409);

  const expiresAt = new Date(Date.now() + TTL_HOURS * 3_600_000).toISOString();
  const { error } = await admin
    .from('bonus_slots')
    .insert({ user_id: user.id, source: 'rewarded_ad', expires_at: expiresAt });
  if (error) return json({ error: error.message }, 500);

  return json({ granted: 1, expiresAt });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
