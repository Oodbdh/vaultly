import { useMemo } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { SelectChip } from './SelectChip';
import { colors, radius, spacing, typeScale } from '@/theme';
import { useDirection, formatDate } from '@/i18n/rtl';
import { countdownLabel } from '@/i18n/relativeTime';
import { addBillingCycle, daysUntil, isValidISODate, todayISO } from '@/lib/dateMath';
import type { BillingPeriod } from '@/lib/database.types';

/**
 * When the subscription next renews.
 *
 * Mirrors WarrantyDurationPicker: pick a billing cycle and the date is derived
 * from it, or choose "Set manually" and type the date the receipt states — the
 * same escape hatch the warranty flow has for a printed expiry date.
 *
 * The billing cycle is kept in both modes. It is a column in its own right
 * (`subscriptions.period`, used for the price-per-period label), so choosing a
 * manual date must not discard it.
 */
export type RenewalChoice = {
  period: BillingPeriod;
  /** null = derive from the cycle. A string means the user is typing one. */
  manualDate: string | null;
};

export const CYCLES: BillingPeriod[] = ['weekly', 'monthly', 'quarterly', 'yearly'];

export function defaultRenewal(period: BillingPeriod = 'monthly'): RenewalChoice {
  return { period, manualDate: null };
}

/**
 * Seeds the picker from a scan. A date the model actually read is treated as
 * manually set, so switching cycle afterwards will not silently overwrite it.
 */
export function renewalFromParams(
  period: BillingPeriod | undefined,
  detectedDate: string | undefined,
): RenewalChoice {
  const p = period && CYCLES.includes(period) ? period : 'monthly';
  return detectedDate && isValidISODate(detectedDate)
    ? { period: p, manualDate: detectedDate }
    : { period: p, manualDate: null };
}

/**
 * The date to store. null while a manual entry is incomplete or invalid, so
 * callers can block Save rather than writing a bad date the reminders and
 * countdown would then be built on.
 */
export function resolveRenewal(choice: RenewalChoice, from?: string): string | null {
  if (choice.manualDate !== null) {
    return isValidISODate(choice.manualDate) ? choice.manualDate : null;
  }
  const base = from && isValidISODate(from) ? from : todayISO();
  return addBillingCycle(base, choice.period);
}

export function RenewalPicker({
  value,
  onChange,
  from,
}: {
  value: RenewalChoice;
  onChange: (next: RenewalChoice) => void;
  /** Anchor for a cycle-derived date; defaults to today. */
  from?: string;
}) {
  const { t } = useTranslation();
  const { locale, textAlign } = useDirection();
  const type = typeScale(locale);

  const renewal = useMemo(() => resolveRenewal(value, from), [value, from]);
  const manual = value.manualDate !== null;

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        {CYCLES.map((period) => (
          <SelectChip
            key={period}
            label={t(`form.${period}`)}
            active={value.period === period}
            // Choosing a cycle re-derives the date, unless the user has
            // deliberately set one by hand.
            onPress={() => onChange({ period, manualDate: manual ? value.manualDate : null })}
          />
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        <SelectChip
          label={t('subscription.autoDate')}
          active={!manual}
          onPress={() => onChange({ ...value, manualDate: null })}
        />
        <SelectChip
          label={t('subscription.setManually')}
          active={manual}
          // Seed with the derived date so the field is never empty on open.
          onPress={() => onChange({ ...value, manualDate: resolveRenewal(value, from) ?? '' })}
        />
      </View>

      {manual ? (
        <TextInput
          value={value.manualDate ?? ''}
          onChangeText={(manualDate) => onChange({ ...value, manualDate })}
          placeholder="2026-08-28"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
          accessibilityLabel={t('form.nextRenewal')}
          style={{
            minHeight: 52,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            backgroundColor: colors.surface,
            paddingHorizontal: spacing.lg,
            color: colors.text,
            fontSize: locale === 'ar' ? 17 : 16,
            textAlign,
          }}
        />
      ) : null}

      {/* Live read-out: the stored date and the countdown the cards will show. */}
      <Text style={[type.caption, { color: colors.textMuted, textAlign }]}>
        {renewal
          ? `${t('subscription.nextBilling')} · ${formatDate(renewal, locale)} · ${countdownLabel(
              t,
              daysUntil(renewal),
              'subscription',
            )}`
          : t('subscription.enterDate')}
      </Text>
    </View>
  );
}
