# Vaultly — foundational setup

Smart digital vault for receipts, warranties and subscriptions.
React Native + Expo (TypeScript), expo-router, Supabase, Gemini OCR, RevenueCat, AdMob.

## Run

```bash
npm install
npx expo start            # scan the QR code with Expo Go
```

That works with no keys at all — see **Mock mode** below.

For the real AdMob and RevenueCat SDKs you need a dev client, because both are
native modules that Expo Go cannot load:

```bash
npx expo prebuild         # native dirs
npm run ios               # or: npm run android
```

## Mock mode

`.env` ships empty, so the app boots against the in-memory backend in
`src/mocks` — signed in as a demo profile, seeded with the data from the design
boards (one warranty per urgency tier, two subscriptions, three invoices).
Every screen, list, filter, form and empty state is reachable; writes live in
memory and reset on reload.

The switch is `USE_MOCK_DATA` in `src/constants/config.ts`, derived from whether
the Supabase keys are set. It is read in exactly four places —
`services/receipts.ts`, `services/storage.ts`, `services/gemini.ts` and
`store/authStore.ts` — so no screen, hook or query key knows which backend is
live. Fill in `EXPO_PUBLIC_SUPABASE_URL` and `_ANON_KEY` and the same call sites
hit Postgres instead; set `EXPO_PUBLIC_USE_MOCK_DATA=true` to force mocks even
with keys present.

| Integration | Without keys | With keys |
|---|---|---|
| Supabase | in-memory tables, demo session | real auth + Postgres + storage |
| Gemini | canned extraction (~1.4s) | live OCR |
| RevenueCat | not premium, static price label | real offerings and purchases |
| AdMob | rewarded ad simulated as earned | real rewarded ads (dev build only) |

Quota note: the free-tier counter starts at the design's **3 / 4** rather than
counting the seeded rows, so the quota banner, one working add, and then the
paywall gate are all reachable in sequence. See `src/mocks/backend.ts`.

**TypeScript ≥ 5.4 is required.** `@tanstack/react-query` v5.6+ uses
`NoInfer<T>`, a TS 5.4 built-in; on 5.3 it fails to resolve and every
`useQuery` result silently degrades to `any`. The project is pinned to ~5.5.4.

## Support content

Profile → Help & Support is backed by `src/content/support.ts`: the FAQ, the
Privacy Policy and the Terms, in English and Arabic (other locales fall back to
English via i18next). Prose lives there rather than in the locale JSON, which is
for UI strings.

Contact / Report a bug / Request a feature open a prefilled email with a
per-topic template plus diagnostics (app version, platform, OS, device, locale,
truncated account id — no email address, no item contents). With no mail client
installed the message is copied to the clipboard and the address is shown, so
no option is a dead end.

The address is `EXPO_PUBLIC_SUPPORT_EMAIL`, defaulting to `support@vaultly.app`.

**Before publishing:** the legal documents describe what the app actually does,
but they are not a lawyer's work. Replace `LEGAL_ENTITY` with the registered
operator name, confirm `LEGAL_JURISDICTION_*`, bump `LEGAL_UPDATED`, and have
both documents reviewed.

## Email verification / deep linking

Confirmation stays **on**. The link in the email opens the app directly.

```
sign up ──> Supabase mails {{ .ConfirmationURL }}
              ↓ user taps it
        <project>/auth/v1/verify?...&redirect_to=<our callback>
              ↓ 302 with ?code=
        exp://…/--/auth-callback   (Expo Go)
        vaultly://auth-callback    (dev / production build)
              ↓
        app/auth-callback.tsx → exchangeCodeForSession → signed in
```

The client uses the **PKCE** flow (`flowType: 'pkce'` in `lib/supabase.ts`):
the email carries a single-use `code`, useless without the verifier stored on
the device that started signup. It also survives email clients that prefetch
links, which silently burns an implicit-flow token.

`lib/authRedirect.ts` is the only place the callback URL is built —
`Linking.createURL()` emits the right form per runtime. `lib/authCallback.ts`
redeems whatever comes back, handling all four shapes Supabase can send
(`code`, `token_hash`, `access_token`+`refresh_token` in the fragment, or an
`error` pair), so template or flow changes don't break it.

**Supabase dashboard — Authentication → URL Configuration:**

| Field | Value |
|---|---|
| Site URL | `vaultly://auth-callback` |
| Redirect URLs | `vaultly://auth-callback` |
| | `exp://**/--/auth-callback` (Expo Go — see note) |

The Expo Go host is not fixed: it is `<ip>:8081` on LAN and a `*.exp.direct`
subdomain on a tunnel. The tunnel subdomain is derived from the project path
and account, so it is stable for a given checkout — but it differs per machine,
per clone location, and between LAN and tunnel mode. The wildcard covers all of
them; a literal entry would have to be re-added each time one of those changes.

Without those entries Supabase refuses the redirect and the link dead-ends in
a browser. The scheme comes from `scheme: 'vaultly'` in `app.config.ts`; change
one and you must change the other.

**Cross-device caveat.** PKCE binds the code to the device that signed up. If
someone signs up on their phone and opens the mail on a laptop, the exchange
fails — by design. To support that, switch the *Confirm signup* template to
`{{ .TokenHash }}`; `authCallback.ts` already handles that shape.

## Receipt OCR (AI)

Runs **server-side**. The client sends an image to the `analyze-receipt` Edge
Function, which calls OpenAI with a key held in Supabase secrets and returns
structured fields. **No AI key exists anywhere in the app bundle.**

```
ReceiptScanner → readAsBase64 → services/ocr → analyze-receipt (Deno)
                                                     ↓ OPENAI_API_KEY (secret)
                                                  OpenAI
```

Setup:

```bash
npx supabase secrets set OPENAI_API_KEY=sk-...
npx supabase secrets set OPENAI_MODEL=gpt-4o-mini   # optional, this is the default
npm run fn:deploy                                   # deploy analyze-receipt
npm run fn:logs                                     # tail its logs
```

The CLI is a devDependency (`npx supabase`), so there's nothing to install
globally. `fn:deploy` passes `--use-api`, which bundles server-side — without
it the CLI wants Docker.

JWT verification is left on, so only signed-in users can spend your quota.

`src/services/ocr/` keeps the shape, prompt and validation provider-agnostic:
`edge.ts` is the default, `gemini.ts` is a legacy direct-from-client path that
does put a key in the bundle — opt in with `EXPO_PUBLIC_AI_PROVIDER=gemini`
only if you accept that. With neither available, OCR returns a canned
extraction so the scan flow stays walkable.

## Supabase

Check what a project actually has, using only the publishable key in `.env`:

```bash
npm run db:check
```

It reports the auth endpoint, every table the app touches, the two quota RPCs,
the `receipts` bucket, and whether RLS rejects an anonymous write.

**Creating the schema.** The publishable key cannot run DDL. Either paste
`supabase/setup.sql` into Dashboard → SQL Editor (it is idempotent — safe to
re-run), or link the CLI and push the migrations:

```bash
supabase link --project-ref <ref>
supabase db push                                   # 0001_init.sql, 0002_storage.sql
supabase functions deploy analyze-receipt
supabase functions deploy grant-bonus-slot
supabase functions deploy revenuecat-webhook --no-verify-jwt
supabase secrets set REVENUECAT_WEBHOOK_SECRET=<secret>
npm run db:types                                   # regenerate src/lib/database.types.ts
```

Auth providers: enable Email, Apple and Google in the dashboard and add
`vaultly://auth-callback` as a redirect URL.

## Layout

```
app/                       expo-router routes
  _layout.tsx              i18n boot, providers, auth redirect gate
  (auth)/                  sign-in, sign-up (email + Apple/Google)
  (tabs)/                  home · centre FAB · profile (three-slot bar)
  invoices | warranties | subscriptions   "View all" pages (not in the tab bar)
  item/new.tsx             scan → OCR review → AI detection → save
  item/add-warranty.tsx    manual warranty, no receipt needed
  item/add-subscription.tsx  manual subscription
  item/[id].tsx            item detail
  paywall.tsx              10 SAR/month premium_access
src/
  i18n/                    i18next init, languages.ts registry, RTL helpers, 5 locale files
  lib/                     supabase client, query client, DB types, errors
  mocks/                   in-memory backend + seed rows (see "Mock mode")
  services/                gemini, storage, receipts, purchases, ads, notifications
  store/                   authStore, entitlementStore (zustand)
  hooks/                   useSession, useItems, useItemQuota, usePremium, usePaywall
  components/              Button, ItemCard, QuotaBanner
  theme/                   colors, spacing, locale-aware type scale
supabase/
  migrations/              schema, RLS, quota trigger, storage bucket
  functions/               grant-bonus-slot, revenuecat-webhook
```

## Localization & RTL

Shipping languages: **English, العربية (RTL), Español, Français, Deutsch**.

Adding a language is three edits, no screen changes:

1. `src/i18n/locales/<code>.json` — copy `en.json` and translate.
2. `src/i18n/languages.ts` — one `LANGUAGES` entry (`nativeName`, `englishName`, `rtl`, `intlTag`).
3. `src/constants/config.ts` — add the code to `SUPPORTED_LOCALES`; import it in `src/i18n/index.ts`
   (RN's bundler has no dynamic require, so resources are registered statically).

Optional: `src/i18n/native/<code>.json` for the store/permission strings, wired in `app.config.ts`.

- `initI18n()` runs before first paint so direction applies to the initial tree.
- The picker (`components/LanguagePicker.tsx`) is a scrollable bottom sheet rendered from
  `LANGUAGES`; the header pill and the Settings row both open it via `hooks/useLanguage.ts`.
- LTR → LTR switches apply instantly. Crossing the LTR↔RTL boundary needs a native
  reload, so the app confirms first, then calls `Updates.reloadAsync()`.
- Layout rule: **logical properties only** (`paddingStart`, `marginEnd`, `start`/`end`,
  `textAlign: 'left'`). RN flips these automatically. `useDirection()` covers what
  RN doesn't flip: icon mirroring, transforms, raw x-offsets.
- Arabic gets a slightly larger size and looser leading via `typeScale(locale)`.
- Numbers, currency and dates go through `formatCurrency` / `formatDate`, which read
  each language's `intlTag` (`ar-SA`, `es-ES`, `fr-FR`, `de-DE`, …).
- Arabic plurals need `compatibilityJSON: 'v3'` (already set) — which is also why
  `relative.daysLeft` ships six Arabic forms (`_0`…`_5`) and a `_plural` form elsewhere.

## Relative countdowns

Warranty and subscription dates are never shown as bare dates in a status position.
`src/i18n/relativeTime.ts` owns the wording: `countdownLabel(t, days, kind)` →
"12 days left" / "Expires today" / "Expired 3 days ago" / "متبقٍ ١٢ يومًا", and
`countdownTone(days)` returns the urgency tier used for colour only. Day maths runs on
calendar days at local midnight, so "expires today" doesn't flicker with the clock.
Consumers: `StatusBadge`, `ItemCard`, `WarrantyCountdown` and the dashboard
"needs attention" list. Absolute dates stay as captions on the detail screen.
`listItems()` joins `warranties`/`subscriptions` so every card has a date to count from.

## Monetization

Rules live in one place, `MONETIZATION` in `src/constants/config.ts`, and are
enforced twice — client for UX, database for truth:

| | Free | Premium (`premium_access`, 10 SAR/mo) |
|---|---|---|
| Items | 4 | Unlimited |
| Rewarded ads | +1 slot per ad, 24h, max 2 active | Never shown |

- `useItemQuota()` is the only quota API the UI touches.
- The DB trigger `enforce_item_quota` + `item_allowance(uid)` reject over-quota
  inserts regardless of client state; `receipts.ts` maps that error to
  `QuotaExceededError` so the UI can open the paywall.
- Bonus slots are minted by the `grant-bonus-slot` Edge Function only after the
  AdMob SDK fires `EARNED_REWARD`. Clients cannot insert into `bonus_slots` (RLS).
- `usePremium().showAds` is the single ad gate — premium is ad-free by construction.

## Known gaps (deliberate, for the next pass)

1. **Gemini key ships in the client.** Fine for prototyping, not for release —
   move `extractReceipt` behind an Edge Function; it's the only call site.
2. Offline is out of scope (online-only, as agreed) — no local cache or sync queue.
3. Subscription tracking has schema + notifications but no UI screen yet.
4. Store setup (SAR 10 product, App Store / Play Console) still needs doing before
   RevenueCat offerings resolve; the paywall falls back to a static price label.
5. Notification toggles in Settings are local state — wire them to profile prefs.
6. No test suite or CI yet.

## Navigation & the "+" FAB

The bar has three slots: **Home · FAB · Profile**. The centre slot is a spacer tab
(`add-placeholder`) whose `tabPress` is cancelled — the visible control is an elevated
circular FAB rendered above the bar in `app/(tabs)/_layout.tsx`, so it stays put on every
tab. It never opens the camera directly: it sets `useUIStore.addSheetOpen`, and
`components/AddSheet.tsx` offers **Scan receipt · Add warranty · Add subscription**.
The free-tier quota is checked once, in the sheet, so no destination screen repeats it.

Invoices, warranties and subscriptions each have a full-list page reached by **View all**;
they are Stack routes, so Back always returns to Home.

## Smart detection

Gemini classifies each receipt (`purchaseType: 'subscription' | 'product' | 'unknown'`) and
extracts the fields that classification implies — service name, billing cycle and next
renewal for subscriptions; product name, merchant and purchase date for products.
After a scan, `DetectionSheet` asks once, then routes to the matching form with every
detected value pre-filled as route params, so the user only confirms what OCR couldn't read.
`'unknown'` skips the prompt and saves a plain invoice.
