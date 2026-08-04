import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import { I18nManager } from 'react-native';

import { SUPPORTED_LOCALES, type AppLocale } from '@/constants/config';
import { LANGUAGES, languageMeta } from './languages';
import en from './locales/en.json';
import ar from './locales/ar.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';

export const LOCALE_STORAGE_KEY = 'vaultly.locale';

/** Bundled at build time — RN's bundler has no dynamic require by path. */
export const resources = {
  en: { translation: en },
  ar: { translation: ar },
  es: { translation: es },
  fr: { translation: fr },
  de: { translation: de },
} as const;

function isSupported(tag: string | undefined): tag is AppLocale {
  return !!tag && (SUPPORTED_LOCALES as readonly string[]).includes(tag);
}

/** Device language, narrowed to something we ship. */
export function deviceLocale(): AppLocale {
  for (const loc of Localization.getLocales()) {
    if (isSupported(loc.languageCode ?? undefined)) return loc.languageCode as AppLocale;
  }
  return 'en';
}

/** ISO 4217 is three letters. Anything else is not a currency we can format. */
const ISO_4217 = /^[A-Z]{3}$/;

let cachedCurrency: string | null = null;

/**
 * The currency of the device's region — USD in the US, EUR in Germany, JPY in
 * Japan, and so on.
 *
 * This is only ever a **fallback**, used when a record carries no currency of
 * its own. A receipt's own currency is a fact about the purchase and always
 * wins: a euro invoice stays in euros no matter where the phone is.
 *
 * Note this is region, not language — a device set to English in Japan reports
 * JPY, which is the desired answer. `SAR` remains the last resort, since the
 * app's own pricing and jurisdiction are Saudi.
 *
 * Cached because the value cannot change without the OS restarting the app,
 * and it is read on every amount that renders.
 */
export function deviceCurrency(): string {
  if (cachedCurrency) return cachedCurrency;
  for (const loc of Localization.getLocales()) {
    const code = loc.currencyCode?.toUpperCase();
    if (code && ISO_4217.test(code)) {
      cachedCurrency = code;
      return code;
    }
  }
  cachedCurrency = 'SAR';
  return cachedCurrency;
}

/**
 * The currency to render an amount in: the record's own, else the device's.
 * Accepts `null` because that is what the database and the OCR extractor return
 * when the currency is genuinely unknown.
 */
export function resolveCurrency(currency?: string | null): string {
  const code = currency?.trim().toUpperCase();
  return code && ISO_4217.test(code) ? code : deviceCurrency();
}

export function isRTL(locale: string): boolean {
  return languageMeta(locale).rtl;
}

/**
 * Call once from the root layout, before rendering. Reads the stored override
 * (Settings → Language) and falls back to the device language.
 */
export async function initI18n(): Promise<AppLocale> {
  const stored = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
  const locale: AppLocale = isSupported(stored ?? undefined)
    ? (stored as AppLocale)
    : deviceLocale();

  await i18n.use(initReactI18next).init({
    resources,
    lng: locale,
    fallbackLng: 'en',
    supportedLngs: LANGUAGES.map((l) => l.code),
    compatibilityJSON: 'v3', // required for Arabic plural forms on RN
    interpolation: { escapeValue: false },
    returnNull: false,
  });

  applyDirection(locale);
  return locale;
}

/**
 * React Native decides RTL natively, so switching between an LTR and an RTL
 * language needs a reload. Switching between two LTR languages does not.
 */
export function applyDirection(locale: string): { requiresReload: boolean } {
  const rtl = isRTL(locale);
  const changed = I18nManager.isRTL !== rtl;
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
  return { requiresReload: changed };
}

export async function setLocale(locale: AppLocale): Promise<{ requiresReload: boolean }> {
  await AsyncStorage.setItem(LOCALE_STORAGE_KEY, locale);
  await i18n.changeLanguage(locale);
  return applyDirection(locale);
}

export default i18n;
