import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button } from './Button';
import { colors, radius, spacing, typeScale } from '@/theme';
import { useDirection } from '@/i18n/rtl';

/**
 * Every list has one. An empty screen is never a dead end — the illustration is
 * an icon in a soft well, and the primary action is the thing the user came to
 * do, so the state doubles as onboarding.
 */
export function EmptyState({
  icon,
  title,
  body,
  ctaLabel,
  onPressCta,
  compact = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  ctaLabel?: string;
  onPressCta?: () => void;
  compact?: boolean;
}) {
  const { locale } = useDirection();
  const type = typeScale(locale);

  return (
    <View
      style={{
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: compact ? spacing.xl : spacing.xxl,
        paddingHorizontal: spacing.lg,
        borderWidth: compact ? 1 : 0,
        borderStyle: compact ? 'dashed' : 'solid',
        borderColor: colors.border,
        borderRadius: radius.lg,
      }}
    >
      <View
        style={{
          width: compact ? 48 : 64,
          height: compact ? 48 : 64,
          borderRadius: radius.lg,
          backgroundColor: '#F1F0EC',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.xs,
        }}
      >
        <Ionicons name={icon} size={compact ? 22 : 28} color={colors.textMuted} />
      </View>

      <Text style={[type.heading, { color: colors.text, textAlign: 'center' }]}>{title}</Text>
      {body ? (
        <Text
          style={[
            type.caption,
            { color: colors.textMuted, textAlign: 'center', maxWidth: 280, lineHeight: 20 },
          ]}
        >
          {body}
        </Text>
      ) : null}

      {ctaLabel && onPressCta ? (
        <Button
          label={ctaLabel}
          onPress={onPressCta}
          style={{ marginTop: spacing.md, paddingHorizontal: spacing.xxl }}
        />
      ) : null}
    </View>
  );
}
