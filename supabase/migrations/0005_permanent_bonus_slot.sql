-- Free tier: 4 permanent slots, plus exactly ONE permanent rewarded-ad slot,
-- claimable once per account and never expiring.
--
-- Replaces the previous model (up to 2 concurrent slots, each living 24 hours).
-- The 24-hour concept is removed entirely: `expires_at` is dropped rather than
-- left nullable, so no code path can reintroduce a timer against this table.
--
-- Apply in the SQL Editor. `setup.sql` carries the same end state for fresh
-- installs — see the warning in README about not mixing the two paths.

begin;

-- ── 1. Collapse historical multi-grants to one row per user ─────────────────
-- The unique constraint below cannot be created while anyone holds two rows.
-- Keep the earliest grant so the user's original reward date survives.
delete from public.bonus_slots a
  using public.bonus_slots b
 where a.user_id = b.user_id
   and (a.granted_at > b.granted_at
        or (a.granted_at = b.granted_at and a.id > b.id));

-- ── 2. The slot is permanent — remove every trace of expiry ─────────────────
-- Dropping the column also drops bonus_slots_active_idx, which indexed it.
alter table public.bonus_slots drop column if exists expires_at;

-- ── 3. One rewarded slot per account, enforced by the database ──────────────
-- This is the real guarantee behind "the ad can only be used once". Even if the
-- Edge Function were called twice, or its own check raced, the second insert
-- fails here.
alter table public.bonus_slots drop constraint if exists bonus_slots_user_once;
alter table public.bonus_slots add  constraint bonus_slots_user_once unique (user_id);

-- ── 4. Allowance: 4 + (1 once the reward is claimed) ────────────────────────
-- `least(..., 1)` is belt-and-braces alongside the unique constraint: the
-- allowance can never exceed 5 for a free user regardless of table contents.
create or replace function public.item_allowance(uid uuid)
returns int language sql stable security definer set search_path = public as $$
  select case
    when public.is_premium(uid) then 2147483647
    else 4 + least(
      (select count(*)::int from public.bonus_slots where user_id = uid),
      1 -- exactly one permanent rewarded slot, ever
    )
  end;
$$;

grant execute on function public.item_allowance(uuid) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
