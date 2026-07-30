-- The client calls is_premium / item_allowance through PostgREST (see
-- services/receipts.ts → fetchQuota). Both are SECURITY DEFINER, but PostgREST
-- still needs EXECUTE for the client roles — without this the functions exist
-- yet every call returns PGRST202 "function not found in the schema cache",
-- and the quota system silently fails.
--
-- Already included in supabase/setup.sql; this migration exists so the
-- `supabase db push` path produces the same result.

grant execute on function public.is_premium(uuid)     to anon, authenticated;
grant execute on function public.item_allowance(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
