import { I18nManager, type TextStyle, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { isRTL } from './index';
import { languageMeta } from './languages';

/**
 * Direction-aware helpers.
 *
 * Rule of thumb for the whole codebase: use logical properties
 * (`paddingStart`, `marginEnd`, `start`, `end`) instead of left/right, and
 * `textAlign: 'left'` — RN flips both automatically when RTL is on. These
 * helpers cover the cases RN does NOT flip: icon glyph direction, transforms,
 * absolute positioning built from raw numbers, and number/date formatting.
 */
export function useDirection() {
  const { i18n } = useTranslation();
  const rtl = isRTL(i18n.language) || I18nManager.isRTL;
  return {
    rtl,
    dir: (rtl ? 'rtl' : 'ltr') as 'rtl' | 'ltr',
    /** Multiply x-offsets and translateX by this. */
    sign: rtl ? -1 : 1,
    /**
     * Mirror a directional icon (chevron, arrow, back). Typed as the bare
     * transform rather than ViewStyle: RN 0.81 stopped letting ViewStyle flow
     * into a TextStyle slot, and these land on icons (Text) as well as Views.
     */
    flipIcon: (rtl ? { transform: [{ scaleX: -1 }] } : undefined) as
      | { transform: { scaleX: number }[] }
      | undefined,
    /** Row that visually reverses with direction (RN already flips `row`). */
    rowReverse: (rtl ? 'row-reverse' : 'row') as ViewStyle['flexDirection'],
    textAlign: (rtl ? 'right' : 'left') as TextStyle['textAlign'],
    locale: i18n.language,
  };
}

export function formatCurrency(amount: number, locale: string, currency = 'SAR'): string {
  return new Intl.NumberFormat(languageMeta(locale).intlTag, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date, locale: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(languageMeta(locale).intlTag, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/** @deprecated use calendarDaysUntil from i18n/relativeTime — it counts calendar days. */
export { calendarDaysUntil as daysUntil } from './relativeTime';
