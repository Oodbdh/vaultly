import Constants from 'expo-constants';

type Extra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  geminiApiKey?: string;
  geminiModel?: string;
  // No openaiApiKey by design — OpenAI is reached only through the
  // `analyze-receipt` Edge Function, which holds the key as a server secret.
  aiProvider?: string;
  supportEmail?: string;
  revenueCatIosKey?: string;
  revenueCatAndroidKey?: string;
  admobRewardedIos?: string;
  admobRewardedAndroid?: string;
  useMockData?: boolean;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const env = {
  supabaseUrl: extra.supabaseUrl ?? '',
  supabaseAnonKey: extra.supabaseAnonKey ?? '',
  geminiApiKey: extra.geminiApiKey ?? '',
  geminiModel: extra.geminiModel ?? 'gemini-2.0-flash',
  revenueCatIosKey: extra.revenueCatIosKey ?? '',
  revenueCatAndroidKey: extra.revenueCatAndroidKey ?? '',
  admobRewardedIos: extra.admobRewardedIos ?? '',
  admobRewardedAndroid: extra.admobRewardedAndroid ?? '',
};

/**
 * Backend switch.
 *
 * With no Supabase credentials the app runs against the in-memory backend in
 * `src/mocks` — every screen, list and form works, nothing leaves the device.
 * Fill `EXPO_PUBLIC_SUPABASE_URL` / `_ANON_KEY` in `.env` and the same call
 * sites hit the real database instead; no screen or hook changes.
 *
 * `EXPO_PUBLIC_USE_MOCK_DATA=true` forces mock mode even when keys are present,
 * which is how you demo the UI against a configured project.
 */
export const USE_MOCK_DATA =
  extra.useMockData === true || !env.supabaseUrl || !env.supabaseAnonKey;

/**
 * Where receipt OCR runs.
 *
 *   'edge'   — the `analyze-receipt` Supabase Edge Function (default). The
 *              OpenAI key is a Supabase secret; the app never holds it.
 *   'gemini' — direct client call with a bundled key. Legacy, opt-in only via
 *              EXPO_PUBLIC_AI_PROVIDER=gemini.
 *
 * 'openai' is accepted as an alias for 'edge': OpenAI is still the model, it
 * just runs server-side now.
 */
export type AIProvider = 'edge' | 'gemini';

export const AI_PROVIDER: AIProvider = extra.aiProvider === 'gemini' ? 'gemini' : 'edge';

/**
 * Can the selected provider actually run? The Edge Function needs a configured
 * Supabase project (and a signed-in user at call time); Gemini needs its key.
 * Otherwise OCR falls back to a canned extraction so scanning still works.
 */
const ocrReady =
  AI_PROVIDER === 'gemini' ? !!env.geminiApiKey : !!env.supabaseUrl && !!env.supabaseAnonKey;

export const USE_MOCK_OCR = USE_MOCK_DATA || !ocrReady;

if (__DEV__ && USE_MOCK_DATA) {
  console.log('[vaultly] Mock backend active — see src/mocks. Add Supabase keys to .env to go live.');
}

/** Monetization rules — single source of truth on the client. */
export const MONETIZATION = {
  entitlementId: 'premium_access',
  /** RevenueCat offering that holds the 10 SAR/month package. */
  defaultOfferingId: 'default',
  monthlyPriceFallback: 'SAR 10',
  freeItemLimit: 4,
  /** Each completed rewarded ad grants one slot… */
  bonusSlotsPerAd: 1,
  /** …for this long… */
  bonusSlotTtlHours: 24,
  /** …and at most this many can be active at once. */
  maxConcurrentBonusSlots: 2,
} as const;

/**
 * Where Help & Support sends mail. Overridable per build without touching code;
 * the default keeps every support action working before a real inbox exists.
 */
export const SUPPORT_EMAIL = extra.supportEmail || 'support@vaultly.app';

export const STORAGE_BUCKET = 'receipts';
export const SUPPORTED_LOCALES = ['en', 'ar', 'es', 'fr', 'de'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
