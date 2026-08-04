import type { ExpoConfig } from 'expo/config';

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
    demoShowcase: process.env.EXPO_PUBLIC_DEMO_SHOWCASE === 'true',
    eas: {
  projectId:
    process.env.EAS_PROJECT_ID ??
    'c8899277-7bd4-469f-84c8-9b5e43a01208',
},
  },
  ios: {
  bundleIdentifier: 'com.adialfaifi.vaultly',
  supportsTablet: true,

  infoPlist: {
    NSCameraUsageDescription: 'Vaultly uses the camera to scan your receipts.',
    NSPhotoLibraryUsageDescription: 'Vaultly needs access to attach receipt photos.',
    CFBundleAllowMixedLocalizations: true,
  },
},
  android: {
  package: 'com.adialfaifi.vaultly',
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
    // No AdMob plugin, and no `react-native-google-mobile-ads` dependency: with
    // no app IDs configured the native SDK was autolinked with a blank
    // APPLICATION_ID and crashed the app during Application.onCreate(), before
    // React Native started. See HANDOVER.md §14. To restore rewarded ads,
    // reinstall the package, set EXPO_PUBLIC_ADMOB_{IOS,ANDROID}_APP_ID, and add
    // the plugin back here together with `config.googleMobileAdsAppId` on both
    // platforms. `services/ads.ts` needs no change — it degrades on its own.
    [
      'expo-build-properties',
      { android: { extraMavenRepos: [] } },
    ],
    // `locales` above is top-level, so its iOS Info.plist keys also land in
    // Android values-b+<locale>/strings.xml. Without a default-locale entry
    // those are ExtraTranslation errors and :app:lintVitalRelease fails the
    // release build — release only, which is why dev builds passed. See the
    // plugin for the full explanation.
    './plugins/withAndroidDefaultLocaleStrings',
  ],
  experiments: { typedRoutes: true },
};

export default config;
