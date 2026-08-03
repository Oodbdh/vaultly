# Vaultly — Handover

**Written:** 2026-08-02, updated later the same day. Every claim was verified
against the live project and working tree on that date. Where something could
not be verified, it says so explicitly rather than guessing.

> **Update — since this file was first written:**
>
> - All 43 files of uncommitted work are now **committed** (`62a0b80`). §15 is
>   history, not a warning.
> - `react-native-google-mobile-ads` has been **removed** (`ffb023a`).
> - **The Android launch crash is CONFIRMED FIXED.** The logcat trace was
>   captured on-device and named the cause exactly; a rebuilt dev client
>   (EAS `47f9d9c9`, commit `d53306c`) launches, reaches `.MainActivity` and runs
>   JS. §14 has the trace and the verification.
> - Next action is **§20 step 2** (Google OAuth in the dev build).

> ⚠️ **SUPERSEDED — read `PROJECT_STATE.md` instead.**
>
> `PROJECT_STATE.md` was rewritten and verified on 2026-08-03 and is now the
> single source of truth. This file is kept only for its bug post-mortems and the
> detailed evidence behind the Android launch-crash investigation.
>
> Everything below describes the project as of **2026-08-02** and is stale in
> several places: the launch crash, Google Sign-In and the email-change flow have
> all since been fixed and verified; the OCR path is now a five-stage pipeline;
> RevenueCat is configured for Android; and a signed production AAB exists.
> Where the two files disagree, **`PROJECT_STATE.md` is correct.**

---

## 1. Current status in one paragraph

Vaultly is an Expo SDK 54 / React Native 0.81 mobile app for tracking receipts,
warranties and subscriptions. It is **feature-complete against the design** and
type-clean with 76 passing tests. All work is now committed. The blocker that
dominated this project — **the Android development build crashing on launch
before any JavaScript ran** — is **fixed and verified on-device** (§14): an
autolinked Google Mobile Ads SDK with a blank `APPLICATION_ID` threw from
`MobileAdsInitProvider` during `handleBindApplication`. The remaining known gaps
are two auth flows that cannot complete in Expo Go by design (§8, §9).

**Verification gates, run 2026-08-02 after the AdMob removal:**

| Gate | Command | Result |
|---|---|---|
| Types | `npx tsc --noEmit` | **clean** |
| Unit tests | `npm test` | **76 pass / 0 fail, 14 suites** |
| Android bundle | Metro, cold | HTTP 200, 9.64 MB (was 10.02) |
| iOS bundle | Metro, cold | HTTP 200, 9.65 MB (was 10.03) |
| Android prebuild | `expo prebuild --clean -p android` | clean; **no ads refs, no ads meta-data** |
| EAS dev build | `47f9d9c9` from `d53306c` | **finished** |
| Android dev build | launch on device, no Metro | **launches** — dev launcher renders |
| Android dev build | launch with Metro | **`.MainActivity` + JS running** |

---

## 2. Where the code lives

```
C:\Users\عدي\OneDrive\سطح المكتب\تطبيق 1\Vaultly Digital Vault Setup\vaultly
```

Note the **two nested folders** — the outer `Vaultly Digital Vault Setup\` holds
design files, the inner `vaultly\` is the app. Most "file not found" confusion
traces to that nesting.

The project sits in a **OneDrive-synced** folder. Files can change under you
mid-edit, and `.env` is uploaded to Microsoft despite being gitignored.

**Environment:** Arabic-language Windows 11, PowerShell. Node v24.18.0. The Bash
tool does not have Node on PATH — use PowerShell with a PATH refresh:

```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
```

---

## 3. How to run

```powershell
cd "C:\Users\عدي\OneDrive\سطح المكتب\تطبيق 1\Vaultly Digital Vault Setup\vaultly"
$env:REACT_NATIVE_PACKAGER_HOSTNAME = "192.168.0.163"
npx expo start
```

**The hostname pin is mandatory.** This machine has two VMware adapters
(`192.168.13.1`, `192.168.111.1`) enumerated ahead of Wi-Fi; without the pin
Expo advertises an unreachable IP. The Wi-Fi address is DHCP — **re-check it**
with `Get-NetIPAddress -AddressFamily IPv4`.

`expo-dev-client` is now installed, so `expo start` runs in **dev-client** mode.
Do **not** pass `--go` any more unless you deliberately want Expo Go.

Verify a bundle actually compiles (Metro only bundles on request):

```
http://localhost:8081/node_modules/expo-router/entry.bundle?platform=android&dev=true
```

Note the entry path — this is an expo-router project, `/index.bundle` 404s.

---

## 4. Architecture

```
app/            expo-router file routes (22 routes)
src/components  presentational + one shared picker per domain
src/hooks       react-query wrappers, one concern each
src/services    all I/O: ocr/, receipts, storage, notifications, profile, purchases, ads, support
src/store       zustand: auth, entitlement, ui
src/lib         supabase client, dateMath, subscriptionRenewal, authCallback, errors, types
src/mocks       in-memory backend, swapped in by one flag
```

**Three rules the codebase depends on:**

1. **One backend switch.** `USE_MOCK_DATA` in `src/constants/config.ts`. No
   screen or query key knows which backend is live — services delegate.
   ⚠️ *`PROJECT_STATE.md` claims it is read in exactly four places. That is no
   longer true — it is read in `services/receipts.ts`, `storage.ts`,
   `notifications.ts`, `profile.ts`, `ads.ts`, `store/authStore.ts`,
   `hooks/useItemQuota.ts`, `hooks/useSession.ts`.*
2. **No AI key in the client, ever.** OCR goes through the Edge Function.
3. **All date arithmetic through `src/lib/dateMath.ts`.** Zero app imports, so
   it runs under the bare test runner. `src/lib/subscriptionRenewal.ts` follows
   the same rule.

**Styling:** no NativeWind. Tokens in `src/theme/`, applied inline. Keep it so.

---

## 5. Packages (verified from package.json, 2026-08-02)

| Package | Version |
|---|---|
| expo | ^54.0.36 |
| react-native | 0.81.5 |
| react | 19.1.0 |
| expo-router | ~6.0.24 |
| expo-dev-client | ~6.0.21 |
| typescript | ~5.9.2 (**must stay ≥5.4**) |
| @supabase/supabase-js | ^2.45.4 (resolves 2.111.0) |
| @tanstack/react-query | ^5.59.0 |
| zustand | ^4.5.5 |
| i18next / react-i18next | ^23.15.1 / ^15.0.2 |
| expo-sharing | ~14.0.8 |
| expo-web-browser | ~15.0.11 |
| expo-file-system | ~19.0.23 |
| ~~react-native-google-mobile-ads~~ | **removed** (`ffb023a`, was ^15.8.3) — §11 |
| react-native-purchases | ^8.2.2 |

Added during this work: **`expo-sharing`** (RN core cannot share files on
Android) and **`expo-dev-client`**.

⚠️ `PROJECT_STATE.md` lists `react-native-google-mobile-ads@^14.2.5`. Wrong on
both counts — it was 15.8.3, and it is now gone entirely.

**TypeScript must stay ≥5.4.** react-query 5.6+ needs `NoInfer<T>`; on 5.3 every
`useQuery` result silently becomes `any`. Expo warns it wants ~5.3.3. **Ignore.**

**Always `npx expo install`**, never plain `npm install`, for Expo packages.

---

## 6. Environment variables

`.env` state verified 2026-08-02 (presence only, values not printed):

| Variable | State |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | **set** |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | **set** |
| `EXPO_PUBLIC_GEMINI_MODEL` | set (inert) |
| `EXPO_PUBLIC_USE_MOCK_DATA` | **empty** ⇒ live database |
| `EXPO_PUBLIC_AI_PROVIDER` | empty ⇒ `edge` |
| `EXPO_PUBLIC_GEMINI_API_KEY` | empty |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `_ANDROID_KEY` | **empty** |
| `EXPO_PUBLIC_ADMOB_IOS_APP_ID` / `_ANDROID_APP_ID` | empty (no longer read — §11) |
| `EXPO_PUBLIC_ADMOB_REWARDED_IOS` / `_ANDROID` | empty |
| `EAS_PROJECT_ID` | empty (hardcoded fallback in `app.config.ts`) |
| `EXPO_PUBLIC_SUPPORT_EMAIL` | not present → code default |

**There is deliberately no `EXPO_PUBLIC_OPENAI_API_KEY`.** Adding one would
compile a billable key into the bundle. It is a Supabase secret.

Restart the dev server after any `.env` change — read at startup only.

---

## 7. Supabase

- **Project ref:** `baxlbbuxwajlzgdvpykw` · region `ap-south-1` · Postgres 17.6.1
- CLI logged in and linked (`supabase/.temp/project-ref`)

**Auth providers, verified live 2026-08-02** via `GET /auth/v1/settings`:

| Setting | Value |
|---|---|
| `external.email` | **true** |
| `external.google` | **true** ← enabled during this work |
| `external.apple` | **false** |
| `mailer_autoconfirm` | **false** (email confirmation required) |
| `disable_signup` | false |
| Anonymous sign-in | disabled |

**Not readable from code.** Site URL, the Redirect URLs allow-list, and
`mailer_secure_email_change_enabled` are **not exposed** to the anon key, and
`supabase config` has only a `push` subcommand (which *writes* — do not run it
to inspect). These must be read in the dashboard.

**Edge Functions:**

| Function | Status |
|---|---|
| `analyze-receipt` | **deployed**, ACTIVE, verify_jwt true |
| `grant-bonus-slot` | in repo, **not deployed** |
| `revenuecat-webhook` | in repo, **not deployed** |
| `delete-account` | **new this session**, in repo, **not deployed** |

Deploy with `--use-api` — **Docker is not installed** and the default path needs it:

```bash
npx supabase functions deploy delete-account --use-api
```

⚠️ **Pick one migration path, never both.** `setup.sql` does not record itself in
migration history, so a later `supabase db push` would try to apply
`0001_init.sql` from scratch and fail on bare `create type`.

---

## 8. Google OAuth — status: **blocked, code is correct**

**Implementation is complete and correct.** `app/(auth)/sign-in.tsx:76-93`:
`signInWithOAuth({provider, options:{redirectTo, skipBrowserRedirect:true}})` →
`WebBrowser.openAuthSessionAsync(data.url, redirectTo)` →
`completeAuthFromUrl(result.url)`. PKCE, verified at runtime
(`code_challenge_method=s256`).

**Symptom:** account picker works, then the browser hangs forever and never
returns.

**Exact runtime values captured 2026-08-02:**

```
authRedirectTo()  = exp://192.168.0.163:8081/--/auth-callback
data.url          = https://baxlbbuxwajlzgdvpykw.supabase.co/auth/v1/authorize
                    ?provider=google
                    &redirect_to=exp%3A%2F%2F192.168.0.163%3A8081%2F--%2Fauth-callback
                    &code_challenge=…&code_challenge_method=s256
redirect_uri sent to Google = https://baxlbbuxwajlzgdvpykw.supabase.co/auth/v1/callback
```

**Root cause: Expo Go.** `expo-linking/build/createURL.js:60-63` states in its own
source:

> "The created URL … is **neither stable nor predictable** … If a stable URL is
> needed, **for example in authorization callbacks**, a build (or development
> build) of your application should be used and the scheme provided."

`Schemes.js:5-17`: `hasCustomScheme()` returns true only for `Bare`/`Standalone`
execution environments. **Expo Go returns false**, so the declared
`scheme: 'vaultly'` is never used and `exp://` is emitted instead.

`expo-web-browser/build/WebBrowser.js:263-265` — Android takes a polyfill path,
and `:348-358` resolves **only** on a `Linking` url event whose URL
`startsWith(returnUrl)`. No matching URL ever arrives, so the promise never
resolves and `completeAuthFromUrl` is never called.

**Measured allow-list behaviour** (honour-detector: a marker in the query string
survives iff the value passes the allow-list):

```
KEPT   vaultly://auth-callback
FELL   exp://192.168.0.163:8081/--/auth-callback
FELL   exp://192.168.0.163/--/auth-callback      (no port)
FELL   exp://myhost/--/auth-callback             (no dots, no port)
FELL   exp://abc.exp.direct/--/auth-callback
FELL   https://not-allowed.example.com/cb        (control)
```

Every `exp://` shape behaves like the known-disallowed control, while
`vaultly://auth-callback` is honoured. **In a development build this flow should
work**, because `createURL` then emits `vaultly://auth-callback`, which passes.

**Do not "fix" this in application code.** The code matches the official pattern.

---

## 9. Apple Sign-In — status: **implemented, button hidden**

Code is complete and identical to the Google path. The button is hidden behind a
single flag, `app/(auth)/sign-in.tsx`:

```ts
const APPLE_SIGN_IN_ENABLED = false;
```

Nothing was deleted — `oauth('apple')`, the `'apple'` union member, and
`auth.continueWithApple` in all five locales are intact. **Re-enable by flipping
that one word to `true`.**

Blocked on: Apple Developer account ($99/yr), a Services ID, a signing key, and
enabling the Apple provider in Supabase (`external.apple = false` today).

⚠️ **App Store Guideline 4.8** requires *native* Sign in with Apple if the app
offers other third-party logins. Shipping Google on iOS will likely require
`expo-apple-authentication` (not installed) and a dev build.

---

## 10. RevenueCat — status: code complete, never configured, never executed

`src/services/purchases.ts` wraps the SDK behind a lazy `require()` — a top-level
import crashes the bundle where the native module is absent. Every function
degrades to "not configured".

Entitlement id must be **`premium_access`**, offering id **`default`**. The
Supabase user id is passed as the RevenueCat App User ID.

**Restore Purchases was fixed this session.** It previously called RevenueCat
correctly but both call sites discarded the result (`void restore()`), and
`restore()` returned a bare boolean whose `catch` swallowed the real error.
It now returns a discriminated `RestoreOutcome`
(`restored` / `none` / `unavailable` / `error` with the real message) and both
`profile.tsx` and `paywall.tsx` surface it via the existing Alert.

To activate: store products, RevenueCat project, keys in `.env`, deploy
`revenuecat-webhook` + secret, and a dev build.

---

## 11. AdMob — status: **package removed**, code kept dormant

`react-native-google-mobile-ads` is **no longer a dependency** (`ffb023a`). It
was the diagnosed cause of the launch crash: the config plugin was conditionally
omitted when the app IDs are blank (they are), but the npm package stayed in
`dependencies`, so autolinking compiled the native SDK anyway — see §14.

`src/services/ads.ts` is **unchanged at runtime**. The lazy `require()` already
degrades to `unavailable`, so the rewarded-slot path fails safe with the package
absent. Only its *type* changed: `typeof import('react-native-google-mobile-ads')`
cannot resolve an uninstalled package, so the surface the file uses is now
described structurally. **Swap that back** when the package returns.
`usePremium().showAds` is still the single ad gate.

**To re-enable:** `npx expo install react-native-google-mobile-ads`, set
`EXPO_PUBLIC_ADMOB_IOS_APP_ID` / `_ANDROID_APP_ID`, restore the plugin block and
both `config.googleMobileAdsAppId` entries in `app.config.ts` (the removal
comment there lists them), and revert the `AdsModule` type. Then rebuild.

Rewarded ads mint bonus slots only via `grant-bonus-slot` (service role) — **not
deployed**, so the grant would have failed even with AdMob configured. Nothing
reachable was lost by removing this.

---

## 12. Notifications — local only

- Warranties: **30 / 7 / 1** days before `expires_on`
- Subscriptions: **3 / 1** days before `next_renewal`
- Identifiers derived (`warranty:<itemId>:<days>`) so re-scheduling is idempotent
- Fired 09:00 local
- Scheduled from `services/receipts.ts` on create, in **both** backends

**Push does not work in Expo Go** (removed SDK 53). Needs `EAS_PROJECT_ID` and a
dev build. `profiles.push_token` is written only in live mode, now via
`services/profile.ts`.

SDK 54 API notes: `setNotificationHandler` needs `shouldShowBanner` +
`shouldShowList` alongside `shouldShowAlert`; triggers need
`{type: SchedulableTriggerInputTypes.DATE, date}`.

---

## 13. OCR / AI — status: deployed, **never executed end to end**

```
src/services/ocr/
├── types.ts    shape, prompt, JSON schema, normalise(), RECEIPT_CATEGORIES
├── edge.ts     DEFAULT — POSTs to analyze-receipt with the session JWT
├── gemini.ts   legacy, key in bundle, opt-in only
└── index.ts    extractReceipt() — dispatches on AI_PROVIDER
```

Model `gpt-4o-mini`, Structured Outputs, `strict: true`. Validation runs twice —
server-side and again in `normalise()` on the client.

**Fixed this session — merchant/category were wrong:**

1. The prompt had **no rule for `category`** at all, while the schema marked it
   `required`. The model invented values, often the shop name. The prompt now
   separates merchantName / productName / category explicitly with a worked
   example, and `category` is a **closed 18-value enum** in the response schema.
2. `normalise()` routed `category` through the only unsanitised path in the file
   (no trim, no empty→null). It now goes through `canonicalCategory()`, which
   returns null for anything off-list — so a shop name **cannot** reach the
   column even from the Gemini provider, whose schema dialect has no enum.
3. `app/item/new.tsx` **never passed `category`** on the receipt save, so every
   scanned receipt stored `null`. It now passes it.

⚠️ **The Edge Function change is NOT deployed.** Run `npm run fn:deploy` — until
then scans use the old prompt (the client-side gate still protects the column).

**Column semantics are polymorphic by kind** (documented in `src/mocks/seed.ts:55-58`):

| kind | `merchant_name` | `category` |
|---|---|---|
| receipt | the shop | a real category |
| warranty | the **product** | the **shop** |
| subscription | the **service** | the **shop** |

`app/item/[id].tsx` used to label both literally, showing them swapped on
warranties. It is now kind-aware. **No schema change was made.**

---

## 14. ✅ Android development build crash — CONFIRMED AND FIXED

**Symptom (historical):** the dev build exited immediately on launch. No red box,
no JS error, and it happened with Metro not running.

**The trace, captured on-device 2026-08-02** from the crashing build
(`62f7a2ef`, commit `a5fa077`, versionCode 5) on an HONOR X9a 5G, Android 13:

```
FATAL EXCEPTION: main
Process: com.adialfaifi.vaultly, PID: 31635
java.lang.RuntimeException: Unable to get provider
    com.google.android.gms.ads.MobileAdsInitProvider:
    java.lang.IllegalStateException: Invalid application ID.
  at android.app.ActivityThread.installProvider(ActivityThread.java:8703)
  at android.app.ActivityThread.installContentProviders(ActivityThread.java:8198)
  at android.app.ActivityThread.handleBindApplication(ActivityThread.java:7924)
Caused by: java.lang.IllegalStateException: Invalid application ID
  at ...client.zzey.attachInfo(play-services-ads-api@@24.6.0:12)
  at ...ads.MobileAdsInitProvider.attachInfo(play-services-ads-api@@24.6.0:1)
```

`installContentProviders` runs inside `handleBindApplication`, i.e. **before**
`Application.onCreate()` and long before React Native starts — which is exactly
why no JS ran and why Metro was irrelevant. It was the only fatal error in the
log; everything else was the process dying as a consequence.

**Getting `adb` here:** there is no Android SDK on this machine. Platform-tools
were unpacked standalone into a scratch dir (no system install, no PATH change);
`winget install Google.PlatformTools` fails with a stale-manifest hash mismatch.
On the phone, USB debugging exposes a third USB interface (`MI_02`, "ADB
Interface") — if you only see `MI_00`/`MI_01`, debugging is not actually on.

**Evidence gathered locally beforehand (all verified, all consistent):**

1. `react-native-google-mobile-ads` **is autolinked**. From
   `android/build/generated/autolinking/autolinking.json` the Android-linked
   modules are: `async-storage`, `expo`, **`react-native-google-mobile-ads`**,
   `react-native-purchases`, `safe-area-context`, `screens`.
2. The module's manifest injects a required placeholder —
   `node_modules/react-native-google-mobile-ads/android/src/main/AndroidManifest.xml`:
   ```xml
   <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID"
              android:value="${appJSONGoogleMobileAdsAppID}"/>
   ```
3. The generated `android/app/src/main/AndroidManifest.xml` contains **no**
   `com.google.android.gms.ads.APPLICATION_ID` (read in full).
4. The module's own `android/build.gradle:89-98` prints at build time:
   > *"WARNING: react-native-google-mobile-ads requires an 'android_app_id'
   > property inside a 'react-native-google-mobile-ads' key in your app.json …
   > **The native Google Mobile Ads SDK will crash on startup without it.**"*
5. The module resolves that id from a `react-native-google-mobile-ads` key in
   **`app.json`** — and **this project has no `app.json`** (config is
   `app.config.ts` only), so the placeholder resolves to `""`.

**Most likely root cause:** the Google Mobile Ads SDK is linked with an empty
`APPLICATION_ID`, so `MobileAdsInitProvider` throws during `Application.onCreate()`
— before React Native initialises. That matches an immediate exit with no JS error
exactly, and explains why Expo Go never showed it (no native modules there).

**Ruled out** (none of these has run at crash time): RevenueCat (lazy JS require),
Supabase (pure JS), Expo Router, `expo-dev-client`.

**Fix, APPLIED in `ffb023a`:** `react-native-google-mobile-ads` removed from
`dependencies`; the conditional plugin block and both
`config.googleMobileAdsAppId` entries deleted from `app.config.ts`;
`services/ads.ts` left working (§11). Verified afterwards: `tsc` clean, 76 tests
pass, both bundles HTTP 200 and 0.4 MB smaller, and a `--clean` Android prebuild
produces a project with **zero** `google-mobile-ads` references and **no** ads
`meta-data` in `AndroidManifest.xml`.

**Verified end to end on-device, 2026-08-02.** Rebuilt as EAS `47f9d9c9` from
commit `d53306c` (native fingerprint changed `2e4aee3a…` → `59f73124…`),
installed over ADB, launched with cleared log buffers and **no Metro running**:

| Check | Result |
|---|---|
| `logcat -b crash` after launch | **no fatal exceptions** |
| Process after 25 s | **alive** |
| `MobileAds` / `gms.ads` in any buffer | **none** |
| Resumed activity, no Metro | `DevLauncherActivity` (dev launcher UI renders) |
| Resumed activity, Metro attached | **`.MainActivity`** |
| JS | `ReactNativeJS: Running "main" … "fabric":true` |

**Why the fix works:** `MobileAdsInitProvider` is declared in the
`play-services-ads` AAR's manifest, which reached the merged manifest only via
autolinking of the npm package. With the package gone the provider is not
declared, so `installContentProviders` has nothing to instantiate and cannot
throw. Confirmed absent: no `play-services-ads` / `gms.ads` anywhere in a
regenerated `android/`, and neither `react-native-purchases` nor
`expo-notifications` pulls it in transitively.

**Related, same package:** an earlier EAS Android build failed with Kotlin
`Unresolved reference: currentActivity` / `runOnUiThread` in this module. The API
still exists in RN 0.81.5 (`ReactContext.java` is Java and declares
`getCurrentActivity()`), and only Kotlin files failed while Java files using the
same API compiled — a toolchain signature. The module pins `compileSdk 34`,
`buildTools 34.0.0`, AGP 7.0.4 and defaults Kotlin to **1.8.22**, while RN 0.81.5
is built with **Kotlin 2.1.20**. `expo-build-properties` is present but sets only
`{ android: { extraMavenRepos: [] } }` — no `compileSdkVersion`, no `kotlinVersion`.

---

## 15. Files modified recently — **now committed**

All of the below went in as `62a0b80`, on `main`, gates green at commit time.
`ffb023a` followed with the AdMob removal. The working tree is clean; there is
still **no git remote**, so the only copy is this machine plus OneDrive.

**Modified (33):**
```
app.config.ts                     app/(auth)/sign-in.tsx
app/(tabs)/home.tsx               app/(tabs)/profile.tsx
app/_layout.tsx                   app/auth-callback.tsx
app/item/[id].tsx                 app/item/new.tsx
app/paywall.tsx                   package.json / package-lock.json
src/components/NeedsAttention.tsx src/components/RenewalPicker.tsx
src/components/StatusBadge.tsx    src/components/WarrantyDurationPicker.tsx
src/constants/config.ts           src/hooks/useCreateSubscription.ts
src/hooks/usePaywall.ts           src/i18n/locales/{ar,de,en,es,fr}.json
src/lib/database.types.ts         src/mocks/backend.ts
src/mocks/seed.ts                 src/services/notifications.ts
src/services/ocr/types.ts         src/services/receipts.ts
src/services/storage.ts           src/services/support.ts
src/store/authStore.ts            supabase/functions/analyze-receipt/index.ts
supabase/setup.sql
```

**New (8):**
```
app/account.tsx                       src/components/DurationInput.tsx
src/components/ImageViewer.tsx        src/lib/subscriptionRenewal.ts
src/lib/subscriptionRenewal.test.ts   src/services/profile.ts
supabase/functions/delete-account/    supabase/migrations/0004_profile_prefs.sql
```

⚠️ `app.config.ts` was edited outside this work: bundle ids changed
`com.vaultly.app` → **`com.adialfaifi.vaultly`**, `EAS_PROJECT_ID` given a
hardcoded fallback `c8899277-7bd4-469f-84c8-9b5e43a01208`, and
`config.googleMobileAdsAppId` added to both platforms (resolving to `undefined`,
since the env vars are empty).

---

## 16. Work completed this session

- **Duration pickers redesigned** — warranties and subscriptions now use one
  shared `DurationInput` (number + Days/Months/Years). Typed calendar entry
  removed from both. Scan-detected renewal dates preserved via a "From receipt"
  chip.
- **Needs Attention** — subscriptions now appear only within **7 days**
  (warranties unchanged at 30).
- **Home sections reordered** — Subscriptions → Warranties → Receipts.
- **OCR merchant/category fixed** (§13).
- **Receipt image viewer** — new `ImageViewer.tsx`, pinch/double-tap/pan/
  swipe-to-dismiss, built on RN core `Animated` + `PanResponder` (no new deps).
- **Share sends the real image** — `expo-sharing` + `localCopyForSharing()`.
  RN's core `Share` drops `url` on Android, which is why only text was sent.
- **Account screen** (`app/account.tsx`) — display name (persists), email change
  (official Supabase flow), password change.
- **Profile** — Categories and Backup rows removed; Account Information now opens
  a real screen instead of an empty alert.
- **Sign Out fixed** — local teardown was gated behind an awaited network call.
- **Delete Account fixed** — the destructive button had **no `onPress` at all**.
- **Support email** → `appsupport49@gmail.com`; Gmail preferred on Android via an
  `intent://` URI pinned to `com.google.android.gm`.
- **Restore Purchases fixed** (§10).
- **Subscription renewal window** — expired subscriptions show a Renew button for
  exactly 48h with a live countdown; renewal keeps all metadata and re-anchors
  the cycle to **today**. 14 new tests.
- **Apple button hidden** behind one flag (§9).

---

## 17. Known bugs and hazards

| Issue | Severity | Notes |
|---|---|---|
| ~~Android dev build crashes on launch~~ | ✅ Fixed & verified | §14 — trace captured, `ffb023a`, relaunched OK |
| ~~EAS Android build fails~~ (Kotlin, AdMob module) | ✅ Fixed | The failing module is gone; EAS `47f9d9c9` finished successfully |
| Google OAuth cannot complete in Expo Go | 🟠 High | §8 — needs a dev build |
| Email verification cannot complete in Expo Go | 🟠 High | Same root cause as §8 |
| `profiles.locale` CHECK allows only `('en','ar')` | 🟠 High | App ships 5 locales. Switching to es/fr/de raises 23514 and **fails silently** (`void`-ed update). Fix written in `migrations/0004_profile_prefs.sql` — **not applied** |
| `delete-account` not deployed | 🟠 High | Delete Account erases vault data but the **login still exists**. Reported as `data-only`, never as success |
| Edge Function OCR prompt not deployed | 🟡 Medium | §13 |
| Settings notification toggles not persisted | 🟡 Medium | Columns exist in `0004` — not applied |
| Nested component declarations in `profile.tsx` | 🟡 Medium | `Divider`, `LinkRow`, `Row`, `Section` are declared inside `Profile` (lines ~236-299). Latent — becomes a real focus-loss bug the moment a `TextInput` is added. This exact pattern caused a keyboard-dismiss bug in `account.tsx`, since fixed |
| `sign-in.tsx` collapses all OAuth errors | 🟡 Medium | Every failure shows `providerUnavailable`, and `void oauth()` swallows throws — makes OAuth undiagnosable |
| Stray `public.تطبيق` table in the live DB | 🟢 Low | Not in any migration. RLS on, inserts rejected — clutter, not a hole. Pollutes generated types |
| Progress bar uses `duration_months * 30` | 🟢 Low | Affects bar fill only, never the day count |
| `eslint` has no config | 🟢 Low | `npm run lint` has never worked |
| OneDrive sync races | 🟢 Low | Files can change mid-edit |

**Fixed, recorded so they are not reintroduced:** Arabic plural fallback
(a *translation* bug that presented as a date bug); `setMonth` month overflow;
UTC/local drift; react-query typed as `any` on TS 5.3; missing `/auth-callback`
route; auth gate unmounting the callback screen; cycle change wiping a typed
renewal date; `functions.invoke` having no `signal`.

---

## 18. Testing

**`npm test` → 76 pass / 0 fail / 14 suites.** Node's built-in runner with native
TS stripping — no Jest, no ts-node. Tests must avoid `@/` aliases and import with
explicit `.ts` extensions.

| File | Covers |
|---|---|
| `src/lib/dateMath.test.ts` | month terms, custom durations, leap years, end-of-month clamping, billing cycles, DST, invalid input |
| `src/i18n/plurals.test.ts` | Arabic six-form plurals across five locales |
| `src/lib/subscriptionRenewal.test.ts` | **new** — 48h window boundaries, month/leap-day rollover, grace formatting |

| Script | Status |
|---|---|
| `npm run db:check` | ✅ 10/10 |
| `npm run fn:check` | ✅ 4/4 |
| `npm run db:smoke -- --yes` | ⛔ blocked while email confirmation is on |

**No coverage:** React components, navigation, RTL rendering.

---

## 19. Localization

Five locales: **en, ar, es, fr, de**. `compatibilityJSON: 'v3'` — **required**.

**Arabic needs all six CLDR plural forms** (`_0`…`_5`). A missing form makes
i18next fall back to the base key — this **shipped a real bug** once. New keys
added this session (`subscription.renewDays`, `renewHours`) ship all six.

**RTL rule: logical properties only** (`paddingStart`, `marginEnd`, `start`/`end`).
`useDirection()` covers icon mirroring and transforms.

Long-form prose lives in `src/content/support.ts`, **en + ar only**.

---

## 20. Next steps, in order

~~1. Capture the logcat trace.~~ Not possible here — no Android SDK, no `adb`.
   Still the fallback if step 1 below fails.
~~2. Remove `react-native-google-mobile-ads`.~~ **Done** — `ffb023a`.
~~3. `git add -A && git commit`.~~ **Done** — `62a0b80`.

~~4. Rebuild the dev client and verify the app launches.~~ **Done** — EAS
   `47f9d9c9`, installed and launched, JS runs. §14.

1. **Set the Supabase env vars on EAS.** `.env` is local-only, so cloud builds
   have no `EXPO_PUBLIC_SUPABASE_URL` / `_ANON_KEY` baked in — EAS reported *"No
   environment variables … found for the development environment"*. The build
   launches fine, but any standalone (non-Metro) use of it talks to nothing.
   `eas env:create` or the project's Environment Variables page.
2. **Verify Google OAuth in the dev build** — §8 predicts it works there, since
   `vaultly://auth-callback` is honoured. Confirm in Supabase → URL Configuration
   that Site URL and Redirect URLs are as expected.
3. **Apply `migrations/0004_profile_prefs.sql`** in the SQL Editor — fixes the
   locale CHECK and adds the notification-preference columns. Then
   `npm run db:types` and delete `PendingProfileColumns` from
   `src/lib/database.types.ts` plus the `as never` cast in `services/profile.ts`.
   *Independent of the build — can be done right now.*
4. **Deploy the Edge Functions:** `analyze-receipt` (new OCR prompt) and
   `delete-account`. *Also independent of the build.*
5. **Wire the Settings notification toggles** to the new columns.
6. **Fix the nested components in `profile.tsx`** before anyone adds an input there.
7. Turn `mailer_autoconfirm` off → `npm run db:smoke -- --yes` → turn it back on.
   Still the only way to exercise authenticated paths.
8. Replace `assets/notification-icon.png`; fill `LEGAL_ENTITY` in
   `src/content/support.ts`; legal review of Privacy + Terms.
9. **Add a git remote.** The repo has no remote, so "committed" still means one
   machine. This is the only backup gap left.
10. Monetization: RevenueCat products/keys/webhook, AdMob IDs (which means
    re-adding the package — §11), deploy `grant-bonus-slot`.

---

## 21. Things that will waste your time if you don't know them

- **Verification method matters.** `select(…, {head:true})` sends HTTP HEAD and
  returns no body, so a *missing* table looks identical to an empty one. Listing
  storage buckets with the anon key returns `[]` either way. Both produced
  confidently wrong answers here.
- **Supabase does not validate `redirect_to` at `/authorize`** — it echoes
  anything, including hosts that are certainly not allow-listed. Validation
  happens at `/callback`, where a rejected value **silently** falls back to Site
  URL. To test allow-list membership, put a unique marker in the query string and
  see whether it survives.
- **Fast Refresh can serve stale modules.** Adding a module-scope binding and
  hot-reloading produced `ReferenceError: Property 'X' doesn't exist` from
  correct code. After structural changes, **fully close the app and re-scan**.
- **The two nested project folders** (§2).
- When something numeric looks wrong in Arabic, **check the plural forms before
  the arithmetic**.
