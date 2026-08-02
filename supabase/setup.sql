-- ═══════════════════════════════════════════════════════════════════════════
-- Vaultly — full schema setup.
--
-- This is migrations/0001_init.sql + 0002_storage.sql merged and made
-- re-runnable, so it can be pasted straight into the Supabase SQL Editor
-- (Dashboard → SQL Editor → New query → paste → Run).
--
-- Safe to run more than once: every object is guarded.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── enums ───────────────────────────────────────────────────────────────────
do $$ begin
  create type item_kind as enum ('receipt', 'warranty', 'subscription');
exception when duplicate_object then null; end $$;

do $$ begin
  create type billing_period as enum ('weekly', 'monthly', 'quarterly', 'yearly');
exception when duplicate_object then null; end $$;

do $$ begin
  create type plan_tier as enum ('free', 'premium');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ocr_status as enum ('pending', 'processing', 'done', 'failed', 'manual');
exception when duplicate_object then null; end $$;

-- ── profiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text,
  -- keep this list in step with SUPPORTED_LOCALES (src/constants/config.ts)
  locale        text not null default 'en' check (locale in ('en', 'ar', 'es', 'fr', 'de')),
  currency      text not null default 'SAR',
  plan_tier     plan_tier not null default 'free',
  -- mirrored from RevenueCat webhooks; the client never writes this.
  premium_until timestamptz,
  push_token    text,
  -- local-reminder preferences, surfaced as the Settings toggles
  warranty_reminders boolean not null default true,
  renewal_reminders  boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- `create table if not exists` is a no-op on a database created before the
-- columns above existed, so the same changes are re-applied as alters. This is
-- what keeps setup.sql correct for fresh *and* existing projects. Mirrors
-- migrations/0004_profile_prefs.sql.
alter table public.profiles
  drop constraint if exists profiles_locale_check;
alter table public.profiles
  add constraint profiles_locale_check
  check (locale in ('en', 'ar', 'es', 'fr', 'de'));
alter table public.profiles
  add column if not exists warranty_reminders boolean not null default true;
alter table public.profiles
  add column if not exists renewal_reminders boolean not null default true;

-- ── vault_items ─────────────────────────────────────────────────────────────
create table if not exists public.vault_items (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  kind            item_kind not null default 'receipt',
  merchant_name   text not null,
  total_amount    numeric(12, 2),
  currency        text not null default 'SAR',
  purchase_date   date,
  category        text,
  notes           text,
  -- path inside the private `receipts` storage bucket: <user_id>/<uuid>.jpg
  image_path      text,
  ocr_status      ocr_status not null default 'pending',
  ocr_raw         jsonb,
  ocr_confidence  numeric(4, 3),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists vault_items_user_created_idx
  on public.vault_items (user_id, created_at desc);
create index if not exists vault_items_kind_idx
  on public.vault_items (user_id, kind);

-- ── warranties ──────────────────────────────────────────────────────────────
create table if not exists public.warranties (
  id              uuid primary key default gen_random_uuid(),
  item_id         uuid not null references public.vault_items (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  -- when the receipt does not state a term the app asks the user (1 year default)
  duration_months int,
  expires_on      date not null,
  provider        text,
  reminder_days   int[] not null default '{30,7,1}',
  created_at      timestamptz not null default now()
);

create index if not exists warranties_expiry_idx
  on public.warranties (user_id, expires_on);

-- ── subscriptions (the user's tracked subscriptions, not app billing) ───────
create table if not exists public.subscriptions (
  id             uuid primary key default gen_random_uuid(),
  item_id        uuid references public.vault_items (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  name           text not null,
  amount         numeric(12, 2) not null,
  currency       text not null default 'SAR',
  period         billing_period not null default 'monthly',
  next_renewal   date not null,
  auto_renews    boolean not null default true,
  reminder_days  int[] not null default '{3,1}',
  created_at     timestamptz not null default now()
);

create index if not exists subscriptions_renewal_idx
  on public.subscriptions (user_id, next_renewal);

-- ── bonus_slots (rewarded-ad grants) ────────────────────────────────────────
-- One permanent slot per account, claimed by watching a single rewarded ad.
-- There is deliberately no expiry column: the slot never lapses, and the unique
-- constraint is what makes "the ad can only be used once" true at the database
-- level rather than only in the Edge Function.
create table if not exists public.bonus_slots (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  source      text not null default 'rewarded_ad',
  granted_at  timestamptz not null default now(),
  constraint bonus_slots_user_once unique (user_id)
);

-- ── updated_at triggers ─────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists vault_items_touch on public.vault_items;
create trigger vault_items_touch before update on public.vault_items
  for each row execute function public.touch_updated_at();

-- ── auto-create a profile on signup ─────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, locale)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'locale', 'en')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── quota helpers (authoritative monetization rule, enforced in the DB) ──────
create or replace function public.is_premium(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select plan_tier = 'premium' and (premium_until is null or premium_until > now())
     from public.profiles where id = uid),
    false
  );
$$;

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

create or replace function public.enforce_item_quota()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  used int;
  allowed int;
begin
  select count(*) into used from public.vault_items where user_id = new.user_id;
  allowed := public.item_allowance(new.user_id);
  if used >= allowed then
    raise exception 'VAULTLY_QUOTA_EXCEEDED: % of % items used', used, allowed
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists vault_items_quota on public.vault_items;
create trigger vault_items_quota before insert on public.vault_items
  for each row execute function public.enforce_item_quota();

-- The app calls these two through PostgREST, so the client roles need EXECUTE.
grant execute on function public.is_premium(uuid)     to anon, authenticated;
grant execute on function public.item_allowance(uuid) to anon, authenticated;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.profiles      enable row level security;
alter table public.vault_items   enable row level security;
alter table public.warranties    enable row level security;
alter table public.subscriptions enable row level security;
alter table public.bonus_slots   enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);
-- plan_tier / premium_until are written only by the RevenueCat webhook
-- (service role bypasses RLS), so no client insert policy is needed.

drop policy if exists "items: all own" on public.vault_items;
create policy "items: all own" on public.vault_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "warranties: all own" on public.warranties;
create policy "warranties: all own" on public.warranties
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "subscriptions: all own" on public.subscriptions;
create policy "subscriptions: all own" on public.subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "bonus_slots: read own" on public.bonus_slots;
create policy "bonus_slots: read own" on public.bonus_slots
  for select using (auth.uid() = user_id);
-- inserts happen through the grant-bonus-slot Edge Function (service role) so a
-- user cannot mint slots without actually completing an ad.

-- ── storage: private bucket for receipt images ──────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts', 'receipts', false, 10485760,
  array['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "receipts: read own folder" on storage.objects;
create policy "receipts: read own folder" on storage.objects
  for select using (
    bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "receipts: upload to own folder" on storage.objects;
create policy "receipts: upload to own folder" on storage.objects
  for insert with check (
    bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "receipts: update own folder" on storage.objects;
create policy "receipts: update own folder" on storage.objects
  for update using (
    bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "receipts: delete own folder" on storage.objects;
create policy "receipts: delete own folder" on storage.objects
  for delete using (
    bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Make PostgREST pick the new objects up immediately.
notify pgrst, 'reload schema';
