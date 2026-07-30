import { Pressable, Text } from 'react-native';

import { colors, radius, spacing } from '@/theme';
import { useDirection } from '@/i18n/rtl';

/**
 * The pill used by every inline single-choice row — warranty durations,
 * billing cycles, list filters. Shared so the two pickers can't drift apart
 * visually the way the duration chips did.
 */
export function SelectChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { locale } = useDirection();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        minHeight: 44,
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
        borderRadius: radius.pill,
        backgroundColor: active ? colors.primary : colors.surface,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
      }}
    >
      <Text
        style={{
          color: active ? colors.primaryText : colors.text,
          fontWeight: '600',
          fontSize: locale === 'ar' ? 15 : 14,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
