-- Vaultly initial schema
-- Tables: profiles, vault_items, warranties, subscriptions, bonus_slots
-- Every table is protected by RLS scoped to auth.uid().

create extension if not exists "pgcrypto";

-- ── enums ───────────────────────────────────────────────────────────────────
create type item_kind as enum ('receipt', 'warranty', 'subscription');
create type billing_period as enum ('weekly', 'monthly', 'quarterly', 'yearly');
create type plan_tier as enum ('free', 'premium');
create type ocr_status as enum ('pending', 'processing', 'done', 'failed', 'manual');

-- ── profiles ────────────────────────────────────────────────────────────────
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text,
  locale        text not null default 'en' check (locale in ('en', 'ar')),
  currency      text not null default 'SAR',
  plan_tier     plan_tier not null default 'free',
  -- mirrored from RevenueCat webhooks; the client never writes this.
  premium_until timestamptz,
  push_token    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── vault_items ─────────────────────────────────────────────────────────────
create table public.vault_items (
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

create index vault_items_user_created_idx on public.vault_items (user_id, created_at desc);
create index vault_items_kind_idx on public.vault_items (user_id, kind);

-- ── warranties ──────────────────────────────────────────────────────────────
create table public.warranties (
  id             uuid primary key default gen_random_uuid(),
  item_id        uuid not null references public.vault_items (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  -- when the receipt does not state a term the app asks the user (1 year default)
  duration_months int,
  expires_on     date not null,
  provider       text,
  reminder_days  int[] not null default '{30,7,1}',
  created_at     timestamptz not null default now()
);

create index warranties_expiry_idx on public.warranties (user_id, expires_on);

-- ── subscriptions (the user's own tracked subscriptions, not app billing) ────
create table public.subscriptions (
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

create index subscriptions_renewal_idx on public.subscriptions (user_id, next_renewal);

-- ── bonus_slots (rewarded-ad grants) ────────────────────────────────────────
-- One row per completed rewarded ad. Server-side source of truth so the grant
-- survives reinstall and cannot be forged by editing local storage.
create table public.bonus_slots (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  source      text not null default 'rewarded_ad',
  granted_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

create index bonus_slots_active_idx on public.bonus_slots (user_id, expires_at desc);

-- ── updated_at triggers ─────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
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
      (select count(*)::int from public.bonus_slots
        where user_id = uid and expires_at > now()),
      2 -- max 2 concurrent rewarded-ad slots
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

create trigger vault_items_quota before insert on public.vault_items
  for each row execute function public.enforce_item_quota();

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.profiles      enable row level security;
alter table public.vault_items   enable row level security;
alter table public.warranties    enable row level security;
alter table public.subscriptions enable row level security;
alter table public.bonus_slots   enable row level security;

create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);
-- plan_tier / premium_until are written only by the RevenueCat webhook
-- (service role bypasses RLS), so no client insert policy is needed.

create policy "items: all own" on public.vault_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "warranties: all own" on public.warranties
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "subscriptions: all own" on public.subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "bonus_slots: read own" on public.bonus_slots
  for select using (auth.uid() = user_id);
-- inserts happen through the verify-reward Edge Function (service role) so a
-- user cannot mint slots without actually completing an ad.
