const fs = require('fs');
const path = require('path');

const { withStringsXml, AndroidConfig } = require('expo/config-plugins');

/**
 * Gives the Android default locale an entry for every key in `expo.locales`.
 *
 * Why this exists
 * ---------------
 * `locales` in app.config.ts is a **top-level** key — the Expo schema has no
 * `ios.locales` / `android.locales` — so the iOS Info.plist keys in
 * `src/i18n/native/*.json` (CFBundleDisplayName, NSCameraUsageDescription,
 * NSPhotoLibraryUsageDescription) are written into Android
 * `values-b+<locale>/strings.xml` as well as the iOS bundle.
 *
 * Android never reads them: the app label comes from `app_name`, and the camera
 * and photo permission rationales come from the expo-camera / expo-image-picker
 * plugin options already set in app.config.ts. But because those keys are
 * *translated* with no entry in the default locale, `:app:lintVitalRelease`
 * fails the release build with 15 `ExtraTranslation` errors — 3 keys × 5
 * locales. `lintVital` runs only on release targets, which is exactly why
 * development builds succeeded and the production AAB did not.
 *
 * The fix is to satisfy the rule rather than switch it off: if a string is
 * translated, it gets a default. Disabling `ExtraTranslation` (or setting
 * `checkReleaseBuilds false`) would also unblock the build, but would silence a
 * real check for every future string as well.
 *
 * The values are read from the English locale file, so adding a key or a locale
 * needs no change here.
 */
const withAndroidDefaultLocaleStrings = (config) =>
  withStringsXml(config, (cfg) => {
    const source = path.join(cfg.modRequest.projectRoot, 'src/i18n/native/en.json');

    let entries;
    try {
      entries = JSON.parse(fs.readFileSync(source, 'utf8'));
    } catch (e) {
      // Fail loudly at prebuild rather than silently shipping a build that dies
      // 10 minutes later inside Gradle lint.
      throw new Error(
        `withAndroidDefaultLocaleStrings: could not read ${source} — ${e.message}`,
      );
    }

    for (const [name, value] of Object.entries(entries)) {
      if (typeof value !== 'string') continue;
      cfg.modResults = AndroidConfig.Strings.setStringItem(
        // Not translatable="false": these keys DO have translations in
        // values-b+<locale>, and marking them untranslatable would trade
        // ExtraTranslation for "Cannot translate a string marked translatable=false".
        [{ $: { name }, _: value }],
        cfg.modResults,
      );
    }

    return cfg;
  });

module.exports = withAndroidDefaultLocaleStrings;
