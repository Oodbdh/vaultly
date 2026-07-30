import { Text, TextInput, View } from 'react-native';

import { colors, radius, spacing, typeScale } from '@/theme';
import { useDirection } from '@/i18n/rtl';

/**
 * Labelled text input — the single form control used by the auth screens, the
 * post-scan review step and both manual add forms. Alignment and writing
 * direction follow the active locale, so no caller handles RTL itself.
 */
export function Field({
  label,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { locale, textAlign } = useDirection();
  const type = typeScale(locale);
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={[type.caption, { color: colors.textMuted, textAlign }]}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
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
          writingDirection: locale === 'ar' ? 'rtl' : 'ltr',
        }}
        {...props}
      />
    </View>
  );
}
