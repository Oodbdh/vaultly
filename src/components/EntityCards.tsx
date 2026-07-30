import { Image, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { PressableCard } from './PressableCard';
import { colors, radius, spacing, typeScale } from '@/theme';
import { URGENCY } from '@/theme/urgency';
import { useDirection, formatCurrency, formatDate } from '@/i18n/rtl';
import { calendarDaysUntil, countdownLabel, countdownTone } from '@/i18n/relativeTime';
import type { BillingPeriod } from '@/lib/database.types';

/** Days in one billing cycle — the denominator for the progress bar. */
const CYCLE_DAYS: Record<BillingPeriod, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 91,
  yearly: 365,
};

/** Merchant, date, amount, thumbnail. No countdown — invoices don't expire. */
export function InvoiceCard({
  merchant,
  purchaseDate,
  amount,
  currency = 'SAR',
  thumbnailUri,
  onPress,
}: {
  merchant: string;
  purchaseDate: string | null;
  amount: number | null;
  currency?: string;
  thumbnailUri?: string | null;
  onPress?: () => void;
}) {
  const { locale, textAlign } = useDirection();
  const type = typeScale(locale);

  return (
    <PressableCard onPress={onPress} accessibilityLabel={merchant}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: radius.md,
            backgroundColor: '#F1F0EC',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {thumbnailUri ? (
            <Image source={{ uri: thumbnailUri }} style={{ width: '100%', height: '100%' }} />
          ) : (
            <Ionicons name="receipt-outline" size={21} color={colors.textMuted} />
          )}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={[type.body, { color: colors.text, fontWeight: '600', textAlign }]}
            numberOfLines={1}
          >
            {merchant}
          </Text>
          <Text style={[type.caption, { color: colors.textMuted, textAlign }]}>
            {purchaseDate ? formatDate(purchaseDate, locale) : '—'}
          </Text>
        </View>
        {amount != null ? (
          <Text style={[type.body, { color: colors.text, fontWeight: '700' }]}>
            {formatCurrency(amount, locale, currency)}
          </Text>
        ) : null}
      </View>
    </PressableCard>
  );
}

/**
 * Warranty card: the countdown badge is the loudest element, with a progress
 * bar showing how much of the term is left.
 */
export function WarrantyCard({
  productName,
  merchant,
  purchaseDate,
  expiresOn,
  durationMonths = 12,
  onPress,
}: {
  productName: string;
  merchant?: string | null;
  purchaseDate?: string | null;
  expiresOn: string;
  durationMonths?: number | null;
  onPress?: () => void;
}) {
  const { t } = useTranslation();
  const { locale, textAlign } = useDirection();
  const type = typeScale(locale);

  const days = calendarDaysUntil(expiresOn);
  const tone = countdownTone(days);
  const u = URGENCY[tone];
  const total = (durationMonths ?? 12) * 30;
  const pct = days < 0 ? 0 : Math.max(0.02, Math.min(1, days / Math.max(total, 1)));

  return (
    <PressableCard onPress={onPress} accessibilityLabel={productName} style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={[type.body, { color: colors.text, fontWeight: '700', textAlign }]}
            numberOfLines={1}
          >
            {productName}
          </Text>
          {merchant ? (
            <Text style={[type.caption, { color: colors.textMuted, textAlign }]} numberOfLines={1}>
              {merchant}
            </Text>
          ) : null}
        </View>

        <View
          style={{
            backgroundColor: u.bg,
            borderRadius: radius.md,
            paddingVertical: 6,
            paddingHorizontal: spacing.md,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: u.fg, fontWeight: '800', fontSize: locale === 'ar' ? 15 : 14 }}>
            {countdownLabel(t, days, 'warranty')}
          </Text>
        </View>
      </View>

      <View
        style={{ height: 6, borderRadius: radius.pill, backgroundColor: '#EFEEEA', overflow: 'hidden' }}
      >
        <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: u.fg }} />
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.lg }}>
        <Meta label={t('item.purchaseDate')} value={purchaseDate ? formatDate(purchaseDate, locale) : '—'} />
        <Meta label={t('item.warrantyExpiry')} value={formatDate(expiresOn, locale)} />
      </View>
    </PressableCard>
  );
}

/**
 * Subscription card — same anatomy as WarrantyCard so the two read as one
 * family: identity row, countdown badge, progress through the cycle, meta row.
 * Price is deliberately omitted; the renewal date is the signal.
 */
export function SubscriptionCard({
  name,
  period,
  nextRenewal,
  logoUri,
  onPress,
}: {
  name: string;
  period: BillingPeriod;
  nextRenewal: string;
  logoUri?: string | null;
  onPress?: () => void;
}) {
  const { t } = useTranslation();
  const { locale, textAlign } = useDirection();
  const type = typeScale(locale);

  const days = calendarDaysUntil(nextRenewal);
  const u = URGENCY[countdownTone(days)];
  const cycleDays = CYCLE_DAYS[period];
  const pct = days < 0 ? 0 : Math.max(0.02, Math.min(1, days / cycleDays));
  const cycleLabel = t(
    period === 'weekly'
      ? 'form.weekly'
      : period === 'quarterly'
        ? 'form.quarterly'
        : period === 'yearly'
          ? 'form.yearly'
          : 'form.monthly',
  );

  return (
    <PressableCard onPress={onPress} accessibilityLabel={name} style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.md,
            backgroundColor: '#F1F0EC',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {logoUri ? (
            <Image source={{ uri: logoUri }} style={{ width: '100%', height: '100%' }} />
          ) : (
            <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 18 }}>
              {name.trim().charAt(0).toUpperCase()}
            </Text>
          )}
        </View>

        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={[type.body, { color: colors.text, fontWeight: '700', textAlign }]}
            numberOfLines={1}
          >
            {name}
          </Text>
          <Text style={[type.caption, { color: colors.textMuted, textAlign }]} numberOfLines={1}>
            {cycleLabel}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: u.bg,
            borderRadius: radius.md,
            paddingVertical: 6,
            paddingHorizontal: spacing.md,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: u.fg, fontWeight: '800', fontSize: locale === 'ar' ? 15 : 14 }}>
            {countdownLabel(t, days, 'subscription')}
          </Text>
        </View>
      </View>

      <View
        style={{ height: 6, borderRadius: radius.pill, backgroundColor: '#EFEEEA', overflow: 'hidden' }}
      >
        <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: u.fg }} />
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.lg }}>
        <Meta label={t('subscription.billingCycle')} value={cycleLabel} />
        <Meta label={t('subscription.nextBilling')} value={formatDate(nextRenewal, locale)} />
      </View>
    </PressableCard>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  const { locale, textAlign } = useDirection();
  const type = typeScale(locale);
  return (
    <View style={{ gap: 1 }}>
      <Text style={[type.caption, { color: colors.textMuted, fontSize: 11, textAlign }]}>
        {label}
      </Text>
      <Text style={[type.caption, { color: colors.text, fontWeight: '600', textAlign }]}>
        {value}
      </Text>
    </View>
  );
}
