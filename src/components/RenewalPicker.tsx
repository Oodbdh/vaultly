import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { SelectChip } from './SelectChip';
import {
  DEFAULT_DURATION,
  DurationInput,
  resolveDuration,
  type Duration,
} from './DurationInput';
import { colors, spacing, typeScale } from '@/theme';
import { useDirection, formatDate } from '@/i18n/rtl';
import { countdownLabel } from '@/i18n/relativeTime';
import { addBillingCycle, daysUntil, isValidISODate, todayISO } from '@/lib/dateMath';
import type { BillingPeriod } from '@/lib/database.types';

/**
 * When the subscription next renews.
 *
 * Mirrors WarrantyDurationPicker exactly: pick a billing cycle and the date is
 * derived from it, or pick "Custom" and give a number plus a unit. There is no
 * typed-date mode in either picker.
 *
 * The billing cycle is kept in every mode. It is a column in its own right
 * (`subscriptions.period`, used for the price-per-period label), so choosing a
 * custom duration must not discard it — a service billed monthly but first
 * renewing in 14 days is still a monthly subscription.
 */
export type RenewalChoice = {
  period: BillingPeriod;
  /** A custom duration from today. null = derive the date from the cycle. */
  custom: Duration | null;
  /**
   * A renewal date the scan actually read. Not user-editable and never typed —
   * it is offered as a chip so a detected date is not silently thrown away, and
   * it is dropped the moment the user picks a cycle or a custom duration.
   */
  detected: string | null;
};

export const CYCLES: BillingPeriod[] = ['weekly', 'monthly', 'quarterly', 'yearly'];

export function defaultRenewal(period: BillingPeriod = 'monthly'): RenewalChoice {
  return { period, custom: null, detected: null };
}

/**
 * Seeds the picker from a scan. A date the model actually read is kept as the
 * active choice, so switching cycle afterwards will not silently overwrite it.
 */
export function renewalFromParams(
  period: BillingPeriod | undefined,
  detectedDate: string | undefined,
): RenewalChoice {
  const p = period && CYCLES.includes(period) ? period : 'monthly';
  return {
    period: p,
    custom: null,
    detected: detectedDate && isValidISODate(detectedDate) ? detectedDate : null,
  };
}

/**
 * The date to store. null while a custom duration is incomplete, so callers can
 * block Save rather than writing a bad date the reminders and countdown would
 * then be built on.
 */
export function resolveRenewal(choice: RenewalChoice, from?: string): string | null {
  const base = from && isValidISODate(from) ? from : todayISO();
  if (choice.detected !== null) return choice.detected;
  if (choice.custom !== null) return resolveDuration(choice.custom, base);
  return addBillingCycle(base, choice.period);
}

export function RenewalPicker({
  value,
  onChange,
  from,
}: {
  value: RenewalChoice;
  onChange: (next: RenewalChoice) => void;
  /** Anchor for a cycle-derived or custom date; defaults to today. */
  from?: string;
}) {
  const { t } = useTranslation();
  const { locale, textAlign } = useDirection();
  const type = typeScale(locale);

  const renewal = useMemo(() => resolveRenewal(value, from), [value, from]);
  const custom = value.custom !== null;

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        {value.detected ? (
          <SelectChip
            label={t('subscription.fromReceipt')}
            active
            // Already the active choice; tapping it is a no-op rather than a
            // way to re-select a date the user has moved away from.
            onPress={() => {}}
          />
        ) : null}

        {CYCLES.map((period) => (
          <SelectChip
            key={period}
            label={t(`form.${period}`)}
            active={!custom && !value.detected && value.period === period}
            // Choosing a cycle re-derives the date and clears both overrides.
            onPress={() => onChange({ period, custom: null, detected: null })}
          />
        ))}

        <SelectChip
          label={t('duration.custom')}
          active={custom}
          onPress={() =>
            onChange({ period: value.period, custom: DEFAULT_DURATION, detected: null })
          }
        />
      </View>

      {custom ? (
        <DurationInput
          value={value.custom ?? DEFAULT_DURATION}
          onChange={(duration) =>
            onChange({ period: value.period, custom: duration, detected: null })
          }
          accessibilityLabel={t('form.nextRenewal')}
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
          : t('subscription.enterDuration')}
      </Text>
    </View>
  );
}
