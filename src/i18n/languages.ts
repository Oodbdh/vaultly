import type { AppLocale } from '@/constants/config';

export type LanguageMeta = {
  code: AppLocale;
  /** Shown in the picker — always in the language's own script. */
  nativeName: string;
  /** Secondary line, in English, so users on the wrong language can find theirs. */
  englishName: string;
  rtl: boolean;
  /** Intl tag used for number, currency and date formatting. */
  intlTag: string;
};

/**
 * Adding a language means: one entry here, one JSON file in ./locales, and the
 * same code in SUPPORTED_LOCALES. Every UI surface reads from this list, so no
 * screen needs editing.
 */
export const LANGUAGES: LanguageMeta[] = [
  { code: 'en', nativeName: 'English', englishName: 'English', rtl: false, intlTag: 'en-US' },
  { code: 'ar', nativeName: 'العربية', englishName: 'Arabic', rtl: true, intlTag: 'ar-SA' },
  { code: 'es', nativeName: 'Español', englishName: 'Spanish', rtl: false, intlTag: 'es-ES' },
  { code: 'fr', nativeName: 'Français', englishName: 'French', rtl: false, intlTag: 'fr-FR' },
  { code: 'de', nativeName: 'Deutsch', englishName: 'German', rtl: false, intlTag: 'de-DE' },
];

export function languageMeta(code: string): LanguageMeta {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0]!;
}

/** Short label for the header pill: EN · ع · ES · FR · DE */
export function shortLabel(code: string): string {
  return code === 'ar' ? 'ع' : code.toUpperCase();
}
