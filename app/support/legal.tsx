import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { PRIVACY, TERMS, contentLocale } from '@/content/support';
import { colors, radius, spacing, typeScale } from '@/theme';
import { useDirection, formatDate } from '@/i18n/rtl';

/**
 * Privacy Policy and Terms of Service. One screen for both — they share a
 * shape (title, date, intro, headed sections), and duplicating it would mean
 * two places to restyle.
 */
export default function Legal() {
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const { t } = useTranslation();
  const { locale, textAlign } = useDirection();
  const type = typeScale(locale);

  const content = useMemo(() => {
    const lang = contentLocale(locale);
    return doc === 'terms' ? TERMS[lang] : PRIVACY[lang];
  }, [doc, locale]);

  return (
    <>
      <Stack.Screen
        options={{
          title: content.title,
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      />
      <ScrollView
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxl * 2 }}
      >
        <View style={{ gap: spacing.xs }}>
          <Text style={[type.title, { color: colors.text, textAlign }]}>{content.title}</Text>
          <Text style={[type.caption, { color: colors.textMuted, textAlign }]}>
            {t('support.lastUpdated', { date: formatDate(content.updated, locale) })}
          </Text>
        </View>

        <Text style={[type.body, { color: colors.textMuted, textAlign }]}>{content.intro}</Text>

        <View
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.lg,
            padding: spacing.lg,
            gap: spacing.lg,
          }}
        >
          {content.sections.map((section, index) => (
            <View key={section.heading} style={{ gap: spacing.xs }}>
              {index > 0 ? (
                <View
                  style={{ height: 1, backgroundColor: colors.border, marginBottom: spacing.md }}
                />
              ) : null}
              <Text
                style={[type.body, { color: colors.text, fontWeight: '700', textAlign }]}
              >
                {section.heading}
              </Text>
              <Text style={[type.body, { color: colors.textMuted, textAlign }]}>
                {section.body}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </>
  );
}
