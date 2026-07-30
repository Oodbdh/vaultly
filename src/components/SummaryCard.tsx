import { Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing, typeScale } from '@/theme';
import { useDirection } from '@/i18n/rtl';

/**
 * Dashboard metric tile. `value` is pre-formatted by the caller so number and
 * currency shaping stays in one place (i18n/rtl.ts).
 */
export function SummaryCard({
  label,
  value,
  suffix,
  icon,
  tint = colors.primary,
  style,
}: {
  label: string;
  value: string;
  suffix?: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint?: string;
  style?: ViewStyle;
}) {
  const { locale, textAlign } = useDirection();
  const type = typeScale(locale);

  return (
    <View
      style={[
        {
          flex: 1,
          minWidth: 0,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.lg,
          padding: spacing.md,
          paddingVertical: spacing.lg,
          gap: spacing.sm,
        },
        style,
      ]}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radius.md,
          backgroundColor: `${tint}14`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={19} color={tint} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, flexWrap: 'wrap' }}>
        <Text
          style={{
            color: colors.text,
            fontSize: locale === 'ar' ? 27 : 26,
            lineHeight: locale === 'ar' ? 34 : 30,
            fontWeight: '800',
            letterSpacing: -0.5,
            textAlign,
          }}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {value}
        </Text>
        {suffix ? (
          <Text style={[type.caption, { color: colors.textMuted }]}>{suffix}</Text>
        ) : null}
      </View>

      <Text
        style={[
          type.caption,
          {
            color: colors.textMuted,
            textAlign,
            fontSize: locale === 'ar' ? 12.5 : 11.5,
            lineHeight: 16,
          },
        ]}
        numberOfLines={2}
      >
        {label}
      </Text>
    </View>
  );
}
