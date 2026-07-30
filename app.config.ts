import type { ExpoConfig } from 'expo/config';

const admobAndroidAppId = process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID;
const admobIosAppId = process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID;

/**
 * Vaultly — smart digital vault for receipts, warranties and subscriptions.
 * All secrets come from the environment (see .env.example); nothing is committed.
 */
const config: ExpoConfig = {
  name: 'Vaultly',
  slug: 'vaultly',
  scheme: 'vaultly',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  // Native only — RevenueCat and AdMob have no web implementation, and the
  // camera scanner assumes a device. Declaring this keeps `expo export` from
  // demanding react-native-web.
  platforms: ['ios', 'android'],
  // RTL must be enabled at the native level for Arabic to mirror layouts.
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    geminiApiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY,
    geminiModel: process.env.EXPO_PUBLIC_GEMINI_MODEL ?? 'gemini-2.0-flash',
    // Deliberately no OpenAI key here: it would be compiled into the bundle.
    // OpenAI is reached only through the analyze-receipt Edge Function, which
    // reads the key from Supabase secrets.
    aiProvider: process.env.EXPO_PUBLIC_AI_PROVIDER,
    supportEmail: process.env.EXPO_PUBLIC_SUPPORT_EMAIL,
    revenueCatIosKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
    revenueCatAndroidKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
    admobRewardedIos: process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS,
    admobRewardedAndroid: process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID,
    // Forces the in-memory backend even when Supabase keys are present.
    useMockData: process.env.EXPO_PUBLIC_USE_MOCK_DATA === 'true',
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
  ios: {
    bundleIdentifier: 'com.vaultly.app',
    supportsTablet: true,
    infoPlist: {
      NSCameraUsageDescription: 'Vaultly uses the camera to scan your receipts.',
      NSPhotoLibraryUsageDescription: 'Vaultly needs access to attach receipt photos.',
      CFBundleAllowMixedLocalizations: true,
    },
  },
  android: {
    package: 'com.vaultly.app',
    permissions: ['CAMERA', 'POST_NOTIFICATIONS'],
  },
  locales: {
    en: './src/i18n/native/en.json',
    ar: './src/i18n/native/ar.json',
    es: './src/i18n/native/es.json',
    fr: './src/i18n/native/fr.json',
    de: './src/i18n/native/de.json',
  },
  plugins: [
    'expo-router',
    'expo-localization',
    'expo-secure-store',
    ['expo-image-picker', { photosPermission: 'Vaultly needs access to attach receipt photos.' }],
    ['expo-camera', { cameraPermission: 'Vaultly uses the camera to scan your receipts.' }],
    [
      'expo-notifications',
      { icon: './assets/notification-icon.png', color: '#1B2A4A' },
    ],
    // AdMob refuses to prebuild with blank app IDs, so it only joins the build
    // once both are configured. Until then the rewarded-ad path degrades on its
    // own (see services/ads.ts).
    ...(admobAndroidAppId && admobIosAppId
      ? ([
          [
            'react-native-google-mobile-ads',
            {
              androidAppId: admobAndroidAppId,
              iosAppId: admobIosAppId,
              userTrackingUsageDescription:
                'This identifier will be used to deliver personalised ads to you.',
            },
          ],
        ] as NonNullable<ExpoConfig['plugins']>)
      : []),
    [
      'expo-build-properties',
      { android: { extraMavenRepos: [] } },
    ],
  ],
  experiments: { typedRoutes: true },
};

export default config;
