import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { FAQ, contentLocale } from '@/content/support';
import { colors, radius, spacing, typeScale } from '@/theme';
import { useDirection } from '@/i18n/rtl';

/**
 * FAQ as an accordion — same card, border and divider treatment as the grouped
 * rows on Profile, so it reads as part of the same list language rather than a
 * new screen type.
 */
export default function Faq() {
  const { t } = useTranslation();
  const { locale, textAlign, flipIcon } = useDirection();
  const type = typeScale(locale);
  const router = useRouter();
  const entries = useMemo(() => FAQ[contentLocale(locale)], [locale]);
  const [open, setOpen] = useState<number | null>(0);

  return (
    <>
      <Stack.Screen
        options={{
          title: t('support.faq'),
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      />
      <ScrollView
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxl * 2 }}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.lg,
            paddingHorizontal: spacing.lg,
          }}
        >
          {entries.map((entry, index) => {
            const expanded = open === index;
            return (
              <View key={entry.q}>
                {index > 0 ? <View style={{ height: 1, backgroundColor: colors.border }} /> : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  onPress={() => setOpen(expanded ? null : index)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    minHeight: 56,
                    paddingVertical: spacing.md,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Text
                    style={[
                      type.body,
                      { color: colors.text, fontWeight: '600', flex: 1, textAlign },
                    ]}
                  >
                    {entry.q}
                  </Text>
                  <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={17}
                    color={colors.textMuted}
                    style={expanded ? undefined : flipIcon}
                  />
                </Pressable>
                {expanded ? (
                  <Text
                    style={[
                      type.body,
                      { color: colors.textMuted, textAlign, paddingBottom: spacing.lg },
                    ]}
                  >
                    {entry.a}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>

        <Text style={[type.caption, { color: colors.textMuted, textAlign }]}>
          {t('support.faqFooter')}
        </Text>
        <Button
          variant="secondary"
          label={t('support.contact')}
          onPress={() => router.back()}
        />
      </ScrollView>
    </>
  );
}
