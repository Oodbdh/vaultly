# Vaultly — Project State

**Single source of truth. Last verified: 2026-08-03.**

Every claim here was checked against the live project, the live database or the
working tree on that date — not recalled. Where something is unverified, it says
so explicitly. `HANDOVER.md` is an older document kept for its post-mortems; if
the two disagree, **this file is correct**.

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

**What is not done:** no Play Console listing, no store products, and no real
receipt has been through the new OCR pipeline.

**Immediate next actions** — see §18 for the full ordered list:
1. Scan one real receipt to exercise the new pipeline (§8).
2. Get the privacy policy reviewed by a lawyer, then create the Play listing.

**Verification gates, re-run 2026-08-03 after applying `0004`:**

| Gate | Command | Result |
|---|---|---|
| Types | `npx tsc --noEmit` | **clean** |
| Tests | `npm test` | **119 pass / 0 fail, 27 suites** |
| Database | `npm run db:check` | **10/10 PASS** |
| Edge Function | `npm run fn:check` | **4/4 PASS** |
| Production AAB | EAS `523f6dbc` | **finished, signed** |

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

**Commit history:**
```
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
| `EXPO_PUBLIC_AI_PROVIDER` | empty ⇒ `edge` |
| `EXPO_PUBLIC_ADMOB_*` | empty (no longer read — §13) |
| `EAS_PROJECT_ID` | empty; hardcoded fallback in `app.config.ts` |

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

## 10. Email change — fixed (`1a493da`)

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

⚠️ **Open product decision:** `account.emailPending` still tells the user to check
only the *new* address, while the flow requires opening **both** links. Either
reword in five locales, or turn Secure email change off in the dashboard.

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

### Published — this is the URL Google Play gets

```
https://oodbdh.github.io/vaultly/privacy.html
```

Verified live 2026-08-03: **HTTP 200**, `text/html; charset=utf-8`, operator name
and address each present twice, **zero** placeholders remaining.

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
| Email-change copy names only the new address | 🟡 Medium | Secure email change needs **both** links (§10) |
| `sign-in.tsx` collapses all OAuth errors | 🟡 Medium | Every failure shows `providerUnavailable`; `void oauth()` swallows throws |
| Premium/webhook race | 🟡 Medium | §12 |
| Subscriptions have no edit flow | 🟡 Medium | Schema, reminders and screens exist |
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

1. **Scan one real receipt** — the five-stage pipeline has never processed a photo.
   Highest-value untested path.
2. **Get the privacy policy reviewed by a lawyer.** It is published and complete,
   but no qualified person has read it (§14).
3. **Play Console:** create the app, complete the Data safety form (it must match
   the privacy policy — "no analytics, no ads" is currently true), upload the AAB.
   Policy URL: `https://oodbdh.github.io/vaultly/privacy.html`.
4. **Create the SAR 10/month subscription** in Play Console and map it to offering
   `default` / entitlement `premium_access` in RevenueCat. Add the webhook URL and
   secret in the RevenueCat dashboard. Then test a sandbox purchase and a restore.
5. **Resolve the dormant Pages workflow** — delete `.github/workflows/pages.yml`,
   or turn Actions on and switch the Pages source to it. Leaving both half-set is
   how this silently breaks later (§14).
6. **Re-add AdMob** with real app IDs — and update the privacy policy in the same
   change.
7. Turn `mailer_autoconfirm` off → `npm run db:smoke -- --yes` → turn it back on.
   Still the only way to exercise authenticated paths end to end.
8. Replace `assets/notification-icon.png`; add CI (typecheck + test + db:check).

**Done since this list was written**, all on 2026-08-03:

- `migrations/0004_profile_prefs.sql` applied to the linked project, types
  regenerated, and the two placeholders it required (`PendingProfileColumns`,
  the `as never` cast) deleted. See §6.
- `Divider` / `LinkRow` / `Row` / `Section` in `app/(tabs)/profile.tsx` hoisted
  to module scope, matching the fix already made in `account.tsx`. Verified by
  requesting the Android bundle from Metro (HTTP 200) as well as `tsc`, since
  the suite has no component coverage.
- The Settings reminder toggles wired end to end — see §15.
- Repo renamed to `vaultly`, made public, and pushed. Privacy policy published
  and verified at HTTP 200, with every placeholder filled — see §2 and §14.

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
- **When something numeric looks wrong in Arabic, check the plural forms before
  the arithmetic.**
- **The two nested project folders** (§1).
