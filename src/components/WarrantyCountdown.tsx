import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing, typeScale } from '@/theme';
import { useDirection, formatDate } from '@/i18n/rtl';
import { calendarDaysUntil, countdownLabel, countdownTone } from '@/i18n/relativeTime';

/**
 * Warranty countdown. The headline is the live day count; the absolute date is
 * demoted to a caption. A proportional bar (not a drawn ring) mirrors correctly
 * under RTL for free and stays legible at small sizes.
 */
export function WarrantyCountdown({
  expiresOn,
  totalDays,
}: {
  expiresOn: string;
  totalDays: number;
}) {
  const { t } = useTranslation();
  const { locale, textAlign } = useDirection();
  const type = typeScale(locale);

  const daysLeft = calendarDaysUntil(expiresOn);
  const tone = countdownTone(daysLeft);
  const tint =
    tone === 'expired'
      ? colors.danger
      : tone === 'urgent'
        ? '#B4322C'
        : tone === 'soon'
          ? '#B98200'
          : colors.success;
  const pct = daysLeft < 0 ? 0 : Math.max(0.02, Math.min(1, daysLeft / Math.max(totalDays, 1)));

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
        {countdownLabel(t, daysLeft, 'warranty')}
      </Text>

      <View
        style={{ height: 8, borderRadius: radius.pill, backgroundColor: '#EFEEEA', overflow: 'hidden' }}
      >
        {/* width % + RTL flex means the bar fills from the reading edge */}
        <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: tint }} />
      </View>

      <Text style={[type.caption, { color: colors.textMuted, textAlign }]}>
        {t('item.warrantyExpiry')} · {formatDate(expiresOn, locale)}
      </Text>
    </View>
  );
}
