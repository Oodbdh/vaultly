import type { TFunction } from 'i18next';
import type { BillingPeriod } from '@/lib/database.types';
import { daysUntil, isValidISODate, todayISO } from '@/lib/dateMath';

/**
 * Relative countdown labels for warranties and subscriptions.
 *
 * Two rules keep this correct across locales:
 *  1. Day maths is done on calendar days at local midnight, not on 24h blocks —
 *     otherwise "expires today" flickers depending on the time of day.
 *  2. All wording comes from translation keys with proper plural forms (Arabic
 *     needs six), so no language ends up with a hard-coded English pattern.
 */

export function calendarDaysUntil(date: string | Date): number {
  const iso =
    typeof date === 'string'
      ? date.slice(0, 10)
      : todayISO(date); // a Date is already in the local calendar
  if (!isValidISODate(iso)) return 0; // malformed row — show "expires today", not NaN
  return daysUntil(iso);
}

export type CountdownKind = 'warranty' | 'subscription';

/** e.g. "12 days left" · "Expires today" · "Expired 3 days ago" · "متبقٍ ١٢ يومًا" */
export function countdownLabel(t: TFunction, days: number, kind: CountdownKind = 'warranty'): string {
  if (kind === 'subscription') {
    if (days < 0) return t('relative.renewalOverdue', { count: Math.abs(days) });
    if (days === 0) return t('relative.renewsToday');
    if (days === 1) return t('relative.renewsTomorrow');
    return t('relative.renewsInDays', { count: days });
  }
  if (days < 0) {
    const ago = Math.abs(days);
    return ago === 1 ? t('relative.expiredYesterday') : t('relative.expiredAgo', { count: ago });
  }
  if (days === 0) return t('relative.expiresToday');
  if (days === 1) return t('relative.expiresTomorrow');
  return t('relative.daysLeft', { count: days });
}

export function countdownFromDate(
  t: TFunction,
  date: string | Date,
  kind: CountdownKind = 'warranty',
): string {
  return countdownLabel(t, calendarDaysUntil(date), kind);
}

/** Urgency tier, used for colour only — never for wording. */
export type CountdownTone = 'expired' | 'urgent' | 'soon' | 'ok';

export function countdownTone(days: number): CountdownTone {
  if (days < 0) return 'expired';
  if (days <= 7) return 'urgent';
  if (days <= 30) return 'soon';
  return 'ok';
}


const PERIOD_KEY: Record<BillingPeriod, string> = {
  weekly: 'subscription.perWeek',
  monthly: 'subscription.perMonth',
  quarterly: 'subscription.perQuarter',
  yearly: 'subscription.perYear',
};

/** "45 SAR/mo" — the price already formatted for the locale, plus a period suffix. */
export function pricePerPeriod(
  t: TFunction,
  formattedPrice: string,
  period: BillingPeriod,
): string {
  return t(PERIOD_KEY[period], { price: formattedPrice });
}

/**
 * "Renews in 15 days · 45 SAR/mo". Built through a translation key so each
 * language controls the separator and the order of the two halves — in Arabic the
 * bidi algorithm needs the price treated as its own run.
 */
export function renewalLine(
  t: TFunction,
  nextRenewal: string,
  formattedPrice: string,
  period: BillingPeriod,
): string {
  return t('subscription.renewalLine', {
    countdown: countdownFromDate(t, nextRenewal, 'subscription'),
    price: pricePerPeriod(t, formattedPrice, period),
  });
}
