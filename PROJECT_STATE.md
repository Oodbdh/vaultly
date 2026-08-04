# Vaultly — Project State

**Single source of truth. Last verified: 2026-08-04.**

Every claim here was checked against the live project, the live database, a real
device or the working tree on that date — not recalled. Where something is
unverified, it says so explicitly, and §24 lists exactly what is unverified.
`HANDOVER.md` is an older document kept for its post-mortems; if the two
disagree, **this file is correct**.

---

## 0. Start here — the ten-minute version

Vaultly is an Expo SDK 54 / React Native 0.81 Android app that stores receipts,
warranties and subscriptions and warns you before something lapses.

**State:** feature-complete against the design, type-clean, 119 tests passing, a
**signed production AAB exists**, and the three blocking bugs that dominated
development (launch crash, Google Sign-In, email change) are **all fixed and
verified on a real device**.

The repo is **public at `github.com/Oodbdh/vaultly`** and the **privacy policy is
live** at `https://oodbdh.github.io/vaultly/privacy.html` (§14).

**Google Play phone screenshots exist** — 12 PNGs captured from the app running
on a real device, in `store-assets/google-play/screenshots/` (§20).

**What is not done:** no Play Console listing, no store products, no real receipt
has been through the new OCR pipeline, and the email-change flow has not been
exercised end to end against a real inbox (§10).

**Immediate next actions** — see §18 for the full ordered list:
1. Sign in on the device and run one real email change, both links (§10).
2. Scan one real receipt to exercise the new pipeline (§8).
3. Re-shoot `12-receipt-scanner.png`, which is stale **and** dark (§20).
4. Get the privacy policy reviewed by a lawyer, then create the Play listing.

**Verification gates, re-run 2026-08-04:**

| Gate | Command | Result |
|---|---|---|
| Types | `npx tsc --noEmit` | **clean** |
| Tests | `npm test` | **119 pass / 0 fail, 27 suites** |
| Database | `npm run db:check` | **10/10 PASS** (2026-08-03) |
| Edge Function | `npm run fn:check` | **4/4 PASS** (2026-08-03) |
| Production AAB | EAS `523f6dbc` | **finished, signed** — predates all §20–§22 work |

⚠️ **The signed AAB is now well behind `main`.** It was built from `7281c24`;
everything in §20–§22 landed after it. A new production build is required before
any Play upload.

---

## 1. Environment and how to run

**Code lives at:**
```
C:\Users\عدي\OneDrive\سطح المكتب\تطبيق 1\Vaultly Digital Vault Setup\vaultly
```

Note the **two nested folders** — the outer `Vaultly Digital Vault Setup\` holds
design files, the inner `vaultly\` is the app. Most "file not found" confusion
traces to that nesting.

The project sits in a **OneDrive-synced** folder. Files can change under you
mid-edit, and `.env` is uploaded to Microsoft despite being gitignored.

**Machine:** Arabic-language Windows 11, PowerShell. Node v24.18.0, JDK 21.

⚠️ **The Bash tool has no Node on PATH.** Use PowerShell, or prefix:
```bash
export PATH="$PATH:/c/Program Files/nodejs"
```

⚠️ **PowerShell 5.1 `-Encoding utf8` writes a BOM** and re-encodes non-ASCII.
Never use `Set-Content -Encoding utf8` on `.env` or any UTF-8 file — it corrupts
them. Use `[System.IO.File]::WriteAllText(path, text, New-Object System.Text.UTF8Encoding($false))`.

**Run the dev server:**
```powershell
cd "C:\Users\عدي\OneDrive\سطح المكتب\تطبيق 1\Vaultly Digital Vault Setup\vaultly"
$env:REACT_NATIVE_PACKAGER_HOSTNAME = "192.168.0.163"
npx expo start
```

⚠️ **The hostname pin is mandatory.** Two VMware adapters (`192.168.13.1`,
`192.168.111.1`) enumerate ahead of Wi-Fi; without the pin Expo advertises an
unreachable IP. The Wi-Fi address is DHCP — re-check with
`Get-NetIPAddress -AddressFamily IPv4`.

`expo-dev-client` is installed, so `expo start` runs in **dev-client** mode.

**Launch the app on the device (bypasses the launcher UI):**
```bash
adb shell am start -a android.intent.action.VIEW \
  -d "vaultly://expo-development-client/?url=http%3A%2F%2F192.168.0.163%3A8081"
```

**adb:** there is **no Android SDK** on this machine. Standalone platform-tools
were unpacked to a scratch dir; if missing, re-download
`https://dl.google.com/android/repository/platform-tools-latest-windows.zip`
(≈8 MB, no install, no PATH change). `winget install Google.PlatformTools` fails
with a stale-manifest hash mismatch.

**USB debugging tell:** the phone (HONOR X9a 5G, `VID_339B`) exposes a third USB
interface `MI_02 "ADB Interface"` only when USB debugging is genuinely on. If you
see only `MI_00` (MTP) and `MI_01` (mass storage), it is off. Authorisation is
revoked whenever the adb server restarts — expect to re-tap "Allow".

**Verify a bundle compiles** (Metro only bundles on request):
```
http://localhost:8081/node_modules/expo-router/entry.bundle?platform=android&dev=true
```
Note the entry path — this is expo-router; `/index.bundle` 404s.

---

## 2. Repository and git

- Branch **`main`**, working tree **clean**. `git log --oneline | wc -l` is the
  authority on the count — the list below is only as current as the commit that
  last edited this file, and cannot include that commit itself.
- Remote `origin` is **`https://github.com/Oodbdh/vaultly.git`** — renamed from
  the old path-derived name, and **public** since 2026-08-03.
- **Push works from automation now.** Git Credential Manager has a cached token,
  so `git push origin main` succeeds non-interactively. `gh` is still not
  installed, and there is no token in the environment — so anything needing the
  **GitHub API** (repo settings, Pages settings, `workflow_dispatch`) still has
  to be done by the user in the web UI. Do not try to work around that by
  reading the token out of Credential Manager.
- **Never `--force`.** The remote is now the published source of the privacy
  policy Google Play points at.

**Secret audit (done 2026-08-03):** `.env` is untracked; `.env.example` holds only
placeholders; every credential-shaped match in tracked files is a variable *name*
(`Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`) or a deliberately bogus test JWT.
Safe to publish.

**Commit history** (newest first; 35 commits on `main` as of 2026-08-04):
```
4f22de9  stop mock mode reporting a verification email it never sent
f907275  stop dimming the camera preview; keep only a guide
09c1c2e  complete the email-change flow; make the amount label tell the truth
09f6c73  add the Google Play phone screenshot set
3532959  fix card and header layout defects; give the showcase real currencies
45e1d36  make showcase mode actually reach the premium gates
c8ad6ff  add a store-listing demo seed and the screenshot capture pipeline
8f07e46  fall back to USD, not SAR, when no currency can be determined
06981eb  fix camera letterboxing, SAR-everywhere currency, CTA layout non-Arabic
dd74727  record the Delete Account page and the corrected in-app deletion route
01c6cc1  publish a Delete Account page, and correct the route it documents
0aae4b9  record the published privacy policy and the public repo
2be34dd  fill the operator identity in the privacy policy and terms
f4a14f5  set the minimum age in the privacy policy to 13
cbfceac  let the Pages workflow enable Pages itself
3ed272f  make the Settings reminder toggles actually control reminders
e23e848  hoist profile.tsx's presentational components to module scope
07568ce  apply migration 0004 and drop the placeholders that stood in for it
c430631  rewrite PROJECT_STATE as a self-sufficient handoff
9feeb04  privacy policy + GitHub Pages workflow
7281c24  fix release build: Android default-locale strings (lint)
b9c5100  five-stage OCR extraction pipeline
79795c4  RevenueCat Android SDK configured; iOS deferred
cfa607a  deploy + verify RevenueCat webhook
56dbbc3  record email-change root cause
1a493da  fix email change (route params + GoTrue notices)
0d957c7  fix Google Sign-In (createURL triple slash)
bb0f35a  permanent one-time rewarded slot
14ea9d6  record confirmed logcat trace for the launch crash
d53306c  docs after AdMob removal
ffb023a  remove react-native-google-mobile-ads (fixes launch crash)
62a0b80  duration pickers, image viewer, account screen, renewal window, OCR fixes
a5fa077  generate database types from live schema
4951442  remove dead useVaultSummary hook
693f804  initial commit
```

---

## 3. Architecture

```
app/            expo-router file routes (22 routes)
src/components  presentational + one shared picker per domain
src/hooks       react-query wrappers, one concern each
src/services    all I/O: ocr/, receipts, storage, notifications, profile,
                purchases, ads, support
src/store       zustand: auth, entitlement, ui
src/lib         supabase client, dateMath, subscriptionRenewal, authCallback,
                authRedirect, errors, types
src/mocks       in-memory backend, swapped in by one flag
docs/           privacy.html + .nojekyll (GitHub Pages)
plugins/        local Expo config plugins
supabase/       setup.sql, migrations/, functions/
```

**Four rules the codebase depends on:**

1. **One backend switch.** `USE_MOCK_DATA` in `src/constants/config.ts`. No screen
   or query key knows which backend is live — services delegate.
2. **No AI key in the client, ever.** OCR goes through the Edge Function.
3. **All date arithmetic through `src/lib/dateMath.ts`.** Zero app imports, so it
   runs under the bare test runner. `src/lib/subscriptionRenewal.ts` follows the
   same rule.
4. **Native modules are lazily `require()`d.** `react-native-purchases` (and
   AdMob, when it returns) do not exist in Expo Go; a top-level import crashes the
   bundle before the first screen renders.

**Styling:** no NativeWind. Tokens in `src/theme/`, applied inline. Keep it so.

---

## 4. Tech stack

| Package | Version | Note |
|---|---|---|
| expo | ^54.0.36 | SDK 54 |
| react-native | 0.81.5 | New Architecture enabled (`newArchEnabled=true`) |
| react | 19.1.0 | |
| expo-router | ~6.0.24 | on React Navigation 7 |
| expo-dev-client | ~6.0.21 | |
| typescript | ~5.9.2 | **must stay ≥5.4** |
| @tanstack/react-query | ^5.59.0 | |
| @supabase/supabase-js | ^2.45.4 | |
| zustand | ^4.5.5 | |
| i18next / react-i18next | ^23.15.1 / ^15.0.2 | `compatibilityJSON: 'v3'` |
| react-native-purchases | ^8.2.2 | installed and **configured** (Android) |
| ~~react-native-google-mobile-ads~~ | **removed** | §13 |

**TypeScript must stay ≥5.4.** react-query 5.6+ needs `NoInfer<T>`; on 5.3 every
`useQuery` result silently becomes `any`. Expo warns it wants ~5.3.3. **Ignore.**

**Always `npx expo install`**, never plain `npm install`, for Expo packages.

**`react-dom` pinned to 19.1.0 via `overrides`** — it arrives transitively and
otherwise floats to a version demanding a newer React than SDK 54 pins.

---

## 5. Environment variables

**`.env` (local, gitignored):**

| Variable | State |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | **set** |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | **set** (`sb_publishable_…`) |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | **set** (`goog_…`) |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` | empty — **intentional**, no iOS app yet |
| `EXPO_PUBLIC_GEMINI_MODEL` | set (inert) |
| `EXPO_PUBLIC_USE_MOCK_DATA` | empty ⇒ live database |
| `EXPO_PUBLIC_DEMO_SHOWCASE` | **not in `.env`** — set on the command line for screenshot runs only (§23) |
| `EXPO_PUBLIC_AI_PROVIDER` | empty ⇒ `edge` |
| `EXPO_PUBLIC_ADMOB_*` | empty (no longer read — §13) |
| `EAS_PROJECT_ID` | empty; hardcoded fallback in `app.config.ts` |

🔴 **`EXPO_PUBLIC_USE_MOCK_DATA` is the single most dangerous variable here.**
It is deliberately absent from `.env`, but it is passed on the command line for
screenshot runs and **survives in whatever Metro process is still running**. An
app served by that Metro looks fully functional while nothing leaves the device:
sign-in is fake, data is seeded, and — until `4f22de9` — email change reported
success without sending anything (§10.3). Before debugging anything server-side,
check what is actually being served:

```bash
curl -s -H "expo-platform: android" -H "accept: application/expo+json,application/json" \
  http://localhost:8081/ | grep -o '"useMockData":[a-z]*'
```

**EAS environment variables** (all three environments: development, preview,
production) — set 2026-08-03:
```
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY
```

⚠️ **This matters more than it looks.** `USE_MOCK_DATA` is
`!env.supabaseUrl || !env.supabaseAnonKey`. Before these were set on EAS, any
cloud build would have shipped **running entirely on the in-memory mock backend**
— fully functional-looking, with fake sign-in and seeded demo data that never
persists. If you add an environment, set these three or you ship that bug.

**There is deliberately no `EXPO_PUBLIC_OPENAI_API_KEY`.** It is a Supabase secret.

Restart Metro after any `.env` change — read at startup only.

---

## 6. Supabase

- **Project ref:** `baxlbbuxwajlzgdvpykw` · region `ap-south-1` · Postgres 17.6.1
- CLI logged in and linked.

**Run SQL against the live database without a password:**
```bash
npx supabase db query --linked -f path/to/file.sql
```
This goes through the Management API using the CLI login. Use `-f`; a multi-line
inline string gets mangled. **Do not use `supabase db push`** — `setup.sql` is not
recorded in migration history, so push would try to apply `0001_init.sql` from
scratch and fail on bare `create type`.

**Auth settings (verified live):**

| Setting | Value |
|---|---|
| `external.email` | true |
| `external.google` | **true** |
| `external.apple` | false |
| `mailer_autoconfirm` | **false** (confirmation required) |
| Secure email change | **ON** — confirmed empirically (§13) |
| Anonymous sign-in | disabled |

Not readable via the anon key: Site URL, the Redirect URL allow-list, and
`mailer_secure_email_change_enabled`. Read those in the dashboard.

**Tables** (all RLS-enabled, scoped to `auth.uid()`): `profiles`, `vault_items`,
`warranties`, `subscriptions`, `bonus_slots`.

**Live `profiles` columns:** `id, display_name, locale, currency, plan_tier,
premium_until, push_token, created_at, updated_at, warranty_reminders,
renewal_reminders`.

**All five migrations are applied.** `0004_profile_prefs.sql` went in 2026-08-03,
which closed the last gap between `setup.sql` and the live database — the two no
longer drift. `profiles_locale_check` now reads
`locale in ('en','ar','es','fr','de')`; verified in a rolled-back transaction
that all five are accepted and an unknown locale is still rejected.

⚠️ Keep that CHECK in step with `SUPPORTED_LOCALES` in
`src/constants/config.ts`. `handle_new_user` copies `raw_user_meta_data->>'locale'`
into the row unvalidated, so a locale the CHECK does not know would fail signup
at the trigger.

**Functions:** `touch_updated_at`, `handle_new_user`, `is_premium(uuid)`,
`item_allowance(uuid)`, `enforce_item_quota`.
**Triggers:** `profiles_touch`, `vault_items_touch`, `on_auth_user_created`,
`vault_items_quota` (BEFORE INSERT — the authoritative quota check).

The client calls `is_premium` and `item_allowance` through PostgREST, which needs
`GRANT EXECUTE` **in addition to** SECURITY DEFINER. Without it every call returns
`PGRST202` and quotas silently fail.

**Edge Functions — all deployed:**

| Function | Status | verify_jwt |
|---|---|---|
| `analyze-receipt` | ACTIVE, **v5** | true |
| `delete-account` | ACTIVE, v2 | true |
| `grant-bonus-slot` | ACTIVE, v2 | true |
| `revenuecat-webhook` | ACTIVE, v1 | **false** |

⚠️ `revenuecat-webhook` **must** stay `verify_jwt: false` — RevenueCat sends its
own bearer secret, not a Supabase JWT. Deploy it with `--no-verify-jwt`.
Deploy others with `--use-api` (**Docker is not installed**).

**Secrets set:** `OPENAI_API_KEY`, `REVENUECAT_WEBHOOK_SECRET`, plus the
auto-injected `SUPABASE_*`.

---

## 7. Free storage model — permanent one-time reward

Applied live via `supabase/migrations/0005_permanent_bonus_slot.sql`. Replaced the
old model (2 concurrent slots, each expiring after 24h). **No trace of the 24-hour
model remains anywhere.**

| State | Slots | Ad offered? |
|---|---|---|
| Free, reward unclaimed | 4 | **Yes, once** |
| Free, reward claimed | **5, permanently** | **Never again** |
| 6th item onward | — | Paywall only |
| Premium | unlimited | Never |

**Three enforcement layers:**
1. `bonus_slots_user_once` — `unique (user_id)`. The real guarantee: a second
   insert fails even if the Edge Function is called twice or two calls race.
2. `item_allowance(uid)` = `4 + least(count(bonus_slots), 1)`. No time component.
3. `enforce_item_quota` trigger — unchanged, reads the new allowance.

Client mirror: `MONETIZATION.freeItemLimit = 4`, `rewardedSlotsPerAccount = 1`,
derived `FREE_MAX_SLOTS = 5`. `useItemQuota` exposes `bonusUnlocked` and
`canWatchAd`.

The ad is offered on Home's `QuotaBanner`, Profile's `RewardedSlotCard`, **and on
the paywall** — the add flow routes to `/paywall` the moment the limit is hit, so
without that the reward would be unreachable from the main path.

**Verified live** in a rolled-back transaction: allowance 4→5, second grant
blocked, 5 items accepted, 6th rejected with `VAULTLY_QUOTA_EXCEEDED`.

⚠️ **The ad cannot actually run** — AdMob is removed (§13), so `showRewardedAd()`
returns `unavailable`. Walkable only in mock mode.

---

## 8. OCR — five-stage extraction pipeline

Rewritten in `b9c5100`, deployed as `analyze-receipt` **v5**. Replaced a single
vision request that both read and interpreted the image.

```
1. Transcribe   vision model → ordered text blocks, nothing interpreted
2. Candidates   pure rules propose every plausible value    (pipeline.ts)
3. Validate     pure rules score and pick, 0-100 per field  (pipeline.ts)
4. Reason       text-only LLM chooses among those candidates
5. Verify       text-only LLM audits 3 vs 4
   → reconcile() arbitrates deterministically, floor applied
```

**Files:**
- `supabase/functions/analyze-receipt/pipeline.ts` — pure, dependency-free, no
  Deno globals, so Node's test runner imports it directly.
- `supabase/functions/analyze-receipt/pipeline.test.ts` — **34 tests**.
- `index.ts` — orchestration only.

`reconcile()` is the last word: agreement raises confidence, disagreement takes
the better-supported side and docks it, **the LLM alone is capped at 75 and can
never install a value the rules rejected**. Below **70** → null. Missing beats
wrong.

**Rules worth knowing:** grand-total phrasing beats bare "total" beats subtotal
(fallback only); VAT and change-due lines excluded; on "was 199 now 149" the
payable price wins; when `subtotal + VAT` equals a candidate it is promoted to 90.
Merchant detection is exclusion-driven (headers, addresses, contacts, VAT-reg
lines, slogans stripped). Dates are role-tagged so a due/renewal date can never
become the purchase date; ambiguous `05/06` is assumed dd/mm but held below the
floor; Hijri converts tabularly and is capped at 60 (±1 day). Arabic-Indic digits,
`٫`/`٬` separators, Arabic month names and dual forms (`سنتين` = 24 months) are
handled.

**Cost:** three model calls per scan, but only stage 1 sends the image; 4 and 5
are text-only over a 6k-char capped transcript.

⚠️ **Never exercised on a real receipt.** The rules have 34 unit tests and the
function boots correctly, but no photo has been through the live pipeline. **This
is the highest-value untested path in the project.**

**Not implemented, deliberately:** bounding-box coordinates (needs a real OCR
engine, not a vision LLM — `TextBlock.bbox` exists for later) and client-side
deskew/contrast (needs `expo-image-manipulator`, a native module this build lacks).

The legacy Gemini provider (`AI_PROVIDER=gemini`) is untouched and still
single-shot.

---

## 9. Authentication

Email + password with confirmation, and Google OAuth. PKCE throughout
(`flowType: 'pkce'` in `src/lib/supabase.ts`).

`src/lib/authRedirect.ts` is the **only** place the callback URL is built.
`src/lib/authCallback.ts` redeems whatever comes back, handling five shapes:
`?code=` (PKCE), `?token_hash=&type=`, `#access_token=&refresh_token=`,
`?error=`, and `?message=` (§13).

**The auth gate in `app/_layout.tsx` exempts `auth-callback` in both directions.**
Without that the signed-out rule unmounts the screen mid-exchange and the link
silently does nothing. Do not remove this.

### Fixed: Google Sign-In (`0d957c7`)

`authRedirectTo()` passed a **leading slash** to `Linking.createURL`. In a build
with a custom scheme `hostUri` is empty and normalises to `/`, so
`'/auth-callback'` produced **three** slashes:

```
vaultly:///auth-callback   ← broken
vaultly://auth-callback    ← correct
```

That broke two things at once, neither of which reports an error: it is not on the
Supabase allow-list, and it is the `returnUrl` that `openAuthSessionAsync` matches
with `startsWith` — so the browser resolved `dismiss`, and `sign-in.tsx` returned
at `if (result.type !== 'success')` without ever exchanging the code. Symptom was
an account picker followed by a silent bounce back to Sign In.

**Verified on device:** `result.type=success`, `exchange DONE err=none`,
`SIGNED_IN`, two accounts signed in.

---

## 10. Email change — fixed (`1a493da`, `09c1c2e`, `4f22de9`)

⚠️ **Read §10.3 first if someone reports "no email arrives."** It was mock mode
both times it was investigated, not mail.

Two independent defects.

**1. Secure email change needs TWO confirmations.** It is **enabled**. GoTrue's
verbatim reply to the first link:

> "Confirmation link accepted. Please proceed to confirm link sent to the other email"

and `auth.users.email_change_confirm_status` sits at **1** until the second link
is opened. `completeAuthFromUrl` had no branch for `?message=`, so this fell
through to `ignored` and the screen silently replaced to Home.

**2. The callback screen never saw the deep link.** It read the URL via
`Linking.useURL()`, which resolves `getInitialURL()` (the *launch* URL) and
otherwise waits for a `url` event that has already fired by mount time. Under the
dev launcher the launch URL is permanently
`vaultly://expo-development-client/?url=…`. The router held the real `code` while
the handler got the stale URL, so `exchangeCodeForSession` was **never called**.

**Fix:** route params are the primary source in `app/auth-callback.tsx`
(`useURL()` kept as fallback for the implicit flow's fragment, which the router
does not expose), plus a `notice` status that surfaces GoTrue's own wording.

**It was never a refresh bug** — `refreshSession()`/`refreshUser()` were correct
throughout and returned the old address because the server still held it.

### 10.3 — 2026-08-04: "no email arrives" — mock mode, not mail (`4f22de9`)

Reported as *"the app says the verification email was sent, but nothing
arrives."* **Nothing was wrong with email.** The app under test was running with
`EXPO_PUBLIC_USE_MOCK_DATA=true`, left over from the screenshot run (§20), and
`updateEmail` short-circuited:

```ts
updateEmail: async (email) => {
  if (USE_MOCK_DATA) return {};   // success. no network call. no email.
```

From the user's side a fabricated success is indistinguishable from a dead mail
server, which is exactly what it was mistaken for. Confirmed by reading the
served Expo manifest: `"useMockData": true`.

`updateEmail` now **fails loudly** under `USE_MOCK_DATA` instead of faking
success, with a dev-console warning naming the env var to unset. Every other
mock write can be faked honestly because its result is local; this one cannot,
because the entire operation *is* an email. The message is deliberately
untranslated — it is unreachable in a shipped build, where Supabase credentials
are always present and `USE_MOCK_DATA` is therefore false.

**Evidence gathered against the live project, all on 2026-08-04:**

| Question | Method | Answer |
|---|---|---|
| Is SMTP working? | `POST /auth/v1/recover` for the owner's address | **Yes** — HTTP 200, and `auth.users.recovery_sent_at` advanced to 56 s ago |
| Rate limited? | same call | **No** — no 429, accepted immediately |
| Secure email change on? | `email_change_confirm_status = 1` on two users | **Yes** — that value only exists in the two-step flow |
| Does `updateUser({email})` work? | `email_change_sent_at` populated 2026-08-02 18:49 and 2026-08-03 08:33 | **Yes** — only GoTrue sets that, and only on a processed request |
| Client call correct? | code read | **Yes** — `updateUser({ email }, { emailRedirectTo })`, unchanged |

That SMTP probe sent a **real password-reset email** to `odiymosa420@gmail.com`.
It is harmless and changed nothing — it was the only way to test delivery
without handling a password. There is **no known defect in password reset**; it
was used purely as an instrument.

⚠️ **Two accounts are stuck mid-change.** Both sit at
`email_change_confirm_status = 1` with a pending `email_change` from 2 and 3
August — one link opened, the second never was. A *new* change request while one
is pending may behave unexpectedly. Complete or clear these before testing.

⚠️ **Still unverified end to end.** Signing in needs the account password, which
automation must not handle, so the real two-link round trip has never been run.
See §18.1 for the exact steps.

**Copy fixed (`09c1c2e`).** `account.emailPending` used to name only the new
address while the flow requires **both** links; anyone following it opened one,
met GoTrue's *"proceed to confirm link sent to the other email"*, and reasonably
concluded the feature was broken. Reworded in all five locales. Verified on
device that the two-link notice renders.

⚠️ Supabase's built-in SMTP is heavily rate-limited and each change sends two
emails, so testing exhausts the quota fast.

---

## 11. Android launch crash — fixed and verified

**Root cause, from a captured on-device logcat trace:**
```
FATAL EXCEPTION: main
java.lang.RuntimeException: Unable to get provider
  com.google.android.gms.ads.MobileAdsInitProvider:
  java.lang.IllegalStateException: Invalid application ID
  at ActivityThread.installProvider / installContentProviders
  at ActivityThread.handleBindApplication
```

With no AdMob app ID configured, the config plugin was omitted but the npm package
stayed in `dependencies`, so autolinking compiled the native SDK anyway with a
blank `APPLICATION_ID`. `installContentProviders` runs inside
`handleBindApplication`, **before `Application.onCreate()`** — which is why no JS
ran and why it reproduced with Metro stopped.

**Fixed** by removing the package (`ffb023a`). Verified: rebuilt dev client
launches, reaches `.MainActivity`, and runs JS. `MobileAdsInitProvider` and
`gms.ads` are provably **absent from the production AAB**.

---

## 12. RevenueCat

**Code: complete. Android SDK: configured and verified. Store side: not started.**

- `src/services/purchases.ts` wraps the SDK behind a lazy `require()`.
- Entitlement id **`premium_access`**, offering id **`default`**. Both are
  hardcoded in three places (`MONETIZATION`, `usePremium.ts`, the webhook) — a
  rename must touch all three.
- The **Supabase user id is the RevenueCat App User ID**, which is what makes the
  webhook's `.eq('id', event.app_user_id)` mapping work. Verified in SDK logs.
- `usePremium().isPremium` is the single gate every monetization decision reads.
- Restore returns a discriminated `RestoreOutcome`
  (`restored`/`none`/`unavailable`/`error`), shared by the paywall and Profile via
  `restoreAlert()`.

**Verified on device:** SDK 8.24.0 initialises, billing client connects,
`CustomerInfo` fetched. **Restore Purchases exercised by tapping the real button**
— SDK logged `restorePurchases has been called` → `No purchases found to restore`,
app showed `paywall.restoreNone`. It correctly returns `none`, not `unavailable`.

**Webhook verified** by driving the deployed function with synthetic events:
no auth → 401, wrong secret → 401, unrelated entitlement → `ignored`,
`INITIAL_PURCHASE` → `plan_tier free→premium`, `is_premium()` true,
`item_allowance()` 4→2147483647, only the targeted user changed. A rolled-back
transaction proved premium bypasses `enforce_item_quota` (12 items accepted).
`CANCELLATION`/`EXPIRATION` restored the row exactly.

**Webhook config for the RevenueCat dashboard:**
```
URL:    https://baxlbbuxwajlzgdvpykw.supabase.co/functions/v1/revenuecat-webhook
Header: Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>
```
The secret is a Supabase secret; rotate with `supabase secrets set`.

**Blocked on store products.** RevenueCat's own words from the device:
> "There are no products registered in the RevenueCat dashboard for your offerings."

Until a Play subscription is mapped to offering `default`,
`getMonthlyPackage()` returns nulls and the paywall shows the static `SAR 10`.

⚠️ **Known race, unaddressed:** after purchase the client flips to premium
instantly, but `profiles` only updates when the webhook lands. A 6th item added in
that window can still be rejected. Fixing it means touching quota logic.

---

## 13. AdMob — removed

`react-native-google-mobile-ads` is **not installed**. It caused the launch crash
(§11). `src/services/ads.ts` is retained and dormant: the lazy `require()` degrades
to `unavailable`, so the rewarded path fails safe.

**To re-enable:** `npx expo install react-native-google-mobile-ads`, set
`EXPO_PUBLIC_ADMOB_{IOS,ANDROID}_APP_ID` to **real** IDs, restore the plugin block
and both `config.googleMobileAdsAppId` entries in `app.config.ts`, and revert the
structural `AdsModule` type to `typeof import('react-native-google-mobile-ads')`.

⚠️ **Do not re-add it blank.** That is exactly what crashed the app.
⚠️ Re-adding it also **falsifies the privacy policy**, which currently states the
app contains no advertising SDKs. Update both in the same change.

---

## 14. Google Play / release status

**A signed production AAB exists:**
```
dist\vaultly-0.1.0-vc7.aab      (68.37 MB, gitignored)
```
EAS build `523f6dbc-cac4-459b-bb32-91e303702abd`, commit `7281c24`,
versionCode **7**, profile `production`, distribution `store`.

**Verified against Play requirements:**

| Requirement | Result |
|---|---|
| 64-bit | ✅ `arm64-v8a` present (+ armeabi-v7a, x86, x86_64) |
| Release signing | ✅ `jar verified`, 2048-bit RSA, valid to **2053-12-17** |
| Not debug-signed | ✅ cert is not `CN=Android Debug` |
| No debug config | ✅ no `debuggable`, no `testOnly`, no cleartext, no DevLauncher |
| Identity | ✅ `com.adialfaifi.vaultly`, `MainActivity` |

Signed with the EAS-managed keystore **`efWNIp19gc`** (the same key that signed
the dev build). `jarsigner` warnings about self-signing and no timestamp are
normal for Android.

### The release-build trap — read before you touch `locales`

Every production build failed until `7281c24`:
```
Execution failed for task ':app:lintVitalRelease'
values-b+ar/strings.xml:2: "CFBundleDisplayName" is translated here
  but not found in default locale [ExtraTranslation]   ×15
```
`locales` in `app.config.ts` is **top-level** — the Expo schema has no
`ios.locales` — so iOS Info.plist keys land in Android
`values-b+<locale>/strings.xml`. 3 keys × 5 locales = 15. **`lintVital` runs only
on release**, which is why development builds always passed.

Fixed by `plugins/withAndroidDefaultLocaleStrings.js`, which gives the default
locale an entry for each key, rather than disabling the check.

**Not done:** no Play Console listing, no store products, no upload. Note that
versionCode 6 was consumed by a failed build — `autoIncrement` bumps regardless.

⚠️ **If Play App Signing is already enrolled for `com.adialfaifi.vaultly` with a
different key, this AAB will be rejected.** First upload of a new app: fine.

### Privacy policy

`docs/privacy.html` — responsive, light/dark, self-contained, with
`.github/workflows/pages.yml` and `docs/.nojekyll`.

Every claim was checked against the code: no analytics/tracking/ad SDKs (verified
by dependency scan), sub-processors are exactly Supabase/OpenAI/RevenueCat/Google
Play/Expo/Google Sign-In, the security section describes real mechanisms, and the
deletion section matches what `delete-account` actually does.

### Published — these are the URLs Google Play gets

```
https://oodbdh.github.io/vaultly/privacy.html          privacy policy
https://oodbdh.github.io/vaultly/delete-account.html   data deletion
```

Both verified live 2026-08-03: **HTTP 200**, `text/html; charset=utf-8`, **zero**
placeholders remaining, no horizontal overflow at mobile widths.

`delete-account.html` exists because Play requires a publicly reachable deletion
page **including a route that does not need the app installed** — hence the email
request path alongside the in-app steps. Its list of what gets erased is written
from `supabase/functions/delete-account/index.ts`, which removes in order:
storage images → `vault_items` (warranties and subscriptions cascade) →
`bonus_slots` → `profiles` → the `auth.users` row.

⚠️ **The in-app route is `Profile → Support → Delete account`.** The policy used
to say `Profile → Account → …`, which was wrong — `Delete account` is a row in
the **Support** section of `app/(tabs)/profile.tsx`, and `account.tsx`
("Account details") has no delete control at all. Anyone following the old
wording reached a screen with no such button, on the exact route Play requires to
work. Fixed 2026-08-03. If that row ever moves, **three** places must change
together: the app, `docs/privacy.html`, and `docs/delete-account.html`.

⚠️ **Pages is served from the branch, not from the workflow.** Source is
*Deploy from a branch → `main` → `/docs`*. `.github/workflows/pages.yml` has
**never run** — the repo reports `total_count: 0` for Actions, so Actions is
disabled at the repo or account level. The workflow is therefore **dormant and
not the publishing mechanism**: `actions/deploy-pages` only works when the Pages
source is set to GitHub Actions, so if Actions is ever switched on, that workflow
will start failing against a branch-source site. Either delete it or switch the
Pages source — do not leave both half-configured.

Publishing is now just `git push`: the branch source redeploys automatically,
taking ~30–60s to serve new content.

All five placeholders are filled. Operator is an **individual, not a company** —
`LEGAL_ENTITY` in `src/content/support.ts` is a personal legal name, used
verbatim in both the en and ar documents; an Arabic form would have to come from
the operator. Minimum age is **13**, taken from the Terms in the same file.

⚠️ Two things still open: **it needs review by a qualified lawyer**, and if EU
distribution is intended, GDPR Art. 8 puts digital consent at 16 unless a member
state lowers it — the policy and the Terms must move together if 13 changes.

⚠️ The site **root** (`/vaultly/`) is a 404; `docs/` has no `index.html`. Only
the deep link is published. Harmless for Play, which takes the exact URL, but a
reviewer who trims the path sees a 404.

---

## 15. Storage, notifications, localization, UI

**Storage:** bucket `receipts`, private, 10 MB, MIME allow-list. Objects keyed
`<user_id>/<timestamp>-<rand>.<ext>`; four RLS policies scope every operation to a
folder matching `auth.uid()`. Reads go through short-lived signed URLs (1h).
`src/services/storage.ts` uses the SDK 54 `File` API (`File.bytes()` →
`Uint8Array`); the old `readAsStringAsync`/`EncodingType` API is gone.

**Notifications:** local only. Warranties **30/7/1** days before `expires_on`;
subscriptions **3/1** days before `next_renewal`. Fired 09:00 local. Scheduled
from `services/receipts.ts` in **both** backends. Push needs `EAS_PROJECT_ID`
and does not work in Expo Go. SDK 54: `setNotificationHandler` needs
`shouldShowBanner` + `shouldShowList`; triggers need
`{type: SchedulableTriggerInputTypes.DATE, date}`.

Identifiers are derived — `<kind>:<itemId>:<days>` — which is what makes
re-scheduling idempotent. The format now lives in `src/lib/reminderIds.ts`,
pure and with **9 tests**, because four operations depend on parsing it back:
schedule, cancel one item, cancel one kind, re-schedule one kind. ⚠️ **The
`<itemId>` is the vault item's id for both kinds**, including renewals, where
the parameter is confusingly named `subscriptionId`. It is never the
`subscriptions` row id. Match that or a re-schedule orphans what it meant to
replace.

**The Settings reminder toggles are live.** `profiles.warranty_reminders` /
`renewal_reminders` are the stored truth; `authStore` mirrors them into
`services/notifications` on every profile change (services must not read
stores), and the schedule functions consult that mirror. `useReminderPreferences`
persists first, then reconciles: switching off calls `cancelRemindersOfKind`,
switching on calls `rescheduleReminders`, which walks the vault via
`listReminderTargets` and restores each row's own `reminder_days`. Only the
write can fail the toggle; the reconcile is best-effort, since any later write
to an item re-derives its reminders anyway.

⚠️ **The mirror defaults to on.** A schedule call that races the first profile
load keeps its reminder rather than dropping it — losing a reminder is the
expensive failure, an extra one is not.

**Localization:** five locales — en, ar, es, fr, de. `compatibilityJSON: 'v3'` is
**required**. **Arabic needs all six CLDR plural forms** (`_0`…`_5`); a missing
form makes i18next fall back to the base key and **this shipped a real bug once**
(a 6-month warranty chip labelled "one month"). **RTL rule: logical properties
only** (`paddingStart`, `marginEnd`, `start`/`end`); `useDirection()` covers icon
mirroring and transforms. Long-form prose lives in `src/content/support.ts`,
**en + ar only**.

**UI:** design source `../Vaultly Screens.dc.html`, iteration **t4**. Tokens in
`src/theme/`: bg `#FAFAF8`, surface `#FFF`, border `#E7E5E0`, text `#14161A`,
muted `#6B7280`, navy `#1B2A4A`, gold `#C8A548`. Three-slot bottom bar:
**Home · FAB · Profile** (the FAB is not a tab; a spacer tab reserves its slot).
22 routes. Arabic runs 1–2px larger via `typeScale(locale)`.

### Layout fixes, 2026-08-04 (`06981eb`, `3532959`)

Four defects, all found by photographing the app rather than reading it, and all
sharing one cause: **`flex: 1` means `flexBasis: 0`**, so a text column next to
an unconstrained sibling collapses to nothing.

| Symptom | Cause | Fix |
|---|---|---|
| `Active subsc / riptions` — broke **inside** a word | 3 tiles across a phone leave ~77 dp; "subscriptions" needs ~80 | `SummaryCard` horizontal padding `md` → `sm`. `adjustsFontSizeToFit` alone did **not** help: on Android it shrinks to fit the *line count*, not to avoid a break |
| `Good morning, …` — name ellipsed away | Title + emoji + language chip on one row, capped at 1 line | `adjustsFontSizeToFit`, `minimumFontScale={0.75}` |
| `Amaz…` on the subscription card | Name column `flex: 1` (basis 0) beside an unconstrained countdown pill; the pill took ~200 dp of a 296 dp card, leaving ~24 dp | Name gets `flexBasis: 'auto'` + `minWidth: 96`; the pill is the side that shrinks |
| CTA buttons wildly different heights outside Arabic | `Button` had no wrapping guard and 24 dp side padding; `quota.watchAd` is 34 chars in EN, **46 in FR**, short in AR | `numberOfLines={2}`, `adjustsFontSizeToFit`, centred, padding `xl` → `lg`; `QuotaBanner` pair gets `flexBasis: 0` + `minWidth: 0` |

⚠️ **Arabic is the shortest string in nearly every pair**, which is precisely
why these only showed outside Arabic. When checking layout across languages,
**French and German are the worst cases**, not Arabic.

---

## 16. Testing

**`npm test` → 119 pass / 0 fail / 27 suites.** Node's built-in runner with native
TS stripping — no Jest, no ts-node. Tests must avoid `@/` aliases and import with
explicit `.ts` extensions.

```
node --test "src/**/*.test.ts" "supabase/functions/**/*.test.ts"
```

| File | Covers |
|---|---|
| `src/lib/dateMath.test.ts` | month terms, leap years, end-of-month clamping, billing cycles, DST |
| `src/i18n/plurals.test.ts` | Arabic six-form plurals across five locales |
| `src/lib/subscriptionRenewal.test.ts` | 48h renewal window, rollover, grace formatting |
| `src/lib/reminderIds.test.ts` | **9 tests** — the reminder identifier scheme: round-trip, per-item vs per-kind matching, and that unrecognised identifiers are never claimed |
| `supabase/functions/analyze-receipt/pipeline.test.ts` | **34 tests** — the OCR rules |

| Script | Status |
|---|---|
| `npm run db:check` | ✅ 10/10 |
| `npm run fn:check` | ✅ 4/4 (covers `analyze-receipt` only) |
| `npm run db:smoke -- --yes` | ⛔ blocked while email confirmation is on |

**No coverage:** React components, navigation, RTL rendering. `pipeline.ts` is
excluded from the app `tsconfig` (that dir is Deno); typecheck it standalone:
```
npx tsc --noEmit --strict --skipLibCheck --target es2022 --module esnext \
  --moduleResolution bundler --allowImportingTsExtensions \
  supabase/functions/analyze-receipt/pipeline.ts
```

---

## 17. Known bugs and open issues

| Issue | Severity | Notes |
|---|---|---|
| **Two accounts stuck at `email_change_confirm_status = 1`** | 🟠 High | Pending changes from 2–3 Aug, one link opened each. A new change request while one is pending may misbehave. Complete or clear before testing (§10) |
| **Production AAB is 18 commits behind `main`** | 🟠 High | Built from `7281c24`; nothing in §20–§23 is in it. Rebuild before any Play upload |
| **Metro's watcher misses edits in this OneDrive folder** | 🟠 High | Not an app bug, but it produces confidently wrong debugging. Always `--clear` and grep the bundle (§19) |
| Scanner overlay unverified on screen | 🟡 Medium | `f907275` bundle-verified only (§21, §24) |
| Filter chip row clips mid-chip on list screens | 🟡 Medium | Horizontally scrollable, so normal in use, but reads as clipping in a still — visible in `04-warranties.png` |
| Detail screens show an empty "Receipt" placeholder | 🟡 Medium | No seed item has an `image_path`; screenshots scroll past it. A real image would fill it |
| Subscription detail shows `Merchant: Entertainment` | 🟡 Medium | The row renders `category`; for subscriptions the seed puts the category there. Reads oddly but is existing behaviour |
| `sign-in.tsx` collapses all OAuth errors | 🟡 Medium | Every failure shows `providerUnavailable`; `void oauth()` swallows throws |
| Premium/webhook race | 🟡 Medium | §12 |
| Subscriptions have no edit flow | 🟡 Medium | Schema, reminders and screens exist |
| Clean status bar impossible on this device | 🟢 Low | HONOR skin ignores SystemUI demo mode; screenshots show Arabic-Indic numerals and notification icons (§20) |
| "Backup & restore" is a stub | 🟢 Low | No export exists; the privacy policy therefore points users to email for data copies |
| Stray `public.تطبيق` table | 🟢 Low | Not in any migration. RLS on, inserts rejected. Pollutes generated types |
| Progress bar uses `duration_months * 30` | 🟢 Low | Affects bar fill only, never the day count |
| `eslint` has no config | 🟢 Low | `npm run lint` has never worked |
| OneDrive sync races | 🟢 Low | Files can change mid-edit |

**Fixed, recorded so they are not reintroduced:** the `profiles.locale` CHECK
silently rejecting es/fr/de — `useSyncProfileLocale` was calling `supabase`
directly with a `void`ed promise and an `as 'en' | 'ar'` cast, so the 23514 went
nowhere; it now goes through `updateProfile`, which makes `services/profile.ts`'s
"every write in one place" claim actually true; Android launch crash
(`MobileAdsInitProvider`); Google Sign-In (`createURL` triple slash); email change
(stale `useURL` + unhandled `message`); release build (`lintVitalRelease`
ExtraTranslation); Arabic plural fallback (a *translation* bug that presented as a
date bug); `setMonth` month overflow; UTC/local drift; react-query typed as `any`
on TS 5.3; missing `/auth-callback` route; auth gate unmounting the callback
screen; `functions.invoke` having no `signal`; Restore Purchases discarding its
result; Delete Account having no `onPress`.

---

## 18. Next priorities, in order

1. **Run one real email change, end to end.** The only thing standing between
   this feature and "verified" is a sign-in, which automation must not do.
   Sign in on the device → Profile → Account details → new address → *Send
   verification link* → open **both** emails. Then confirm server-side:
   ```sql
   select email_change_sent_at, email_change_confirm_status from auth.users;
   ```
   Expect `confirm_status` to reach **2**. Clear the two stuck pending changes
   first (§10, §17).
2. **Look at the scanner on screen** and confirm `f907275` — no dimming, corner
   markers visible, header floating (§21). Bundle-verified only today.
3. **Scan one real receipt** — the five-stage pipeline has never processed a
   photo. Highest-value untested path.
4. **Re-shoot `12-receipt-scanner.png`** with the phone over an actual receipt
   (§20). Optional: Play needs only 2–8 screenshots and 11 are ready.
5. **Rebuild the production AAB.** The signed one is from `7281c24` and is 18
   commits behind `main`.
6. **Get the privacy policy reviewed by a lawyer.** It is published and complete,
   but no qualified person has read it (§14).
7. **Play Console:** create the app, complete the Data safety form (it must match
   the privacy policy — "no analytics, no ads" is currently true), upload the AAB.
   Policy URL: `https://oodbdh.github.io/vaultly/privacy.html`; data-deletion URL:
   `https://oodbdh.github.io/vaultly/delete-account.html`.
8. **Create the SAR 10/month subscription** in Play Console and map it to offering
   `default` / entitlement `premium_access` in RevenueCat. Add the webhook URL and
   secret in the RevenueCat dashboard. Then test a sandbox purchase and a restore.
9. **Resolve the dormant Pages workflow** — delete `.github/workflows/pages.yml`,
   or turn Actions on and switch the Pages source to it. Leaving both half-set is
   how this silently breaks later (§14).
10. **Re-add AdMob** with real app IDs — and update the privacy policy in the same
    change.
11. Turn `mailer_autoconfirm` off → `npm run db:smoke -- --yes` → turn it back on.
    Still the only way to exercise authenticated paths end to end.
12. Replace `assets/notification-icon.png`; add CI (typecheck + test + db:check).

**Done 2026-08-03:**

- `migrations/0004_profile_prefs.sql` applied to the linked project, types
  regenerated, and the two placeholders it required (`PendingProfileColumns`,
  the `as never` cast) deleted (`07568ce`). See §6.
- `Divider` / `LinkRow` / `Row` / `Section` in `app/(tabs)/profile.tsx` hoisted
  to module scope (`e23e848`), matching the fix already made in `account.tsx`.
- The Settings reminder toggles wired end to end (`3ed272f`) — see §15.
- Repo renamed to `vaultly`, made public, and pushed. Privacy policy published
  and verified at HTTP 200, with every placeholder filled (`cbfceac`, `f4a14f5`,
  `2be34dd`, `0aae4b9`) — see §2 and §14.
- Delete Account page published, and the in-app deletion route it documented
  corrected from `Profile → Account` to `Profile → Support` (`01c6cc1`,
  `dd74727`) — see §14.

**Done 2026-08-04:**

- Camera preview letterboxing fixed by cover-sizing (`06981eb`), verified on
  device by per-row pixel variance — §21.1.
- Dark scanner overlay removed; corner-marker guide and floating header
  (`f907275`) — §21.2. **Not yet seen on screen.**
- Currency: device-region resolution with a **USD** last resort (`8f07e46`), OCR
  no longer coercing to SAR, and the amount label made to match what is actually
  stored (`09c1c2e`) — §22. Verified on device.
- Showcase demo seed and capture pipeline (`c8ad6ff`), premium gates actually
  reached (`45e1d36`), realistic multi-currency data and shorter titles
  (`3532959`) — §23.
- Layout: summary tile no longer wraps mid-word, greeting no longer ellipses the
  name, subscription card no longer starves the name (`3532959`), CTA buttons
  sized consistently across languages (`06981eb`) — §15.
- 12 Google Play screenshots captured from the real app (`09f6c73`) — §20.
- Email change: copy corrected to describe both links (`09c1c2e`); mock mode no
  longer fabricates a "sent" result (`4f22de9`) — §10.

---

## 19. Hard-won lessons — read this before debugging

- **Get the trace before forming a theory.** Every major bug this project has hit
  turned out to be something other than the leading hypothesis. The launch crash
  looked like RevenueCat, was AdMob. The email change looked like a refresh bug,
  was two unrelated defects. Guessing cost more time than measuring, every time.
- **`lintVital` runs only on release.** A green development build proves nothing
  about a production build.
- **Verification method matters.** `select(…, {head:true})` sends HTTP HEAD and
  returns no body, so a *missing* table looks identical to an empty one. Listing
  storage buckets with the anon key returns `[]` either way. Both produced
  confidently wrong answers here.
- **Check your tools exist.** `strings` is not installed on this machine; a
  pipeline using it silently returned 0 matches and nearly produced a false
  "no session stored" finding. `unzip` is absent too (use .NET `ZipFile`).
- **`Linking.useURL()` cannot be trusted for deep links** while the app is
  running. Use expo-router route params.
- **Supabase does not validate `redirect_to` at `/authorize`** — it echoes
  anything. Validation happens at `/callback`, where a rejected value **silently**
  falls back to Site URL.
- **Fast Refresh can serve stale modules.** After structural changes, fully close
  the app and relaunch.
- 🔴 **Metro's file watcher does not see edits in this OneDrive folder at all.**
  This is worse than stale Fast Refresh and it cost three wasted verification
  cycles on 2026-08-04: the app was relaunched, the screenshot showed no change,
  and the obvious conclusion — "my fix didn't work" — was wrong every time. The
  only reliable loop here is:

  1. edit
  2. restart with `npx expo start --clear`
  3. **grep the served bundle** to prove the change is in it
  4. only then relaunch and look

  ```bash
  curl -s -o /tmp/b.js "http://localhost:8081/node_modules/expo-router/entry.bundle?platform=android&dev=true"
  grep -c "some string from your edit" /tmp/b.js
  ```

  Grep for **code**, not comments — comment survival through the transform is
  inconsistent, which produced one false negative on its own.
- **A screenshot is not proof the code ran.** Twice a conclusion was drawn from a
  device screenshot that turned out to reflect a stale bundle. Confirm the bundle
  first; the screen second.
- **Do not diagnose a dark screen by eye.** "Camera showing a dark room" and
  "black letterbox bars" are the same pixels to a human. Per-row pixel variance
  separates them in seconds — sensor noise is never uniform, a letterbox is
  (§21).
- **Mock mode can fabricate success for operations it cannot perform.** The
  email-change bug hunt of 2026-08-04 was entirely this (§10). Anything whose
  *effect is remote* — mail, payments, push — must fail loudly under
  `USE_MOCK_DATA` rather than return a cheerful empty object.
- **When something numeric looks wrong in Arabic, check the plural forms before
  the arithmetic.**
- **The two nested project folders** (§1).

---

## 20. Store assets and Google Play screenshots

```
store-assets/
  google-play/screenshots/   the deliverable — 12 Play-ready PNGs
  lib/shot.ps1               capture + post-processing helpers
  .raw/                      untouched 1080x2400 device frames (gitignored)
  README.md                  how to regenerate
```

Every screenshot is a real frame from the app running on the HONOR X9a 5G,
driven over adb. No mockups, no redesign.

### The 12 files

| # | File | Screen | Upload-ready |
|---|---|---|---|
| 01 | `01-home-dashboard.png` | Home dashboard | ✅ |
| 02 | `02-receipts.png` | All invoices | ✅ |
| 03 | `03-receipt-details.png` | Receipt detail | ✅ |
| 04 | `04-warranties.png` | All warranties | ✅ |
| 05 | `05-warranty-details.png` | Warranty detail | ✅ |
| 06 | `06-subscriptions.png` | All subscriptions | ✅ |
| 07 | `07-subscription-details.png` | Subscription detail | ✅ |
| 08 | `08-search.png` | Search, query "Apple" | ✅ |
| 09 | `09-profile-settings.png` | Profile + settings | ✅ |
| 10 | `10-add-to-vault.png` | Add sheet | ✅ |
| 11 | `11-add-warranty.png` | Add form, filled | ✅ |
| 12 | `12-receipt-scanner.png` | Scanner camera | ❌ **stale and dark** |

🔴 **`12-receipt-scanner.png` must be re-shot.** Two problems: it was captured
*before* the overlay was removed (§21), so it still shows the dark dimming
panes; and the phone was face-down, so the preview is black. Play needs only
2–8 phone screenshots, so the other 11 are sufficient without it.

### Why 1080×1920 and not the device's native size

The panel is 1080×2400 (20:9). Play wants 16:9 or 9:16 with the long side at
most twice the short one; 2400 ÷ 1080 = 2.22 fails **both** rules and is
rejected at upload. `Capture-Shot` scales each frame to fit 1080×1920 and
centres it on a canvas filled from **the frame's own corner pixel**, so the
padding is invisible against the near-white app screens and equally invisible
against the black camera screen. Nothing is cropped or stretched — cropping to
force the ratio would eat 480 px of real UI.

### Regenerating

`store-assets/README.md` has the full procedure. In short: connect the phone
with USB debugging accepted, start Metro with
`EXPO_PUBLIC_USE_MOCK_DATA=true EXPO_PUBLIC_DEMO_SHOWCASE=true`, `adb reverse
tcp:8081 tcp:8081`, then dot-source `store-assets/lib/shot.ps1` and call
`Capture-Shot -Name '…'`.

⚠️ **`shot.ps1` is deliberately pure ASCII.** Windows PowerShell 5.1 reads a
BOM-less `.ps1` as the system ANSI codepage, so any non-ASCII character in it —
including one inside a hard-coded path — is mangled at parse time. The user
profile here is `C:\Users\<arabic>`, which is precisely how a hard-coded adb
path once became unrunnable. The script therefore resolves adb at runtime via
`$env:VAULTLY_ADB`, then `PATH`, then a search under `%LOCALAPPDATA%\Temp\claude`.

⚠️ **There is no Android SDK on this machine.** adb lives in a Claude scratch
directory; `Resolve-Adb` finds it. If it vanishes, re-download
platform-tools (§1).

⚠️ **Clean status bar is best-effort and does not work here.** HONOR's skin
ignores SystemUI demo mode, so `Enter-CleanStatusBar` is a no-op and the bar
shows Arabic-Indic numerals plus notification icons. The device locale is
`ar-US` — Arabic language, **US region** — which is also why `deviceCurrency()`
resolves to USD (§22).

---

## 21. Receipt scanner — full-screen camera and undimmed overlay

Two separate problems, fixed in two commits, and the first diagnosis was wrong.

### 21.1 Preview was letterboxed (`06981eb`)

`CameraView` had `flex: 1`, so it was handed a box whose aspect ratio is the
screen minus the header — about 0.48 on a tall phone. No sensor produces that,
so the preview fitted inside it and the black backdrop showed as bars.

Fixed by sizing the preview to **cover**: pin it to 16:9 with `ratio`, compute
the smallest 16:9 box that covers the container, centre it, clip the overflow.
Nothing is stretched. The overlay moved from being a *child* of `CameraView` to
a **sibling** — as a child it would inherit the deliberately oversized frame and
be pushed off-screen with it.

**Verified measurably on device**, because a dark room and a letterbox look
identical by eye. Per-row pixel variance on the raw capture:

```
row 210   1 distinct luminance level, 100% pure black   <- app header, expected
row 300   3 levels, 0% pure black                        <- camera signal
row 1500  9 levels, 0% pure black
row 2390  4 levels, 0% pure black                        <- bottom of screen
```

Live sensor noise on every row from y=300 to y=2390; a letterbox would be a
uniform black band. **No bars.**

### 21.2 The dark overlay (`f907275`)

The remaining darkness was never the camera. The overlay painted four
`rgba(0,0,0,0.55)` panes around the capture window, so most of the viewfinder
was 55 % black.

It bought nothing: `takePictureAsync` has always captured the **full sensor
frame**. The frame is a positioning *guide*, not a crop, so dimming the rest hid
image the app keeps anyway while costing the user sight of what they were
aiming at.

- All four dimming panes **removed**. Zero remain — confirmed by grepping the
  served bundle, not the source.
- Guide is now `GuideFrame`: four corner markers plus a hairline outline.
- Legibility comes from **drop shadows on the marks and text**, never from
  darkening the image. This matters because the usual subject is a white
  receipt, where plain white marks vanish.
- The header in `app/item/new.tsx` no longer sits above the camera as an opaque
  black strip ~250 px tall. It floats over the preview with
  `pointerEvents="box-none"`, so the viewfinder runs the full screen height.

⚠️ **`f907275` is NOT verified on screen.** Types clean, 119 tests pass, and the
bundle contains `GuideFrame` with **0** occurrences of `rgba(0,0,0,0.55)` — but
the device dropped off adb mid-verification and it has never been looked at. See
§24.

---

## 22. Currency localization

Rule, in order: **the record's own currency → the device's region currency →
USD**.

- `deviceCurrency()` and `resolveCurrency()` live in `src/i18n/index.ts`.
  `deviceCurrency()` reads `expo-localization`'s `currencyCode`, validates it
  against `/^[A-Z]{3}$/`, and caches it.
- `FALLBACK_CURRENCY = 'USD'` (`8f07e46`). It is reached only when the device
  reports no usable currency — an unset or unrecognised region, where there is
  no evidence the user is in Saudi Arabia. It is a named constant so it is
  greppable and not mistaken for the SAR literals still in `src/mocks`, which
  are seeded invoices that genuinely *are* SAR.
- `formatCurrency(amount, locale, currency?)` takes `string | null` on purpose:
  a default parameter only fires on `undefined`, so it would miss the `null`s
  the database and the OCR extractor actually return — that would be an `Intl`
  crash, not a fallback.
- The OCR extractor returns `null` for an undetected currency (`06981eb`). It
  used to coerce to `'SAR'`, which is what made every scan claim to be Saudi.
  Absence of a currency is not evidence of a Saudi receipt.

**Verified end to end on device, 2026-08-04.** The device is `ar-US`, so
`deviceCurrency()` = USD. A warranty saved with **no** explicit currency
rendered **$500.00** — device region, not hardcoded SAR.

That test found a further defect, now fixed (`09c1c2e`): `add-warranty.tsx`,
`add-subscription.tsx` and `new.tsx` all hard-coded `Total (SAR)` in the amount
label while the save path used `resolveCurrency()`. On this device the field
said SAR and stored USD. The label now resolves the same way the save does —
verified reading **`Total (USD)`** on screen. `common.sar` is no longer
referenced anywhere in `app/` or `src/`.

⚠️ **Existing rows keep the currency already stored against them.** This changed
nothing retroactively; it only affects new items.

---

## 23. Showcase / demo mode

`EXPO_PUBLIC_DEMO_SHOWCASE=true` (with `USE_MOCK_DATA`) selects `SHOWCASE_SEED`
in `src/mocks/seed.ts` instead of the design seed, and runs the account as
premium. `DEMO_SHOWCASE` is exported from `src/constants/config.ts`.

The showcase seed sits **alongside** the original `SEED` rather than replacing
it: that one exists to put every countdown tier on screen at once for design
review, and retuning it for screenshots would have destroyed that silently.

**17 items** across the merchants in the brief — Starbucks, Carrefour, Apple
Store, IKEA, Zara, Nike, Noon (receipts); Samsung 65" TV, MacBook Pro, Dyson
V15, LG Washer, Sony XM5 (warranties); Netflix, Spotify, iCloud+, Adobe CC,
Amazon (subscriptions).

**Currencies follow each merchant's home market** — USD, EUR, AED, SAR — which
also exercises the "keep the invoice's own currency" rule on a real screen.
Amounts are **priced in each currency, not converted from one figure**: a
MacBook is $1,999, not $9,299; a Starbucks run is $12.85, not SAR 42.50.

Titles are deliberately short. The cards give a name roughly 12–14 characters
beside a countdown pill, so "Adobe Creative Cloud" rendered as "Adobe Crea…".

⚠️ **Premium is not vanity.** The free tier caps at 4 items, so a full vault
photographed beside "3 of 4 items used" reads as a bug — and premium also drops
the rewarded-ad card, which has no business in a store listing.

⚠️ **`plan_tier` on the mock profile does nothing on its own** (`45e1d36`).
Every premium gate reads `useEntitlementStore`, whose source of truth is
RevenueCat; the `profiles` row is only a webhook mirror for server-side quota
checks. `DEMO_SHOWCASE` therefore forces `isPremium` in the store itself,
including in `setInfo`, so a late `CustomerInfo` callback cannot flip it back.

🔴 **The mock-mode trap.** `USE_MOCK_DATA` makes the app *look* fully functional
while nothing leaves the device. This directly caused the 2026-08-04
email-change false alarm (§10). Before debugging anything that involves a
server, check the served manifest:

```bash
curl -s -H "expo-platform: android" -H "accept: application/expo+json,application/json" \
  http://localhost:8081/ | grep -o '"useMockData":[a-z]*'
```

---

## 24. What is NOT verified

Everything else in this document was checked. These were not:

| Item | Status | What it needs |
|---|---|---|
| Scanner overlay (`f907275`) | bundle-verified only, **never seen on screen** | Relaunch and look; the device dropped off adb mid-check |
| Email change end to end | **never run against a real inbox** | Sign in on device, change address, open **both** links (§10) |
| Real receipt through OCR | **never** | One photo through the five-stage pipeline (§8) |
| `12-receipt-scanner.png` | stale **and** dark | Re-shoot with the phone over a receipt (§20) |
| Production AAB vs `main` | AAB is from `7281c24`, **18 commits behind** | New EAS production build before any upload |
| Play Console listing | not started | §18 |
| Store products / RevenueCat | not started | §12 |

---
