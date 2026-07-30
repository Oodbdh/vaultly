import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { colors, radius, spacing, typeScale } from '@/theme';
import { useDirection } from '@/i18n/rtl';
import { usePaywall } from '@/hooks/usePaywall';
import { usePremium } from '@/hooks/usePremium';

const BENEFITS = [
  'paywall.benefitUnlimited',
  'paywall.benefitAdFree',
  'paywall.benefitReminders',
  'paywall.benefitPriority',
];

export default function Paywall() {
  const { t } = useTranslation();
  const { locale, textAlign } = useDirection();
  const type = typeScale(locale);
  const router = useRouter();
  const { isPremium } = usePremium();
  const { priceLabel, isLoading, busy, purchase, restore } = usePaywall();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, flexGrow: 1 }}>
        <View style={{ gap: spacing.sm }}>
          <Text style={[type.title, { color: colors.text, textAlign }]}>{t('paywall.title')}</Text>
          <Text style={[type.body, { color: colors.textMuted, textAlign }]}>
            {t('paywall.subtitle')}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.lg,
            padding: spacing.lg,
            gap: spacing.md,
          }}
        >
          {BENEFITS.map((key) => (
            <View key={key} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: radius.pill,
                  backgroundColor: colors.accent,
                }}
              />
              <Text style={[type.body, { color: colors.text, flex: 1, textAlign }]}>{t(key)}</Text>
            </View>
          ))}
        </View>

        <View style={{ flex: 1 }} />

        {isLoading ? (
          <ActivityIndicator />
        ) : (
          <View style={{ gap: spacing.md }}>
            <Text style={[type.heading, { color: colors.text, textAlign: 'center' }]}>
              {t('paywall.price', { price: priceLabel })}
            </Text>
            <Button
              label={isPremium ? t('paywall.alreadyPremium') : busy ? t('common.loading') : t('paywall.cta')}
              disabled={busy || isPremium}
              onPress={async () => {
                const outcome = await purchase();
                if (outcome === 'purchased') router.back();
              }}
            />
            <Button variant="ghost" label={t('paywall.restore')} onPress={() => void restore()} />
            <Text style={[type.caption, { color: colors.textMuted, textAlign: 'center' }]}>
              {t('paywall.terms')}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
