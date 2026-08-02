# Vaultly — Project State & Production Handoff

> ⚠️ **SUPERSEDED IN PLACES — read `HANDOVER.md` first.**
>
> `HANDOVER.md` was verified 2026-08-02 and is newer than this file. Where the
> two disagree, **HANDOVER.md is correct**. Known drift in this document:
>
> - §5 and §14 describe `react-native-google-mobile-ads` as an installed
>   dependency. **It has been removed** — with no app IDs configured it
>   autolinked a native SDK with a blank `APPLICATION_ID`, the diagnosed cause of
>   the Android launch crash and the EAS build failure. See HANDOVER.md §11/§14.
> - §1 and §20 say the project is not a git repository and needs `git init`.
>   **It is a repo**, and all work is committed.
> - §3 says `USE_MOCK_DATA` is read in exactly four places — it is now read in
>   eight.
> - §5 predates `expo-sharing` and `expo-dev-client` being added.
> - §7 auth providers have changed: Google is now **enabled**.
> - §19–§22 predate a large body of work; see HANDOVER.md §16 and §20.
>
> The architecture, design rationale, RTL/plural rules and historical bug
> post-mortems below remain accurate and are still worth reading.

**Last verified:** 2026-07-29 · every claim below was checked against the live
project and the working tree on that date, not recalled.

**Verification snapshot at handoff:**

| Gate | Command | Result |
|---|---|---|
| Types | `npx tsc --noEmit` | clean |
| Unit tests | `npm test` | 62 pass / 0 fail, 12 suites |
| Database | `npm run db:check` | 10/10 PASS |
| Edge Function | `npm run fn:check` | 4/4 PASS, deployed |
| Bundles | Metro, android + ios | HTTP 200, ~10.4 MB each |

**Not yet verified anywhere:** the real OCR round-trip and every
authenticated-user path. See [Blocker](#the-one-blocker).

---

## 1. Project overview

Vaultly is a React Native (Expo) mobile app that stores a person's **receipts,
warranties and subscriptions** and warns them before something lapses. You
photograph a receipt, an AI model reads the merchant / total / date / warranty
term, you confirm, and it lands in your vault with a live countdown and local
reminders.

- **Platforms:** iOS and Android only (`platforms: ['ios','android']`). No web.
- **Languages:** English, Arabic (full RTL), Spanish, French, German.
- **Primary market:** Saudi Arabia — SAR default currency, Hijri→Gregorian date
  conversion in the OCR prompt, Arabic as a first-class RTL locale.
- **Monetization:** free tier of 4 items, +1 slot per rewarded ad (24h, max 2),
  Premium at SAR 10/month for unlimited and ad-free.

**Where the code lives:**
`C:\Users\عدي\OneDrive\سطح المكتب\تطبيق 1\Vaultly Digital Vault Setup\vaultly`

Note the **two nested folders** — the outer `Vaultly Digital Vault Setup\`
contains the design files, the inner `vaultly\` is the app. Almost every
"file not found" confusion in this project traced back to that nesting.

⚠️ **The project is not a git repository.** There is no version control and no
rollback other than a manual copy. A pre-SDK-54 snapshot exists at
`../_backup-sdk51-20260728-225812`. **Running `git init` should be an early
task.**

⚠️ The project sits inside a **OneDrive-synced** folder. Two consequences: files
can change under you mid-edit while OneDrive syncs (this happened repeatedly),
and `.env` contents are uploaded to Microsoft's cloud despite being gitignored.

---

## 2. Product vision

A vault that is *quiet until it matters*. The design goal is that opening the app
answers one question — "is anything about to expire?" — before you read anything
else. Concretely:

- **Countdowns, never bare dates, in a status position.** "16 days left",
  "Expires today", "Renews in 3 days". Absolute dates are demoted to captions.
- **Urgency is colour only, never wording.** `countdownTone()` returns the tier;
  the words come from translation keys so no locale gets an English pattern.
- **Needs Attention merges warranties and renewals** into one urgency-ranked
  list, so the user does not have to check two places.
- **The scan is a first draft, not the truth.** Every extracted field is
  editable before saving, confidence is surfaced, and the app never saves
  silently.

---

## 3. Current architecture

```
┌─────────────────── Expo app (SDK 54, RN 0.81, React 19) ───────────────────┐
│ app/            expo-router file routes (file-based, built on React Nav 7) │
│ src/components  presentational + one shared picker per domain              │
│ src/hooks       react-query wrappers, one concern each                     │
│ src/services    all I/O: ocr/, receipts, storage, notifications, purchases │
│ src/store       zustand: auth, entitlement, ui                             │
│ src/lib         supabase client, dateMath, authCallback, errors, types     │
│ src/mocks       in-memory backend, swapped in by one flag                  │
└───────────────────────────────────────────────────────────────────────────┘
        │                        │                         │
   Supabase                analyze-receipt            RevenueCat / AdMob
   Postgres + Auth         Edge Function (Deno)       (native, not wired)
   + private Storage       holds OPENAI_API_KEY
```

**Three architectural rules that the whole codebase depends on:**

1. **One backend switch.** `USE_MOCK_DATA` in `src/constants/config.ts` is read
   in exactly **four** places — `services/receipts.ts`, `services/storage.ts`,
   `services/ocr/index.ts`, `store/authStore.ts`. No screen, hook or query key
   knows which backend is live. Never add a fifth read; delegate instead.
2. **No AI key in the client, ever.** OCR goes through the Edge Function. There
   is deliberately no `openaiApiKey` field in `config.ts` or `app.config.ts`.
3. **All date arithmetic goes through `src/lib/dateMath.ts`.** It has zero app
   imports so it runs under a bare test runner, and it is the only module
   allowed to do calendar maths.

---

## 4. Folder structure

```
vaultly/
├── PROJECT_STATE.md            ← this file
├── README.md                   operational runbook (setup, deploy, gotchas)
├── app.config.ts               Expo config; env → `extra`
├── tsconfig.json               strict, noUncheckedIndexedAccess, allowImportingTsExtensions
├── babel.config.js             babel-preset-expo + module-resolver (@/ → src/)
├── eas.json                    dev / preview / production build profiles
├── .env                        gitignored, real values
├── .env.example                committed placeholders
├── assets/
│   └── notification-icon.png   PLACEHOLDER — generated, replace with real art
├── scripts/
│   ├── check-supabase.mjs      npm run db:check   — schema/RLS/storage audit
│   ├── check-function.mjs      npm run fn:check   — Edge Function guards
│   ├── smoke-supabase.mjs      npm run db:smoke   — live end-to-end (blocked)
│   └── fixtures/sample-receipt.png   legible synthetic receipt for OCR tests
├── supabase/
│   ├── setup.sql               ★ full schema, idempotent, APPLIED
│   ├── migrations/0001_init.sql, 0002_storage.sql, 0003_rpc_grants.sql
│   ├── functions/analyze-receipt/     DEPLOYED
│   ├── functions/grant-bonus-slot/    NOT deployed
│   └── functions/revenuecat-webhook/  NOT deployed
├── app/                        (21 route files — see §16)
└── src/                        (67 files — see §3)
```

---

## 5. Tech stack

**Exact installed versions** (do not bump casually; several are pinned for real
reasons documented in §24):

| Package | Version | Note |
|---|---|---|
| expo | ^54.0.36 | SDK 54 |
| react-native | 0.81.5 | |
| react | 19.1.0 | |
| react-dom | 19.1.0 | via `overrides` — see §24 |
| expo-router | ~6.0.24 | file-based, on React Navigation 7 |
| typescript | ~5.9.2 | **must stay ≥5.4** — see §24 |
| @tanstack/react-query | ^5.59.0 | resolves to 5.101.x |
| @supabase/supabase-js | ^2.45.4 | |
| zustand | ^4.5.5 | |
| i18next / react-i18next | ^23.15.1 / ^15.0.2 | `compatibilityJSON: 'v3'` |
| babel-preset-expo | ~54.0.10 | direct devDep, required |
| expo-font | ~14.0.12 | direct dep, required by vector-icons |
| supabase (CLI) | ^2.110.0 | devDependency → `npx supabase` |
| @expo/ngrok | ^4.1.3 | devDep, for `--tunnel` |

Native modules present but **not exercised**: `react-native-purchases` ^8.2.2,
`react-native-google-mobile-ads` ^14.2.5. Both are lazily `require()`d and
absent from Expo Go (§11, §13).

**Styling:** no NativeWind. Design tokens in `src/theme/index.ts` +
`src/theme/urgency.ts`, applied as inline style objects. Keep it that way.

**Node:** v24.18.0. Tests use Node's built-in runner with native TS stripping —
no Jest, no ts-node.

---

## 6. Environment variables

All client vars must be prefixed `EXPO_PUBLIC_` to reach the app;
`app.config.ts` copies them into `extra`, and `src/constants/config.ts` is the
only module that reads `extra`. **Restart the dev server after any `.env`
change** — it is read at startup only.

Current `.env` state:

| Variable | State | Meaning |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | **set** | `https://baxlbbuxwajlzgdvpykw.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | **set** | `sb_publishable_…` (new-style publishable key) |
| `EXPO_PUBLIC_USE_MOCK_DATA` | empty | blank ⇒ **live** database |
| `EXPO_PUBLIC_AI_PROVIDER` | empty | blank ⇒ `edge` (Edge Function) |
| `EXPO_PUBLIC_GEMINI_API_KEY` | empty | legacy client-side path, unused |
| `EXPO_PUBLIC_GEMINI_MODEL` | set | `gemini-2.0-flash` (inert) |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` | empty | Premium inactive |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | empty | Premium inactive |
| `EXPO_PUBLIC_ADMOB_*` (4) | empty | ads inactive; plugin omitted from build |
| `EAS_PROJECT_ID` | empty | needed for push tokens + EAS builds |
| `EXPO_PUBLIC_SUPPORT_EMAIL` | not present | defaults to `support@vaultly.app` |

**There is deliberately no `EXPO_PUBLIC_OPENAI_API_KEY`.** Adding one would
compile a billable account-wide key into the app bundle. The key is a Supabase
secret (§9).

---

## 7. Supabase configuration

- **Project ref:** `baxlbbuxwajlzgdvpykw`
- **Region:** `ap-south-1` · **Postgres:** 17.6.1 · **Status:** ACTIVE_HEALTHY
- **CLI:** logged in and **linked** (`supabase/.temp/project-ref` present)

**Auth — current settings (verified live):**

| Setting | Value | Consequence |
|---|---|---|
| Providers enabled | `email` **only** | Apple/Google buttons on sign-in will fail |
| `mailer_autoconfirm` | `false` | **confirmation required** — this is the blocker |
| `disable_signup` | `false` | signups open |
| Anonymous sign-in | disabled | no way to obtain a test JWT |

**URL configuration — MUST be set for email verification to work.** Verify these
are present; the flow silently dead-ends in a browser if not:

- Site URL: `vaultly://auth-callback`
- Redirect URLs: `vaultly://auth-callback` **and** `exp://**/--/auth-callback`

The wildcard is required because the Expo Go host differs between LAN
(`<ip>:8081`) and tunnel (`*.exp.direct`), and per machine.

**Secrets set on the project** (names verified; values are hashed by the API and
were never read):
`OPENAI_API_KEY` plus the eight auto-injected `SUPABASE_*` secrets.

---

## 8. Database schema

Applied via `supabase/setup.sql` in the SQL Editor. `db:check` confirms all
objects live. `setup.sql` is **idempotent** — safe to re-run.

**Tables** (all with RLS enabled, scoped to `auth.uid()`):

| Table | Purpose | Key columns |
|---|---|---|
| `profiles` | one row per user, auto-created on signup | `id`→auth.users, `display_name`, `locale`, `currency`, `plan_tier`, `premium_until`, `push_token` |
| `vault_items` | the vault; one row per receipt/warranty/subscription | `kind` (enum), `merchant_name`, `total_amount`, `currency`, `purchase_date`, `category`, `image_path`, `ocr_status`, `ocr_raw`, `ocr_confidence` |
| `warranties` | 1:1 with an item | `item_id`, `expires_on` (date, NOT NULL), `duration_months`, `reminder_days` `{30,7,1}` |
| `subscriptions` | 1:1 with an item | `name`, `amount`, `period` (enum), `next_renewal` (date, NOT NULL), `auto_renews`, `reminder_days` `{3,1}` |
| `bonus_slots` | rewarded-ad grants, server-minted | `source`, `granted_at`, `expires_at` |

**Enums:** `item_kind`, `billing_period`, `plan_tier`, `ocr_status`.

**Indexes:** `vault_items(user_id, created_at desc)`, `vault_items(user_id, kind)`,
`warranties(user_id, expires_on)`, `subscriptions(user_id, next_renewal)`,
`bonus_slots(user_id, expires_at desc)`.

**Functions:** `touch_updated_at`, `handle_new_user`, `is_premium(uuid)`,
`item_allowance(uuid)`, `enforce_item_quota`.

**Triggers:** `profiles_touch`, `vault_items_touch`,
`on_auth_user_created` (creates the profile row),
`vault_items_quota` (BEFORE INSERT — the authoritative quota check).

**Policies (10):** read/update own profile; full CRUD on own items, warranties,
subscriptions; read-only own bonus_slots (inserts are service-role only, so a
user cannot mint slots without watching an ad); four `storage.objects` policies
scoping the `receipts` bucket to a folder named after the user id.

**Non-obvious but essential:** the client calls `is_premium` and `item_allowance`
through PostgREST, which needs `GRANT EXECUTE` **in addition to** SECURITY
DEFINER. `0001_init.sql` omits this; `setup.sql` and `0003_rpc_grants.sql` add
it. Without the grant the functions exist but every call returns `PGRST202` and
the quota system silently fails.

**⚠️ Pick one migration path, never both.** `setup.sql` does not record itself in
Supabase migration history, so a later `supabase db push` would try to apply
`0001_init.sql` from scratch — and that file uses bare `create type`, which
errors when the enums already exist.

`src/lib/database.types.ts` is **hand-written** with empty `Relationships`, which
is why `services/receipts.ts` casts the embedded join through `unknown`. Running
`npm run db:types` against the live schema would remove those casts.

---

## 9. Edge Functions

| Function | Status | verify_jwt |
|---|---|---|
| `analyze-receipt` | **ACTIVE**, version 1 | `true` |
| `grant-bonus-slot` | in repo, **not deployed** | — |
| `revenuecat-webhook` | in repo, **not deployed** | — |

Deploy with `npm run fn:deploy` (which passes `--use-api`; **Docker is not
installed** on this machine and the default deploy path wants it).

`analyze-receipt` accepts `POST {imageBase64, mimeType}`, verifies the caller's
JWT, rejects oversized (>8 MB base64) and non-image payloads, calls OpenAI, and
returns `{data: <extraction>}` or `{error: {reason, message}}` where `reason`
matches the client's union so the UI can distinguish quota / auth / unreadable.
Upstream 401s are logged server-side and returned as a generic 502 — the key is
never echoed.

`fn:check` (4/4 PASS) verifies deployment, CORS preflight, the method guard and
the auth guard. Body-validation branches sit behind the auth gate by design and
are covered only by `db:smoke`.

**Note:** an invalid JWT is rejected by Supabase's **gateway** before reaching
the function, so it returns the platform's shape
(`{"code":"UNAUTHORIZED_LEGACY_JWT"}`) rather than ours. `services/ocr/edge.ts`
maps any 401 to `reason: 'auth'` for this reason.

---

## 10. OpenAI OCR implementation

**Architecture:** provider-agnostic, server-side by default.

```
src/services/ocr/
├── types.ts    shape, prompt, JSON schema, normalise(), date helpers
├── edge.ts     DEFAULT — POSTs to analyze-receipt with the session JWT
├── gemini.ts   legacy: direct client call, key in bundle (opt-in only)
└── index.ts    extractReceipt() — dispatches on AI_PROVIDER
```

Screens import only `@/services/ocr`. Every provider returns the same
`normalise()`d `ReceiptExtraction`, so swapping models cannot change what the UI
receives. Adding a provider = one file + one branch in `index.ts`.

- **Model:** `gpt-4o-mini` (override with the `OPENAI_MODEL` Supabase secret).
- **Structured Outputs**, `strict: true`, every key in `required` with null
  allowed instead of optionality.
- **Validation happens twice** — server-side and again in `normalise()` on the
  client. The screens' contract is `normalise()`, not whatever the model
  returned.
- `edge.ts` uses `fetch`, **not** `supabase.functions.invoke`, because
  `FunctionInvokeOptions` has no `signal` — invoke cannot be cancelled, so
  backing out of a scan would leave a billable request running.
- PDFs are rejected client-side (the vision endpoint can't take them as
  `image_url`) to avoid a round trip that can only fail.
- With no provider available, `USE_MOCK_OCR` returns a canned extraction so the
  scan flow stays walkable.

---

## 11. RevenueCat integration status

**Code: complete. Configuration: not started. Never executed.**

`src/services/purchases.ts` wraps the SDK behind a lazy `require()` — a
top-level import crashes the bundle in Expo Go, where the native module doesn't
exist. Every function degrades to "not configured": `getMonthlyPackage()`
returns nulls, `hasPremium()` is false, `restorePurchases()` returns null.

The paywall therefore falls back to the static `SAR 10` label and the purchase
button cannot complete. `usePremium().isPremium` is the single gate every
monetization decision reads.

**To activate:**
1. Create the SAR 10/month product in App Store Connect and Play Console.
2. Configure a RevenueCat project; entitlement id must be **`premium_access`**;
   offering id **`default`**.
3. Set `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `_ANDROID_KEY`.
4. Deploy `revenuecat-webhook` and set `REVENUECAT_WEBHOOK_SECRET`, so
   `profiles.plan_tier` / `premium_until` mirror server-side.
5. Build a dev client — this cannot be tested in Expo Go.

The Supabase user id is passed as the RevenueCat App User ID so entitlements
follow the account across devices and the webhook can map back to a profile row.

---

## 12. Authentication implementation

**Email + password with confirmation, PKCE, deep-linked back into the app.**

- `flowType: 'pkce'` in `src/lib/supabase.ts` — the email carries a single-use
  `code`, worthless without the verifier stored on the device. This also
  survives email clients that prefetch links, which silently burns an
  implicit-flow token.
- `src/lib/authRedirect.ts` is the **only** place the callback URL is built.
  `Linking.createURL('/auth-callback')` emits `exp://…/--/auth-callback` in Expo
  Go and `vaultly://auth-callback` in a build.
- `src/lib/authCallback.ts` redeems whatever comes back, handling **all four**
  shapes: `?code=` (PKCE), `?token_hash=&type=` (templates using
  `{{ .TokenHash }}`), `#access_token=&refresh_token=` (implicit/OAuth), and
  `?error=&error_description=`.
- `app/auth-callback.tsx` reads the URL via `Linking.useURL()` — **not** route
  params, because the implicit flow puts tokens in the fragment, which the
  router does not expose. A `useRef` guard stops the single-use code being
  redeemed twice.
- **The auth gate in `app/_layout.tsx` exempts `auth-callback` in both
  directions.** Without that exemption the signed-out rule unmounts the screen
  mid-exchange and the confirmation link silently does nothing. Do not remove
  this.
- Sign-in distinguishes `email_not_confirmed` from bad credentials and offers
  **Resend** instead of sending the user into a useless password-reset loop.
- `authStore.signUpWithEmail` passes `emailRedirectTo`; there is also
  `resendConfirmation`.

**Cross-device caveat:** PKCE binds the code to the signup device. Signing up on
a phone and opening the mail on a laptop fails by design. To support it, switch
the *Confirm signup* template to `{{ .TokenHash }}` — `authCallback.ts` already
handles that shape, so it is a dashboard-only change.

---

## 13. Google Sign-In status

**Not functional. UI exists.**

`app/(auth)/sign-in.tsx` renders "Continue with Apple" and "Continue with
Google" buttons wired to `supabase.auth.signInWithOAuth` →
`WebBrowser.openAuthSessionAsync` → the shared `completeAuthFromUrl`.

The code path is correct and now understands PKCE (it previously did manual
fragment parsing that missed `code` entirely). But **only the `email` provider is
enabled** on the Supabase project, so both buttons return an error; the UI shows
`auth.errors.providerUnavailable`.

**To activate Google:** enable the Google provider in Supabase Auth, supply the
OAuth client credentials, and add `vaultly://auth-callback` as an authorised
redirect. Apple additionally requires an Apple Developer account and Sign in
with Apple configuration. Neither has been started.

---

## 14. AdMob status

**Code: complete. Configuration: not started. Never executed.**

`src/services/ads.ts` lazily requires `react-native-google-mobile-ads`. When the
module is missing (Expo Go) **and** mock mode is on, `showRewardedAd()`
simulates an earned reward after 1.2s so the rewarded-slot flow can be walked;
otherwise it reports `unavailable`.

`initAds()` sets `maxAdContentRating: PG` and requests
`requestNonPersonalizedAdsOnly`. `usePremium().showAds` is the single ad gate —
premium is ad-free by construction.

**The AdMob config plugin is conditionally omitted from `app.config.ts`** when
the app IDs are blank, because it refuses to prebuild with empty values. It
rejoins the build automatically once both IDs are set.

Rewarded ads mint bonus slots only via `grant-bonus-slot` (service role) after
the SDK fires `EARNED_REWARD` — clients cannot insert into `bonus_slots` (RLS).
**That function is not deployed**, so even with AdMob configured the grant would
fail until it is.

---

## 15. Storage configuration

- Bucket **`receipts`**, private, 10 MB limit, MIME allow-list:
  `image/jpeg, image/png, image/heic, image/webp, application/pdf`.
- Objects keyed `<user_id>/<timestamp>-<rand>.<ext>`; four RLS policies scope
  every operation to a folder matching `auth.uid()`.
- Reads go through **short-lived signed URLs** (`signedReceiptUrl`, 1h default).
- `src/services/storage.ts` uses the **SDK 54 `File` API**. `File.bytes()`
  returns a `Uint8Array` directly, which let a hand-rolled base64 decoder be
  deleted. The old `readAsStringAsync` / `EncodingType` API is gone in
  expo-file-system 19.

**Verification note:** you cannot check whether the bucket exists by *listing*
buckets — the anon key isn't permitted to, and it returns `[]` either way. That
produced a false "bucket missing" result once. `check-supabase.mjs` now probes
with a deliberately disallowed `text/plain` upload: `404 Bucket not found` means
absent, `415 invalid_mime_type` means present with the allow-list working.

---

## 16. Notification system

Local reminders only, via `expo-notifications`.

- Warranties: **30 / 7 / 1** days before `expires_on`.
- Subscriptions: **3 / 1** days before `next_renewal`.
- Identifiers are derived (`warranty:<itemId>:<days>`) so re-scheduling is
  idempotent; `cancelRemindersFor(entityId)` matches on the id segment.
- Fired at 09:00 local on the target date.
- Scheduled from `services/receipts.ts` on create, in **both** the live and mock
  paths, so a manually entered date flows through to the reminders.

**Push notifications do not work in Expo Go** — removed from Expo Go in SDK 53.
`registerForPush` wraps `getExpoPushTokenAsync` in try/catch and returns null, so
this degrades silently. Push tokens need `EAS_PROJECT_ID` and a dev build.
`profiles.push_token` is written only in live mode.

SDK 54 API notes: `setNotificationHandler` now requires `shouldShowBanner` and
`shouldShowList` alongside `shouldShowAlert`, and triggers require
`{type: SchedulableTriggerInputTypes.DATE, date}`.

---

## 17. Localization

Five locales: **en, ar, es, fr, de**. `src/i18n/`.

- `compatibilityJSON: 'v3'` — **required** for Arabic plurals.
- **Arabic needs all six CLDR plural forms** (`_0` zero, `_1` one, `_2` two, `_3`
  few 3–10, `_4` many 11–99, `_5` other). This is not optional: a missing form
  makes i18next fall back to the base key, and **that caused a real shipped bug**
  where the 6-month warranty chip was labelled "شهر واحد" (one month) — see §21.
  `warranty.months/days/years`, `relative.daysLeft`, `relative.expiredAgo`,
  `relative.renewsInDays`, `relative.renewalOverdue` and `list.results` all ship
  the six forms.
- `plurals.test.ts` locks this: it asserts across all five locales that distinct
  counts render distinct labels. Arabic's singular and dual forms legitimately
  carry no numeral, so counts 1 and 2 are exempt from the digit check.
- **RTL rule: logical properties only** — `paddingStart`, `marginEnd`,
  `start`/`end`, `textAlign: 'left'`. RN flips these automatically.
  `useDirection()` covers what RN does not: icon mirroring, transforms, raw
  x-offsets. `flipIcon` is typed as a bare transform (not `ViewStyle`) because RN
  0.81 stopped letting `ViewStyle` flow into a `TextStyle` slot.
- LTR↔LTR switches apply instantly; crossing the LTR↔RTL boundary needs a native
  reload, so the app confirms first then calls `Updates.reloadAsync()` — wrapped,
  because that throws in Expo Go.
- Numbers/currency/dates go through `formatCurrency` / `formatDate`, which read
  each language's `intlTag`.
- Adding a language: locale JSON + one `LANGUAGES` entry + add the code to
  `SUPPORTED_LOCALES` and import it in `i18n/index.ts` (RN's bundler has no
  dynamic require).
- **Long-form prose lives in `src/content/support.ts`, not the locale JSON** —
  FAQ, Privacy, Terms, in **en + ar only**; the other three fall back to English.

---

## 18. Current UI structure

Design source of truth: `../Vaultly Screens.dc.html` (four iterations; **t4 is
current**). Implementation matches t4.

**Design tokens** (`src/theme/`): bg `#FAFAF8`, surface `#FFF`, border `#E7E5E0`,
text `#14161A`, muted `#6B7280`, primary navy `#1B2A4A`, gold `#C8A548`. Cards:
16px radius, 1px border, 16px padding. Urgency ramp green `#2F7D5B` → amber
`#B98200` → red `#C1452F`, each with a tinted badge surface. Arabic runs 1–2px
larger with looser leading via `typeScale(locale)`.

**Navigation** — three-slot bottom bar: **Home · FAB · Profile**. The FAB is not
a tab; it is an elevated 64px circle overlapping the bar that opens the add
sheet, with a spacer tab reserving its slot. List screens push over the tabs so
Back always returns Home.

**Routes (21):**

```
_layout.tsx            i18n boot, providers, auth gate, Stack registry
index.tsx              → redirect to (tabs)/home
(auth)/sign-in         email + password, OAuth buttons, resend
(auth)/sign-up         + "check your email" state
auth-callback          deep-link redemption
(tabs)/home            greeting, quota, 3 stat tiles, Needs Attention, 3 sections
(tabs)/profile         identity, premium banner, 4 grouped sections
(tabs)/add-placeholder never rendered — reserves the FAB slot
invoices | warranties | subscriptions   list screens w/ search, filter, sort
search                 cross-entity search
item/new               camera → OCR → review → save
item/[id]              detail: artefact, countdown, overview, actions
item/add-warranty      manual entry + WarrantyDurationPicker
item/add-subscription  manual entry + RenewalPicker
paywall                SAR 10/month
support/faq            accordion, 10 questions
support/legal          ?doc=privacy|terms
```

**Overlays:** AddSheet (FAB), DetectionSheet ("We detected a subscription"),
LanguagePicker (scrollable, rendered from `languages.ts`).

**Shared pickers** — `WarrantyDurationPicker` and `RenewalPicker` both use
`SelectChip`. They were deliberately unified after divergence caused the
mislabelled-chip bug; keep them sharing.

---

## 19. Completed features

- ✅ All 21 routes implemented to design t4, EN + AR (+3 locales)
- ✅ Full RTL, verified against the Arabic design boards
- ✅ Expo SDK 51 → **54** upgrade (RN 0.81, React 19), 18/18 expo-doctor
- ✅ Supabase schema applied and verified (10/10 `db:check`)
- ✅ RLS verified: anonymous reads return nothing, anonymous writes rejected
- ✅ `analyze-receipt` Edge Function deployed, `OPENAI_API_KEY` set as a secret
- ✅ **No AI key in the bundle** — verified by grepping the compiled bundle for
  `api.openai.com`, `sk-proj-`, `sk-[A-Za-z0-9]{20}`, `OPENAI_API_KEY`: all absent
- ✅ Email verification flow with PKCE deep linking (§12)
- ✅ Mock backend — full app runs with zero credentials
- ✅ Calendar-correct date arithmetic + 62 passing tests
- ✅ Warranty durations: 1/3/6/12/24 months, Custom (days/months/years), exact date
- ✅ Subscription renewal: cycle-derived or **Set manually**, with validation
- ✅ Help & Support: FAQ, Contact, Report a bug, Request a feature, Privacy, Terms
- ✅ Local reminders wired on both backends
- ✅ Quota system: client UX + DB trigger as authority
- ✅ Three verification scripts (`db:check`, `fn:check`, `db:smoke`)

---

## 20. Remaining tasks

**Blocking release**

1. `git init` + first commit. No version control today.
2. Turn `mailer_autoconfirm` **off temporarily**, run `npm run db:smoke -- --yes`,
   turn it back **on**. This is the only way to verify authenticated paths.
3. Verify the real OCR round-trip (covered by `db:smoke` step above).
4. Replace `assets/notification-icon.png` — generated placeholder.
5. Fill `LEGAL_ENTITY` in `src/content/support.ts` (currently renders the literal
   string `[Vaultly — registered operator name]`), confirm jurisdiction, and have
   Privacy + Terms reviewed by a lawyer.
6. Set `EXPO_PUBLIC_SUPPORT_EMAIL` to a real, monitored inbox.
7. Confirm the two Supabase redirect URLs are saved (§7).

**Before monetization**

8. RevenueCat: store products, entitlement `premium_access`, keys, deploy
   `revenuecat-webhook` + secret (§11).
9. AdMob: app IDs + rewarded unit IDs, deploy `grant-bonus-slot` (§14).
10. `eas init` → `EAS_PROJECT_ID`; build a dev client. Neither RevenueCat nor
    AdMob nor push can be tested in Expo Go.

**Product gaps**

11. Enable Google + Apple providers, or remove the buttons (§13).
12. Subscriptions have schema, reminders and screens but **no edit flow**.
13. Settings notification toggles are local `useState` — not persisted.
14. Profile rows "Account details" and "Categories" still call an
    `Alert`-only stub.
15. "Backup & restore" row is a stub — no export exists.
16. Offline is out of scope by decision: no cache, no sync queue.

---

## 21. Known issues

| Issue | Impact | Notes |
|---|---|---|
| **Email confirmation blocks all authenticated testing** | High | `mailer_autoconfirm: false` + anonymous sign-in disabled ⇒ no obtainable JWT. `db:smoke` refuses to run rather than mail a stranger. |
| Apple/Google buttons fail | Medium | Only `email` provider enabled (§13) |
| `useVaultSummary.ts` is dead code | Low | Unused, and queries Supabase directly — **bypasses the mock switch**. Will break if wired up as-is. Delete or route through `services/`. |
| Progress bar uses `duration_months * 30` | Low | `item/[id].tsx` — a fixed approximation. Affects only bar fill, never the day count. Left deliberately to avoid a visual change. |
| Hand-written `database.types.ts` | Low | Forces `as unknown as` casts on the embedded join in `receipts.ts`. `npm run db:types` fixes it. |
| Push notifications absent in Expo Go | Low | Expected since SDK 53; handled |
| Expo warns TypeScript ~5.3.3 expected | Cosmetic | **Ignore.** Reverting reintroduces a real bug (§24) |
| OneDrive sync races | Annoyance | Files can change mid-edit |

**Fixed, recorded so they are not reintroduced:**

- **Arabic plural fallback** — `warranty.months` shipped without `_0`–`_5`, so
  Arabic count=6 fell back to a hardcoded singular *"one month"*. The 6-month
  chip was labelled "1 month"; tapping it stored 6 months and showed ~184 days.
  The reported "date bug" was a **translation** bug.
- **`setMonth` month overflow** — `31 Jan + 1 month` produced `3 Mar`.
- **UTC/local drift** — `new Date('2026-01-31')` parsed as UTC then read with
  local getters landed a day early west of Greenwich.
- **react-query typed as `any`** — TypeScript 5.3.3 lacks `NoInfer<T>`, which
  react-query 5.6+ needs. Every `useQuery` result silently degraded to `any`,
  hiding four real bugs.
- **`/auth-callback` route did not exist** — every OAuth attempt dead-ended.
- **Auth gate unmounted the callback screen** mid-exchange.
- **Cycle change wiped a typed renewal date** in the subscription form.
- **`functions.invoke` has no `signal`** — cancellation was silently ignored.

---

## 22. TODO list

Ordered. Items 1–4 unblock everything else.

```
[ ]  1. git init; commit; add a remote
[ ]  2. Supabase → Auth → Providers → Email: turn OFF "Confirm email"
[ ]  3. npm run db:smoke -- --yes        (verifies auth, RLS, quota, storage, OCR)
[ ]  4. Turn "Confirm email" back ON
[ ]  5. Manual pass: sign up with a real address, tap the link, confirm it opens the app
[ ]  6. npm run db:types                 (drops the `as unknown as` casts)
[ ]  7. Delete or fix src/hooks/useVaultSummary.ts
[ ]  8. Replace assets/notification-icon.png
[ ]  9. Fill LEGAL_ENTITY; legal review of Privacy + Terms
[ ] 10. Set EXPO_PUBLIC_SUPPORT_EMAIL to a monitored inbox
[ ] 11. eas init → EAS_PROJECT_ID; eas build --profile development
[ ] 12. On the dev client: verify push tokens, RevenueCat, AdMob
[ ] 13. Deploy grant-bonus-slot and revenuecat-webhook
[ ] 14. RevenueCat products + entitlement premium_access + keys
[ ] 15. AdMob app IDs + rewarded unit IDs
[ ] 16. Enable Google/Apple providers, or remove the buttons
[ ] 17. Persist the Settings notification toggles to profiles
[ ] 18. Subscription edit flow
[ ] 19. Implement or remove Account details / Categories / Backup & restore
[ ] 20. Add component tests (only pure logic is covered today)
[ ] 21. CI: typecheck + test + db:check on push
```

---

## 23. Testing status

**`npm test` → 62 pass / 0 fail / 12 suites.** Node's built-in runner with native
TS stripping; no Jest, no ts-node. `tsconfig` sets
`allowImportingTsExtensions` because the runner needs explicit `.ts` on relative
imports.

| File | Covers |
|---|---|
| `src/lib/dateMath.test.ts` | 1/3/6/12/24-month terms; custom days/months/years; exact dates; leap years incl. 1900/2000/2100; end-of-month clamping; non-compounding clamps; billing cycles; DST boundaries; negatives; invalid input |
| `src/i18n/plurals.test.ts` | Arabic six-form plurals across all five locales; the specific 6-months-≠-"one month" regression |

**Integration / live scripts:**

| Script | Status |
|---|---|
| `npm run db:check` | ✅ 10/10 — auth, 5 tables, 2 RPCs, bucket, anon-write rejection |
| `npm run fn:check` | ✅ 4/4 — deployed, CORS, method guard, auth guard |
| `npm run db:smoke -- --yes` | ⛔ **blocked** — refuses to run while confirmation is on |

`db:smoke` (written, never executed) covers: signup → profile trigger → insert
item + warranty → the exact embedded join the lists use → `item_allowance` →
quota trigger rejecting the 5th item → RLS isolation between two users → storage
upload + signed URL + cross-user rejection → **real OCR against
`scripts/fixtures/sample-receipt.png`**, a legible synthetic Jarir receipt with
known values (`TOTAL: 2,499.00 SAR`, 24-month warranty) so extraction can be
checked against truth rather than "it returned something".

It has a **pre-flight guard**: if `mailer_autoconfirm !== true` it exits without
creating anything, because a successful signup would email a confirmation link to
an invented address. Do not weaken that guard; toggle the setting instead.
Default email domain is `gmail.com` (Supabase rejects `example.com`); override
with `--domain=`.

**No coverage:** React components, navigation, RTL rendering, the Edge Function's
body-validation branches.

---

## 24. Important implementation decisions

**Keep expo-router, not bare React Navigation.** It *is* React Navigation 7
underneath. File-based routing is load-bearing across 21 routes.

**No NativeWind.** Styling is the `src/theme` token set applied inline. Adding a
styling system now would mean touching every screen.

**TypeScript must stay ≥5.4.** react-query 5.6+ uses `NoInfer<T>`, a TS 5.4
built-in. On 5.3 it fails to resolve and **every `useQuery` result silently
becomes `any`** — no error, just no type safety in the entire data layer. Expo
will warn that it expects ~5.3.3. Ignore the warning.

**`react-dom` pinned to 19.1.0 via `overrides`.** It arrives transitively and
floats to a version demanding a newer React than SDK 54 pins, which blocks every
`npm install`.

**Always `npx expo install`, never plain `npm install`, for Expo packages.** Plain
npm grabs *latest*: it installed `expo-font@57` and `babel-preset-expo@57` where
SDK 54 wants 14 and 54.

**`--use-api` on function deploys.** Docker is not installed; the default deploy
path requires it.

**Mock quota starts at 3/4, decoupled from the seeded rows.** The seed fills
every list so all card states are visible; counting those rows would open at 8/4
and the paywall would block the add flow before it could be tried. This way the
quota banner → one working add → paywall gate are reachable in sequence.

**Mock seed dates are relative offsets from today**, not fixed dates, so
"Expires today" / "16 days left" / "Renews in 3 days" keep reading correctly
however long the seed sits there.

**Native modules are lazily `require()`d.** `react-native-purchases` and
`react-native-google-mobile-ads` do not exist in Expo Go; a top-level import
crashes the bundle before the first screen renders.

**`Field` lives in `src/components/`, not a route file.** Four routes were
importing a shared component from `app/(auth)/sign-in.tsx`.

**Validation runs client-side even when the server already did it.** The screens'
contract is `normalise()`. Never trust a model's JSON straight into Postgres.

**Verification method matters — two false results happened here:**
- `select(…, {head: true})` sends HTTP HEAD, returns no body, and supabase-js
  reports no error, so a **missing table looks identical to an empty one**. It
  reported all five tables present when none existed. Use plain GET.
- Listing storage buckets with the anon key returns `[]` whether or not the
  bucket exists. Probe with a deliberately-disallowed upload instead.

---

## 25. How to run

```bash
cd "C:\Users\عدي\OneDrive\سطح المكتب\تطبيق 1\Vaultly Digital Vault Setup\vaultly"
npm install
npx expo start --tunnel        # or --lan
```

**No dev server is currently running** — the previous background tasks were
stopped.

**LAN mode needs the IP pinned.** This machine has two VMware adapters that Expo
picks ahead of the real Wi-Fi interface, producing a QR the phone cannot reach:

```powershell
$env:REACT_NATIVE_PACKAGER_HOSTNAME = "192.168.0.163"   # DHCP — re-check
npx expo start --lan
```

Tunnel mode needs no IP. Its URL was `exp://jnugyjm-anonymous-8081.exp.direct`
— the subdomain is derived from the project path and account, so it is stable for
this checkout but differs per machine.

Piping Expo's output to a file suppresses the QR code. To recover the tunnel URL:
`curl http://127.0.0.1:4040/api/tunnels`. To generate a QR:
`npx --yes qrcode --output qr.png "exp://<host>"`.

**Verify a bundle actually compiles** (Metro only bundles on request):

```
http://localhost:8081/node_modules/expo-router/entry.bundle?platform=android&dev=true
```

Note the entry path — this is an expo-router project, so `/index.bundle` 404s.

---

## 26. Production readiness checklist

| Area | Status | Blocker |
|---|---|---|
| Screens & navigation | ✅ Ready | — |
| RTL / localization | ✅ Ready | Long-form prose is en+ar only |
| Type safety | ✅ Clean | — |
| Unit tests | ✅ 62 pass | Pure logic only |
| Database schema | ✅ Applied & verified | — |
| RLS | ✅ Verified anonymously | Not verified user-vs-user |
| Secret handling | ✅ Verified absent from bundle | — |
| Edge Function | ✅ Deployed, guards pass | OCR never executed |
| Auth (email) | ⚠️ Implemented | Never completed end-to-end |
| Auth (Google/Apple) | ❌ Not configured | Providers disabled |
| Storage | ✅ Configured | Upload never executed |
| Notifications (local) | ⚠️ Implemented | Not observed firing |
| Notifications (push) | ❌ Blocked | Needs EAS_PROJECT_ID + dev build |
| RevenueCat | ❌ Not configured | Store products, keys, webhook |
| AdMob | ❌ Not configured | App IDs, `grant-bonus-slot` |
| Legal content | ⚠️ Drafted | Placeholder + needs review |
| Assets | ⚠️ Placeholder icon | — |
| Version control | ❌ **None** | `git init` |
| CI | ❌ None | — |
| Crash reporting / analytics | ❌ None | Not started |

**Honest overall assessment: not production-ready.** The app is
feature-complete against the design and its infrastructure is verified, but
**no authenticated user path has ever been executed end to end** — not signup,
not a save to the real database, not an upload, not OCR. Those are all blocked
behind one setting, and clearing that blocker is the single highest-value next
action.

---

## 27. The one blocker

`mailer_autoconfirm: false` and anonymous sign-in disabled ⇒ **no JWT can be
obtained**, so nothing requiring an authenticated user can be tested.

Do not "fix" this by disabling confirmation permanently — without it anyone can
register with an address they do not own. The correct sequence:

1. Supabase → Authentication → Providers → Email → turn **off** "Confirm email"
2. `npm run db:smoke -- --yes`
3. Turn "Confirm email" back **on**
4. Separately, verify the deep link by signing up with a real address you own and
   tapping the link on the same device

Everything in §20 that is not explicitly store-related unblocks after step 2.

---

## 28. Context a new conversation needs

- The Arabic-labelled-chip bug is the best illustration of this codebase's main
  hazard: **a translation defect presenting as a logic defect**. When something
  numeric looks wrong in Arabic, check the plural forms before the arithmetic.
- Verify claims against the live system; do not trust a passing check whose
  method you have not examined. Two verification methods gave confidently wrong
  answers here (§24).
- The user's environment is Arabic-language Windows with PowerShell. Paths
  contain Arabic characters; the Bash tool does **not** have Node on PATH —
  use PowerShell with the PATH refresh line used throughout the runbook.
- README.md is the operational runbook (setup, deploy commands, gotchas). This
  file is the state snapshot. Keep both current.
- Design source of truth is `../Vaultly Screens.dc.html`, iteration **t4**.
  Do not redesign; the visual language is settled.
