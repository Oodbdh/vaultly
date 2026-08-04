import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing, typeScale } from '@/theme';
import { useDirection, formatCurrency, formatDate } from '@/i18n/rtl';
import {
  calendarDaysUntil,
  countdownLabel,
  countdownTone,
  pricePerPeriod,
} from '@/i18n/relativeTime';
import type { BillingPeriod } from '@/lib/database.types';

/**
 * Subscription billing countdown — the renewal twin of WarrantyCountdown, same
 * anatomy so both item types read identically: live countdown headline, progress
 * bar through the current cycle, absolute date demoted to a caption.
 */
const CYCLE_DAYS: Record<BillingPeriod, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 91,
  yearly: 365,
};

export function RenewalCountdown({
  nextRenewal,
  amount,
  // See InvoiceCard: the device's regional currency is the fallback.
  currency,
  period,
  autoRenews = true,
}: {
  nextRenewal: string;
  amount: number;
  currency?: string | null;
  period: BillingPeriod;
  autoRenews?: boolean;
}) {
  const { t } = useTranslation();
  const { locale, textAlign } = useDirection();
  const type = typeScale(locale);

  const days = calendarDaysUntil(nextRenewal);
  const tone = countdownTone(days);
  const tint =
    tone === 'expired' ? colors.danger : tone === 'urgent' ? '#B4322C' : colors.primary;
  const cycle = CYCLE_DAYS[period];
  // Bar depletes as the cycle burns down, mirroring the warranty bar.
  const pct = days < 0 ? 0 : Math.max(0.02, Math.min(1, days / cycle));

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.lg,
        padding: spacing.lg,
        gap: spacing.md,
      }}
    >
      <Text
        style={{
          color: tint,
          fontSize: locale === 'ar' ? 27 : 26,
          lineHeight: locale === 'ar' ? 38 : 32,
          fontWeight: '700',
          textAlign,
        }}
        numberOfLines={2}
      >
        {countdownLabel(t, days, 'subscription')}
      </Text>

      <View
        style={{ height: 8, borderRadius: radius.pill, backgroundColor: '#EFEEEA', overflow: 'hidden' }}
      >
        <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: tint }} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text style={[type.body, { color: colors.text, fontWeight: '600', flex: 1, textAlign }]}>
          {pricePerPeriod(t, formatCurrency(amount, locale, currency), period)}
        </Text>
        <Ionicons
          name={autoRenews ? 'repeat' : 'pause-circle-outline'}
          size={16}
          color={colors.textMuted}
        />
        <Text style={[type.caption, { color: colors.textMuted }]}>
          {autoRenews ? t('subscription.autoRenews') : t('subscription.autoRenewsOff')}
        </Text>
      </View>

      <Text style={[type.caption, { color: colors.textMuted, textAlign }]}>
        {t('subscription.nextBilling')} · {formatDate(nextRenewal, locale)}
      </Text>
    </View>
  );
}
