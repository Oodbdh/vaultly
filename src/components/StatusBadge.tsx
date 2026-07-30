import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing } from '@/theme';
import { useDirection } from '@/i18n/rtl';
import { calendarDaysUntil, countdownLabel } from '@/i18n/relativeTime';

export type ItemStatus =
  | 'warranty_active'
  | 'expiring_soon'
  | 'expired'
  | 'subscription'
  | 'no_warranty'
  | 'low_confidence';

const EXPIRING_WINDOW_DAYS = 30;

/** Single place that decides an item's badge, so list and detail never disagree. */
export function resolveStatus(input: {
  kind: 'receipt' | 'warranty' | 'subscription';
  warrantyExpiresOn?: string | null;
  nextRenewal?: string | null;
  ocrConfidence?: number | null;
}): { status: ItemStatus; days: number | null } {
  if (input.kind === 'subscription' && input.nextRenewal) {
    return { status: 'subscription', days: calendarDaysUntil(input.nextRenewal) };
  }
  if (input.warrantyExpiresOn) {
    const days = calendarDaysUntil(input.warrantyExpiresOn);
    if (days < 0) return { status: 'expired', days };
    if (days <= EXPIRING_WINDOW_DAYS) return { status: 'expiring_soon', days };
    return { status: 'warranty_active', days };
  }
  if (input.ocrConfidence != null && input.ocrConfidence < 0.6) {
    return { status: 'low_confidence', days: null };
  }
  return { status: 'no_warranty', days: null };
}

const STYLES: Record<
  ItemStatus,
  { fg: string; bg: string; icon: keyof typeof Ionicons.glyphMap; key: string }
> = {
  warranty_active: { fg: colors.success, bg: '#EAF4EF', icon: 'shield-checkmark', key: 'status.warrantyActive' },
  expiring_soon: { fg: '#8A5A00', bg: '#FCF3E2', icon: 'time', key: 'status.expiringSoon' },
  expired: { fg: colors.danger, bg: '#FDF0EF', icon: 'close-circle', key: 'status.expired' },
  subscription: { fg: colors.primary, bg: '#EDF0F6', icon: 'repeat', key: 'status.subscription' },
  no_warranty: { fg: colors.textMuted, bg: '#F2F2F0', icon: 'document-text', key: 'status.noWarranty' },
  low_confidence: { fg: '#8A5A00', bg: '#FCF3E2', icon: 'alert-circle', key: 'status.lowConfidence' },
};

/**
 * Badge text is always a live countdown when we have a date — "12 days left",
 * "Expires today", "Expired 3 days ago" — and falls back to the state name only
 * when there is no date to count towards. `compact` forces the state name.
 */
export function StatusBadge({
  status,
  days,
  compact = false,
}: {
  status: ItemStatus;
  days?: number | null;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const { locale } = useDirection();
  const s = STYLES[status];
  const urgent = days != null && days >= 0 && days <= 7;

  const label =
    compact || days == null
      ? t(s.key)
      : countdownLabel(t, days, status === 'subscription' ? 'subscription' : 'warranty');

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        alignSelf: 'flex-start',
        backgroundColor: s.bg,
        borderRadius: radius.pill,
        paddingVertical: 4,
        paddingHorizontal: spacing.sm + 2,
      }}
    >
      <Ionicons name={s.icon} size={locale === 'ar' ? 14 : 13} color={s.fg} />
      <Text
        style={{
          color: s.fg,
          fontSize: locale === 'ar' ? 13 : 12,
          fontWeight: urgent ? '700' : '600',
          writingDirection: locale === 'ar' ? 'rtl' : 'ltr',
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}
