import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { colors, radius, spacing, typeScale } from '@/theme';
import { useDirection } from '@/i18n/rtl';
import { restoreAlert, usePaywall } from '@/hooks/usePaywall';
import { usePremium } from '@/hooks/usePremium';
import { useItemQuota } from '@/hooks/useItemQuota';

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
  const quota = useItemQuota();

  /**
   * The add flow routes here as soon as the free limit is hit. While the
   * one-off rewarded slot is still unclaimed, that moment is the ad
   * opportunity — not a Premium wall. Once it is claimed this block disappears
   * for good and the screen is Premium-only, which is the rule from the 6th
   * item onward.
   */
  const showRewardedOffer = !isPremium && quota.canWatchAd;

  async function watchAd() {
    const result = await quota.watchAdForSlot();
    if (result === 'granted') {
      Alert.alert(t('quota.bonusGranted'));
      router.back();
    } else if (result === 'unavailable') {
      Alert.alert(t('quota.adUnavailable'));
    }
  }

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

        {showRewardedOffer ? (
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
            <Text style={[type.body, { color: colors.text, fontWeight: '600', textAlign }]}>
              {t('settings.freeSlotsTitle')}
            </Text>
            <Text style={[type.caption, { color: colors.textMuted, textAlign }]}>
              {t('settings.freeSlotsBody')}
            </Text>
            <Button
              variant="secondary"
              disabled={quota.adLoading}
              label={quota.adLoading ? t('quota.watchAdLoading') : t('quota.watchAd')}
              onPress={() => void watchAd()}
            />
          </View>
        ) : null}

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
            <Button
              variant="ghost"
              label={t('paywall.restore')}
              onPress={async () => {
                const { title, message } = restoreAlert(await restore(), t);
                Alert.alert(title, message);
              }}
            />
            <Text style={[type.caption, { color: colors.textMuted, textAlign: 'center' }]}>
              {t('paywall.terms')}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
