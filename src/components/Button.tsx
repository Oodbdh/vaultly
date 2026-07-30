import { Pressable, Text, type PressableProps, type ViewStyle } from 'react-native';

import { colors, radius, spacing } from '@/theme';
import { useDirection } from '@/i18n/rtl';

type Props = PressableProps & {
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  style?: ViewStyle;
};

export function Button({ label, variant = 'primary', disabled, style, ...rest }: Props) {
  const { locale } = useDirection();
  const bg =
    variant === 'primary' ? colors.primary : variant === 'secondary' ? colors.surface : 'transparent';
  const fg = variant === 'primary' ? colors.primaryText : colors.primary;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        {
          minHeight: 52, // ≥44pt hit target
          borderRadius: radius.md,
          backgroundColor: bg,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.xl,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        },
        style,
      ]}
      {...rest}
    >
      <Text
        style={{
          color: fg,
          fontSize: locale === 'ar' ? 17 : 16,
          fontWeight: '600',
          writingDirection: locale === 'ar' ? 'rtl' : 'ltr',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
