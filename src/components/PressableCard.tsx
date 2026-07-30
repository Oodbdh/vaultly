import { useRef } from 'react';
import { Animated, Easing, Pressable, type ViewStyle } from 'react-native';

import { colors, radius, spacing } from '@/theme';

/**
 * The press feel used by every card in the app: a small scale-down paired with
 * a shadow that softens on touch, so the card reads as lifting off under the
 * finger. Native driver on both axes, so it stays smooth on Android too.
 */
export function PressableCard({
  onPress,
  children,
  style,
  disabled,
  accessibilityLabel,
}: {
  onPress?: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const press = useRef(new Animated.Value(0)).current;

  const animate = (to: number) =>
    Animated.timing(press, {
      toValue: to,
      duration: to ? 110 : 160,
      easing: to ? Easing.out(Easing.quad) : Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      disabled={disabled || !onPress}
      onPressIn={() => animate(1)}
      onPressOut={() => animate(0)}
    >
      <Animated.View
        style={[
          {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.lg,
            padding: spacing.lg,
            shadowColor: '#0B1220',
            shadowOffset: { width: 0, height: 2 },
            shadowRadius: 8,
            // iOS shadow eases with the press; Android keeps a flat elevation.
            shadowOpacity: press.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.02] }),
            transform: [
              { scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.978] }) },
            ],
          },
          style,
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}
