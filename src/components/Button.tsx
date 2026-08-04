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
          // Vertical padding so a label that wraps to two lines is not clipped
          // by minHeight; horizontal padding is the smaller `lg` because at
          // `xl` a half-width button spent 48dp of a ~168dp box on padding,
          // which is what forced short German and French labels onto three
          // lines. Wide buttons look unchanged — they were never that tight.
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        },
        style,
      ]}
      {...rest}
    >
      <Text
        // Two lines, then shrink. Without this a long localised label wrapped
        // to as many lines as it liked and dragged the whole row's height with
        // it, so a pair of buttons whose labels differ in length — "Watch one
        // ad for +1 permanent slot" beside "Go Premium" — rendered at wildly
        // different visual weights. Arabic happened to be the shortest string
        // in every pair, which is why only Arabic looked right.
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
        style={{
          color: fg,
          fontSize: locale === 'ar' ? 17 : 16,
          fontWeight: '600',
          textAlign: 'center',
          writingDirection: locale === 'ar' ? 'rtl' : 'ltr',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
