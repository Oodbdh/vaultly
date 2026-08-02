import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { SelectChip } from './SelectChip';
import {
  DEFAULT_DURATION,
  DurationInput,
  durationMonths,
  resolveDuration,
  type Duration,
} from './DurationInput';
import { colors, spacing, typeScale } from '@/theme';
import { useDirection, formatDate } from '@/i18n/rtl';
import { countdownLabel } from '@/i18n/relativeTime';
import { addDuration, daysUntil, isValidISODate, todayISO } from '@/lib/dateMath';

/**
 * How long the warranty lasts. Presets cover the common terms; `custom` takes
 * any positive whole number with a unit of days, months or years.
 *
 * The end date is always derived from a duration — there is no typed-date mode.
 * Asking someone to key `2027-07-29` was the worst input in the app: it needed
 * an exact format, gave no feedback until it validated, and is the one thing a
 * phone keyboard is worst at.
 *
 * Shared by the manual form and the post-scan review so the two can't drift —
 * that drift is how the 6-month chip ended up mislabelled in the first place.
 */
export type WarrantyChoice =
  | { mode: 'none' }
  | { mode: 'preset'; months: number }
  | { mode: 'custom'; duration: Duration };

export const DEFAULT_CHOICE: WarrantyChoice = { mode: 'preset', months: 12 };

/** Preset terms, in months. */
const PRESETS = [1, 3, 6, 12, 24] as const;

/**
 * Resolves a choice to an end date. Returns null when the warranty is "none"
 * or the input isn't usable yet — callers save null rather than a guess.
 *
 * Anchored to the purchase date when there is one, because a warranty runs from
 * when the thing was bought. `purchaseDate` defaults to today on the manual
 * form, so "2 + Years" there is two years from today.
 */
export function resolveExpiry(choice: WarrantyChoice, purchaseDate: string): string | null {
  const base = isValidISODate(purchaseDate) ? purchaseDate : todayISO();
  switch (choice.mode) {
    case 'none':
      return null;
    case 'preset':
      return addDuration(base, choice.months, 'month');
    case 'custom':
      return resolveDuration(choice.duration, base);
  }
}

/** Months, when the choice expresses one — stored for the progress bar. */
export function resolveDurationMonths(choice: WarrantyChoice): number | null {
  if (choice.mode === 'preset') return choice.months;
  if (choice.mode === 'custom') return durationMonths(choice.duration);
  return null;
}

function presetLabel(t: ReturnType<typeof useTranslation>['t'], months: number): string {
  if (months === 12) return t('warranty.oneYear');
  if (months === 24) return t('warranty.twoYears');
  return t('warranty.months', { count: months });
}

export function WarrantyDurationPicker({
  value,
  onChange,
  purchaseDate,
  allowNone = false,
}: {
  value: WarrantyChoice;
  onChange: (next: WarrantyChoice) => void;
  purchaseDate: string;
  /** The post-scan review lets you decline a warranty entirely. */
  allowNone?: boolean;
}) {
  const { t } = useTranslation();
  const { locale, textAlign } = useDirection();
  const type = typeScale(locale);

  const expiry = useMemo(() => resolveExpiry(value, purchaseDate), [value, purchaseDate]);

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        {allowNone ? (
          <SelectChip
            label={t('warranty.noWarranty')}
            active={value.mode === 'none'}
            onPress={() => onChange({ mode: 'none' })}
          />
        ) : null}

        {PRESETS.map((months) => (
          <SelectChip
            key={months}
            label={presetLabel(t, months)}
            active={value.mode === 'preset' && value.months === months}
            onPress={() => onChange({ mode: 'preset', months })}
          />
        ))}

        <SelectChip
          label={t('duration.custom')}
          active={value.mode === 'custom'}
          onPress={() => onChange({ mode: 'custom', duration: DEFAULT_DURATION })}
        />
      </View>

      {value.mode === 'custom' ? (
        <DurationInput
          value={value.duration}
          onChange={(duration) => onChange({ mode: 'custom', duration })}
          accessibilityLabel={t('form.warrantyPeriod')}
        />
      ) : null}

      {/* Live read-out: the end date and the countdown it will show. */}
      {value.mode !== 'none' ? (
        <Text style={[type.caption, { color: colors.textMuted, textAlign }]}>
          {expiry
            ? `${t('item.warrantyExpiry')} · ${formatDate(expiry, locale)} · ${countdownLabel(
                t,
                daysUntil(expiry),
                'warranty',
              )}`
            : t('warranty.enterDuration')}
        </Text>
      ) : null}
    </View>
  );
}
