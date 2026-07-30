// RevenueCat → Supabase webhook. Mirrors entitlement state onto profiles so the
// database can enforce quotas without trusting the client.
//
// RevenueCat dashboard → Integrations → Webhooks:
//   URL:    https://<project>.functions.supabase.co/revenuecat-webhook
//   Header: Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>
//
// Deploy: supabase functions deploy revenuecat-webhook --no-verify-jwt
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ENTITLEMENT = 'premium_access';

type RCEvent = {
  event: {
    type: string;
    app_user_id: string;
    entitlement_ids?: string[] | null;
    expiration_at_ms?: number | null;
  };
};

Deno.serve(async (req) => {
  if (req.headers.get('Authorization') !== `Bearer ${Deno.env.get('REVENUECAT_WEBHOOK_SECRET')}`) {
    return new Response('unauthorised', { status: 401 });
  }

  const { event } = (await req.json()) as RCEvent;
  if (!event.entitlement_ids?.includes(ENTITLEMENT)) return new Response('ignored');

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const active = !['EXPIRATION', 'CANCELLATION', 'SUBSCRIPTION_PAUSED', 'REFUND'].includes(
    event.type,
  );

  const { error } = await admin
    .from('profiles')
    .update({
      plan_tier: active ? 'premium' : 'free',
      premium_until: event.expiration_at_ms
        ? new Date(event.expiration_at_ms).toISOString()
        : null,
    })
    .eq('id', event.app_user_id); // app_user_id === Supabase auth uid

  return error ? new Response(error.message, { status: 500 }) : new Response('ok');
});
