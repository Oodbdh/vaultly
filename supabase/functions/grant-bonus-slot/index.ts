// Mints the one-off permanent bonus slot for the calling user.
//
// Runs with the service role so it can write bonus_slots (clients cannot, by
// RLS), which is what stops a user minting slots without watching an ad.
//
// The reward is permanent and claimable exactly once per account. There is no
// expiry and no concurrency ceiling: either the user has their extra slot or
// they do not. `bonus_slots_user_once` (unique on user_id) is the authority —
// the pre-check below is only there to return a friendlier status than a raw
// constraint violation.
//
// Deploy: supabase functions deploy grant-bonus-slot --use-api
import { createClient } from 'jsr:@supabase/supabase-js@2';

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
    .eq('user_id', user.id);

  if ((count ?? 0) > 0) return json({ error: 'already_claimed' }, 409);

  const { error } = await admin
    .from('bonus_slots')
    .insert({ user_id: user.id, source: 'rewarded_ad' });

  if (error) {
    // 23505 = unique_violation: two requests raced and the other one won. The
    // user still ends up with exactly one slot, so report it as already claimed
    // rather than as a failure.
    if (error.code === '23505') return json({ error: 'already_claimed' }, 409);
    return json({ error: error.message }, 500);
  }

  return json({ granted: 1, permanent: true });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
