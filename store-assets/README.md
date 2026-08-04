# Store assets

Google Play listing assets, and the tooling that regenerates them.

```
store-assets/
  google-play/screenshots/   the deliverable — Play-ready PNGs
  lib/shot.ps1               capture + post-processing helpers
  .raw/                      untouched device captures (gitignored)
```

## How the screenshots are produced

They are captured from the **real app running on a real device** — not mocked
up, not redesigned. `adb exec-out screencap` pulls each frame, and the app is
driven between screens with `adb shell input`.

The data on screen comes from the app's own in-memory backend, switched to a
listing-specific seed. Nothing touches the live Supabase project.

### Demo data

`EXPO_PUBLIC_DEMO_SHOWCASE=true` selects `SHOWCASE_SEED` in
[`src/mocks/seed.ts`](../src/mocks/seed.ts) instead of the usual design seed,
and runs the account as premium.

Premium is not vanity. The free tier caps at 4 items, so a screenshot of a full
vault sitting beside "3 of 4 items used" reads as a bug — and premium also drops
the rewarded-ad card, which should not appear in a store listing at all.

The seed is deliberately kept **separate** from the existing `SEED` rather than
replacing it: that one exists to put every countdown tier on screen at once for
design review, and tuning it for screenshots would quietly destroy that.

17 items across the merchants in the brief — Apple, IKEA, Carrefour, Zara,
Starbucks, Nike, Noon, Samsung, Sony, LG, Dyson, Jarir, Extra, Netflix, Spotify,
Adobe, Amazon Prime. Warranty and renewal dates are spread so the urgency
colours vary down the screen instead of banding, and every
`purchasedDaysAgo + expiresInDays` matches its `durationMonths`, so each detail
screen's progress bar agrees with its own day count.

Amounts are SAR throughout. Mixing currencies inside one user's vault would look
like a bug in a screenshot rather than a feature.

### Why the images are 1080×1920 and not the device's native size

The panel is 1080×2400 (20:9). Google Play wants phone screenshots at 16:9 or
9:16, with the long side no more than twice the short side. 2400 ÷ 1080 = 2.22,
so a raw capture fails on both counts and is rejected at upload.

`Capture-Shot` scales each frame to fit inside 1080×1920 and centres it on a
canvas filled with **the screenshot's own corner pixel**, so the padding is
invisible on the app's near-white screens and equally invisible on the black
camera screen. Nothing is cropped and nothing is stretched — the alternative,
cropping 480px to force 9:16, would eat real UI.

## Regenerating

1. Connect the phone by USB with debugging on, and accept the authorisation
   prompt. Tick *Always allow from this computer* — otherwise it must be
   re-accepted every time the adb server restarts.

2. Start Metro in showcase mode:

```bash
EXPO_PUBLIC_USE_MOCK_DATA=true EXPO_PUBLIC_DEMO_SHOWCASE=true npx expo start
```

3. Point the device at Metro over USB and launch the dev client:

```bash
adb reverse tcp:8081 tcp:8081
```

   `adb reverse` is used rather than the LAN address on purpose — two VMware
   adapters enumerate ahead of Wi-Fi on this machine and Expo advertises an
   unreachable IP without a pinned hostname. Over USB the problem cannot arise.

4. Dot-source the helpers and capture:

```bash
. store-assets/lib/shot.ps1
```

   `Enter-CleanStatusBar` fixes the clock at 09:30, fills the battery, hides
   notification icons; `Exit-CleanStatusBar` restores the device afterwards. It
   is best-effort — some OEM skins ignore SystemUI demo mode.

## Uploading

Play requires between 2 and 8 phone screenshots. Order matters — the first two
are what most users actually see. Lead with the dashboard and a detail screen.
