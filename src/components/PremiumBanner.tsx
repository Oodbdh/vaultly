import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing, typeScale } from '@/theme';
import { useDirection, formatDate } from '@/i18n/rtl';
import { usePremium } from '@/hooks/usePremium';
import { usePaywall } from '@/hooks/usePaywall';

/**
 * Settings paywall banner. Premium users see a confirmation state instead of an
 * upsell — never an ad, never a nag.
 */
export function PremiumBanner() {
  const { t } = useTranslation();
  const { locale, textAlign, flipIcon } = useDirection();
  const type = typeScale(locale);
  const router = useRouter();
  const { isPremium, expiresAt } = usePremium();
  const { priceLabel } = usePaywall();

  if (isPremium) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          backgroundColor: '#EAF4EF',
          borderWidth: 1,
          borderColor: '#CFE5DA',
          borderRadius: radius.lg,
          padding: spacing.lg,
        }}
      >
        <Ionicons name="shield-checkmark" size={22} color={colors.success} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.body, { color: colors.text, fontWeight: '700', textAlign }]}>
            {t('settings.premiumActiveTitle')}
          </Text>
          {expiresAt ? (
            <Text style={[type.caption, { color: colors.textMuted, textAlign }]}>
              {t('settings.premiumActiveBody', { date: formatDate(expiresAt, locale) })}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push('/paywall')}
      style={({ pressed }) => ({
        backgroundColor: colors.primary,
        borderRadius: radius.lg,
        padding: spacing.lg,
        gap: spacing.md,
        opacity: pressed ? 0.92 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: radius.sm,
            backgroundColor: 'rgba(255,255,255,0.14)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="sparkles" size={19} color={colors.accent} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.body, { color: colors.primaryText, fontWeight: '700', textAlign }]}>
            {t('settings.premiumBannerTitle')}
          </Text>
          <Text
            style={[type.caption, { color: 'rgba(255,255,255,0.78)', textAlign }]}
            numberOfLines={2}
          >
            {t('settings.premiumBannerBody', { price: t('paywall.price', { price: priceLabel }) })}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.6)" style={flipIcon} />
      </View>
    </Pressable>
  );
}
