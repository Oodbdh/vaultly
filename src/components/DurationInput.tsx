import { TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { SelectChip } from './SelectChip';
import { colors, radius, spacing } from '@/theme';
import { useDirection } from '@/i18n/rtl';
import { addDuration, isValidISODate, todayISO, type DateUnit } from '@/lib/dateMath';

/**
 * "14 Days", "6 Months", "2 Years" — a positive whole number plus a unit.
 *
 * Shared verbatim by the warranty and subscription pickers so the custom
 * duration behaves identically in both. That sharing is deliberate: the two
 * pickers diverged once before and produced the mislabelled 6-month chip.
 */
export type Duration = { amount: string; unit: DateUnit };

export const UNITS: DateUnit[] = ['day', 'month', 'year'];

export const DEFAULT_DURATION: Duration = { amount: '', unit: 'month' };

/** Only whole numbers above zero. An empty or half-typed field is not a duration. */
export function durationAmount(duration: Duration): number | null {
  if (!/^\d+$/.test(duration.amount)) return null;
  const n = Number(duration.amount);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Applies the duration to `from`, defaulting to today. Returns null while the
 * amount is unusable, so callers block Save rather than storing a guess the
 * reminders and countdown would then be built on.
 */
export function resolveDuration(duration: Duration, from?: string): string | null {
  const n = durationAmount(duration);
  if (n === null) return null;
  const base = from && isValidISODate(from) ? from : todayISO();
  const end = addDuration(base, n, duration.unit);
  // "9999 years" formats a five-digit year, which every later parse rejects —
  // `daysUntil` would throw and take the screen down. Treat anything that does
  // not round-trip as an unusable duration, same as an empty field.
  return isValidISODate(end) ? end : null;
}

/** The duration expressed in whole months, when the unit allows it. */
export function durationMonths(duration: Duration): number | null {
  const n = durationAmount(duration);
  if (n === null) return null;
  if (duration.unit === 'month') return n;
  if (duration.unit === 'year') return n * 12;
  return null;
}

export function DurationInput({
  value,
  onChange,
  accessibilityLabel,
}: {
  value: Duration;
  onChange: (next: Duration) => void;
  accessibilityLabel?: string;
}) {
  const { t } = useTranslation();
  const { locale } = useDirection();

  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
      <TextInput
        value={value.amount}
        // Stripped rather than validated after the fact, so the field can never
        // hold something the numeric keyboard on Android would have allowed
        // (it still offers a decimal separator on some locales).
        onChangeText={(amount) => onChange({ ...value, amount: amount.replace(/[^0-9]/g, '') })}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={4}
        placeholder="0"
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={accessibilityLabel ?? t('duration.amount')}
        style={{
          width: 88,
          minHeight: 44,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.md,
          backgroundColor: colors.surface,
          paddingHorizontal: spacing.md,
          color: colors.text,
          fontSize: locale === 'ar' ? 17 : 16,
          // Centred in both directions — a bare number has no reading order.
          textAlign: 'center',
        }}
      />
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', flex: 1 }}>
        {UNITS.map((unit) => (
          <SelectChip
            key={unit}
            label={t(`duration.${unit}`)}
            active={value.unit === unit}
            onPress={() => onChange({ ...value, unit })}
          />
        ))}
      </View>
    </View>
  );
}
