-- ═══════════════════════════════════════════════════════════════════════════
-- 0004 — profile preferences
--
-- Two changes, both to public.profiles:
--
-- 1. Widen the `locale` CHECK. 0001 constrained it to ('en','ar') but the app
--    ships five locales (SUPPORTED_LOCALES in src/constants/config.ts:97).
--    `useSyncProfileLocale` writes i18n.language without awaiting or checking
--    the result, so picking Spanish, French or German raised 23514 and the
--    locale silently never persisted. Keep this list in step with
--    SUPPORTED_LOCALES.
--
-- 2. Add the two notification preference columns. The Settings toggles were
--    local `useState` and reset on every app launch.
--
-- Idempotent — safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1 ── locale ---------------------------------------------------------------
alter table public.profiles
  drop constraint if exists profiles_locale_check;

alter table public.profiles
  add constraint profiles_locale_check
  check (locale in ('en', 'ar', 'es', 'fr', 'de'));

-- 2 ── notification preferences ---------------------------------------------
-- Default true: reminders are the product's reason to exist, so an existing
-- row that predates these columns keeps getting them.
alter table public.profiles
  add column if not exists warranty_reminders boolean not null default true;

alter table public.profiles
  add column if not exists renewal_reminders boolean not null default true;

comment on column public.profiles.warranty_reminders is
  'User preference: schedule local reminders before a warranty expires.';
comment on column public.profiles.renewal_reminders is
  'User preference: schedule local reminders before a subscription renews.';
