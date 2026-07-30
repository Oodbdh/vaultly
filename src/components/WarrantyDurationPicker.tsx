import { useMemo } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { SelectChip } from './SelectChip';
import { colors, radius, spacing, typeScale } from '@/theme';
import { useDirection, formatDate } from '@/i18n/rtl';
import { countdownLabel } from '@/i18n/relativeTime';
import {
  addDuration,
  daysUntil,
  isValidISODate,
  todayISO,
  type DateUnit,
} from '@/lib/dateMath';

/**
 * How long the warranty lasts. Presets cover the common terms; `custom` takes
 * any positive number with a unit; `exact` takes the end date straight from the
 * user (a receipt that states one).
 *
 * Shared by the manual form and the post-scan review so the two can't drift —
 * that drift is how the 6-month chip ended up mislabelled in the first place.
 */
export type WarrantyChoice =
  | { mode: 'none' }
  | { mode: 'preset'; months: number }
  | { mode: 'custom'; amount: string; unit: DateUnit }
  | { mode: 'exact'; date: string };

export const DEFAULT_CHOICE: WarrantyChoice = { mode: 'preset', months: 12 };

/** Preset terms, in months. */
const PRESETS = [1, 3, 6, 12, 24] as const;
const UNITS: DateUnit[] = ['day', 'month', 'year'];

/**
 * Resolves a choice to an end date. Returns null when the warranty is "none"
 * or the input isn't usable yet — callers save null rather than a guess.
 */
export function resolveExpiry(choice: WarrantyChoice, purchaseDate: string): string | null {
  const base = isValidISODate(purchaseDate) ? purchaseDate : todayISO();
  switch (choice.mode) {
    case 'none':
      return null;
    case 'preset':
      return addDuration(base, choice.months, 'month');
    case 'custom': {
      const n = Number(choice.amount);
      if (!Number.isInteger(n) || n <= 0) return null;
      return addDuration(base, n, choice.unit);
    }
    case 'exact':
      return isValidISODate(choice.date) ? choice.date : null;
  }
}

/** Months, when the choice expresses one — stored for the progress bar. */
export function resolveDurationMonths(choice: WarrantyChoice): number | null {
  if (choice.mode === 'preset') return choice.months;
  if (choice.mode === 'custom') {
    const n = Number(choice.amount);
    if (!Number.isInteger(n) || n <= 0) return null;
    if (choice.unit === 'month') return n;
    if (choice.unit === 'year') return n * 12;
  }
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
          label={t('warranty.custom')}
          active={value.mode === 'custom'}
          onPress={() => onChange({ mode: 'custom', amount: '', unit: 'month' })}
        />
        <SelectChip
          label={t('warranty.exactDate')}
          active={value.mode === 'exact'}
          onPress={() => onChange({ mode: 'exact', date: '' })}
        />
      </View>

      {value.mode === 'custom' ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          <TextInput
            value={value.amount}
            onChangeText={(amount) => onChange({ ...value, amount: amount.replace(/[^0-9]/g, '') })}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t('warranty.customAmount')}
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
              textAlign: 'center',
            }}
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', flex: 1 }}>
            {UNITS.map((unit) => (
              <SelectChip
                key={unit}
                label={t(`warranty.unit_${unit}`)}
                active={value.unit === unit}
                onPress={() => onChange({ ...value, unit })}
              />
            ))}
          </View>
        </View>
      ) : null}

      {value.mode === 'exact' ? (
        <TextInput
          value={value.date}
          onChangeText={(date) => onChange({ mode: 'exact', date })}
          placeholder="2027-07-29"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          accessibilityLabel={t('item.warrantyExpiry')}
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

