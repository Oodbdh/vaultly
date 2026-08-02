/**
 * Rewarded ads (AdMob). Premium users never reach this module — every entry
 * point is gated on `usePremium()` first, satisfying the "completely ad-free"
 * rule in one place.
 *
 * `react-native-google-mobile-ads` is a native module, so it does not exist in
 * Expo Go. It is therefore required lazily rather than imported at module
 * scope: importing it up top crashes the bundle before the first screen
 * renders. When it is missing, mock mode simulates the reward so the
 * rewarded-slot flow stays testable; otherwise ads report unavailable.
 *
 * The package is currently **not installed** — with no AdMob app ID configured
 * it autolinked the native SDK with a blank APPLICATION_ID, which threw during
 * Application.onCreate() and killed the dev build before any JS ran
 * (HANDOVER.md §14). Everything below is therefore dormant, not dead: the lazy
 * require() picks the module up again the moment it is reinstalled. Because
 * `typeof import(...)` cannot resolve an uninstalled package, the surface this
 * file actually uses is described structurally instead. Swap `AdsModule` back
 * to `typeof import('react-native-google-mobile-ads')` when it returns.
 */
import { Platform } from 'react-native';

import { env, USE_MOCK_DATA } from '@/constants/config';

/**
 * An event name that carries its listener's payload type. The real library's
 * values are opaque strings; branding them here is what lets one
 * `addAdEventListener` signature type each listener correctly.
 */
type AdEvent<TPayload> = string & { readonly __payload?: TPayload };

type RewardedAdInstance = {
  addAdEventListener<TPayload>(
    event: AdEvent<TPayload>,
    listener: (payload: TPayload) => void,
  ): () => void;
  load(): void;
  show(): void;
};

type AdsModule = {
  default: () => {
    setRequestConfiguration(config: {
      maxAdContentRating: string;
      tagForChildDirectedTreatment: boolean;
      tagForUnderAgeOfConsent: boolean;
    }): Promise<void>;
    initialize(): Promise<unknown>;
  };
  MaxAdContentRating: { PG: string };
  TestIds: { REWARDED: string };
  AdEventType: {
    CLOSED: AdEvent<void>;
    ERROR: AdEvent<{ message: string }>;
  };
  RewardedAdEventType: {
    LOADED: AdEvent<void>;
    EARNED_REWARD: AdEvent<{ amount: number; type: string }>;
  };
  RewardedAd: {
    createForAdRequest(
      unitId: string,
      request: { requestNonPersonalizedAdsOnly: boolean },
    ): RewardedAdInstance;
  };
};

let cached: AdsModule | null | undefined;

/** null once we know the native module isn't present in this runtime. */
function adsModule(): AdsModule | null {
  if (cached !== undefined) return cached;
  try {
    cached = require('react-native-google-mobile-ads') as AdsModule;
  } catch {
    if (__DEV__) console.log('[vaultly] AdMob not installed — rewarded ads simulated.');
    cached = null;
  }
  return cached;
}

export function adsAvailable(): boolean {
  return adsModule() !== null;
}

let initialised = false;

export async function initAds(): Promise<void> {
  const ads = adsModule();
  if (!ads || initialised) return;
  const mobileAds = ads.default;
  await mobileAds().setRequestConfiguration({
    maxAdContentRating: ads.MaxAdContentRating.PG,
    tagForChildDirectedTreatment: false,
    tagForUnderAgeOfConsent: false,
  });
  await mobileAds().initialize();
  initialised = true;
}

function rewardedUnitId(ads: AdsModule): string {
  if (__DEV__) return ads.TestIds.REWARDED;
  return (
    Platform.select({ ios: env.admobRewardedIos, android: env.admobRewardedAndroid }) ??
    ads.TestIds.REWARDED
  );
}

export type RewardOutcome =
  | { status: 'earned'; amount: number; type: string }
  | { status: 'dismissed' }
  | { status: 'unavailable'; message?: string };

/**
 * Loads and shows one rewarded ad, resolving only once the SDK confirms the
 * reward (or the user bailed). Never resolves 'earned' without the SDK event —
 * the extra slot is then minted server-side.
 */
export function showRewardedAd(): Promise<RewardOutcome> {
  const ads = adsModule();

  if (!ads) {
    // Stand-in so "watch an ad for +1 slot" can be walked end to end without a
    // dev client. Unreachable once the native module is present.
    if (!USE_MOCK_DATA) {
      return Promise.resolve({ status: 'unavailable', message: 'ads module unavailable' });
    }
    return new Promise((resolve) =>
      setTimeout(() => resolve({ status: 'earned', amount: 1, type: 'slot' }), 1200),
    );
  }

  const { AdEventType, RewardedAd, RewardedAdEventType } = ads;

  return new Promise((resolve) => {
    let settled = false;
    const done = (o: RewardOutcome) => {
      if (settled) return;
      settled = true;
      unsubscribe.forEach((fn) => fn());
      resolve(o);
    };

    const ad = RewardedAd.createForAdRequest(rewardedUnitId(ads), {
      requestNonPersonalizedAdsOnly: true,
    });
    let earned: { amount: number; type: string } | null = null;

    const unsubscribe = [
      ad.addAdEventListener(RewardedAdEventType.LOADED, () => ad.show()),
      ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, (reward) => {
        earned = { amount: reward.amount, type: reward.type };
      }),
      ad.addAdEventListener(AdEventType.CLOSED, () =>
        done(earned ? { status: 'earned', ...earned } : { status: 'dismissed' }),
      ),
      ad.addAdEventListener(AdEventType.ERROR, (error) =>
        done({ status: 'unavailable', message: error.message }),
      ),
    ];

    ad.load();
    setTimeout(() => done({ status: 'unavailable', message: 'load timeout' }), 20_000);
  });
}
