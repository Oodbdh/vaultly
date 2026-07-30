import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing, typeScale } from '@/theme';
import { useDirection } from '@/i18n/rtl';

/** Section title with a "View all" affordance. */
export function SectionHeader({
  title,
  count,
  onViewAll,
}: {
  title: string;
  count?: number;
  onViewAll?: () => void;
}) {
  const { t } = useTranslation();
  const { locale, textAlign, flipIcon } = useDirection();
  const type = typeScale(locale);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <Text style={[type.heading, { color: colors.text, textAlign }]}>{title}</Text>
      {count != null && count > 0 ? (
        <View
          style={{
            minWidth: 22,
            height: 22,
            paddingHorizontal: 6,
            borderRadius: radius.pill,
            backgroundColor: '#EDF0F6',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>{count}</Text>
        </View>
      ) : null}
      <View style={{ flex: 1 }} />
      {onViewAll ? (
        <Pressable
          accessibilityRole="button"
          onPress={onViewAll}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 2,
            minHeight: 44,
            paddingStart: spacing.md,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 14 }}>
            {t('sections.viewAll')}
          </Text>
          <Ionicons name="chevron-forward" size={15} color={colors.primary} style={flipIcon} />
        </Pressable>
      ) : null}
    </View>
  );
}
