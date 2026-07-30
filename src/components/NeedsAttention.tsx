import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing, typeScale } from '@/theme';
import { URGENCY } from '@/theme/urgency';
import { useDirection } from '@/i18n/rtl';
import { calendarDaysUntil, countdownLabel, countdownTone } from '@/i18n/relativeTime';

export type AttentionEntry = {
  id: string;
  title: string;
  subtitle?: string | null;
  date: string;
  kind: 'warranty' | 'subscription';
};

/**
 * The command-centre card. Warranties and subscriptions merged into one
 * urgency-ranked list — the user cares about "what's about to happen", not
 * which table it came from. When nothing is urgent it says so rather than
 * disappearing, so the answer to "is anything on fire?" is always on screen.
 */
export function NeedsAttention({
  entries,
  onPressEntry,
  max = 3,
}: {
  entries: AttentionEntry[];
  onPressEntry?: (entry: AttentionEntry) => void;
  max?: number;
}) {
  const { t } = useTranslation();
  const { locale, textAlign, flipIcon } = useDirection();
  const type = typeScale(locale);

  // Only genuinely time-sensitive items earn a place here (≤30 days, or overdue).
  const urgent = entries
    .filter((e) => calendarDaysUntil(e.date) <= 30)
    .sort((a, b) => calendarDaysUntil(a.date) - calendarDaysUntil(b.date));
  const shown = urgent.slice(0, max);
  const overflow = urgent.length - shown.length;

  if (!shown.length) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          backgroundColor: '#EAF4EF',
          borderWidth: 1,
          borderColor: '#CFE5DA',
          borderRadius: radius.lg,
          padding: spacing.lg,
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.md,
            backgroundColor: 'rgba(47,125,91,0.12)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="checkmark-circle" size={22} color={colors.success} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.body, { color: colors.text, fontWeight: '700', textAlign }]}>
            {t('attention.allClearTitle')}
          </Text>
          <Text style={[type.caption, { color: colors.textMuted, textAlign }]}>
            {t('attention.allClearBody')}
          </Text>
        </View>
      </View>
    );
  }

  const worst = URGENCY[countdownTone(calendarDaysUntil(shown[0]!.date))];

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        // The card's own edge takes the colour of its most urgent item.
        borderColor: worst.border,
        borderRadius: radius.lg,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          backgroundColor: worst.bg,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
        }}
      >
        <Ionicons name="warning" size={17} color={worst.fg} />
        <Text style={[type.body, { color: worst.fg, fontWeight: '800', flex: 1, textAlign }]}>
          {t('attention.title')}
        </Text>
        {overflow > 0 ? (
          <Text style={[type.caption, { color: worst.fg, fontWeight: '600' }]}>
            {t('attention.more', { count: overflow })}
          </Text>
        ) : null}
      </View>

      {shown.map((e, i) => {
        const days = calendarDaysUntil(e.date);
        const u = URGENCY[countdownTone(days)];
        return (
          <Pressable
            key={e.id}
            accessibilityRole="button"
            accessibilityLabel={`${e.title}, ${countdownLabel(t, days, e.kind)}`}
            onPress={() => onPressEntry?.(e)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.lg,
              minHeight: 62,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: colors.border,
              backgroundColor: pressed ? '#FBFAF8' : colors.surface,
            })}
          >
            <View
              style={{ width: 4, height: 34, borderRadius: radius.pill, backgroundColor: u.fg }}
            />
            <Ionicons
              name={e.kind === 'subscription' ? 'repeat' : 'shield-checkmark-outline'}
              size={17}
              color={colors.textMuted}
            />
            <View style={{ flex: 1, gap: 1 }}>
              <Text
                style={[type.body, { color: colors.text, fontWeight: '600', textAlign }]}
                numberOfLines={1}
              >
                {e.title}
              </Text>
              {e.subtitle ? (
                <Text
                  style={[type.caption, { color: colors.textMuted, textAlign }]}
                  numberOfLines={1}
                >
                  {e.subtitle}
                </Text>
              ) : null}
            </View>
            <Text
              style={{ color: u.fg, fontWeight: '700', fontSize: locale === 'ar' ? 13 : 12 }}
              numberOfLines={1}
            >
              {countdownLabel(t, days, e.kind)}
            </Text>
            <Ionicons name="chevron-forward" size={15} color={colors.border} style={flipIcon} />
          </Pressable>
        );
      })}
    </View>
  );
}
