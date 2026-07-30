import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing, typeScale } from '@/theme';
import { useDirection } from '@/i18n/rtl';
import { useItemQuota } from '@/hooks/useItemQuota';
import { usePremium } from '@/hooks/usePremium';

/**
 * Rewarded-ad trigger. Rendered only for free users — the premium branch returns
 * null, which is how "completely ad-free" is guaranteed at the UI layer too.
 */
export function RewardedSlotCard() {
  const { t } = useTranslation();
  const { locale, textAlign } = useDirection();
  const type = typeScale(locale);
  const { isPremium } = usePremium();
  const quota = useItemQuota();
  const [justGranted, setJustGranted] = useState(false);

  if (isPremium) return null;

  const canWatch = quota.bonusActive < 2;

  async function watch() {
    const result = await quota.watchAdForSlot();
    if (result === 'granted') {
      setJustGranted(true);
      setTimeout(() => setJustGranted(false), 4000);
    } else if (result === 'unavailable') {
      Alert.alert(t('quota.adUnavailable'));
    }
  }

  return (
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: radius.sm,
            backgroundColor: '#FCF3E2',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="play-circle" size={20} color="#B98200" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.body, { color: colors.text, fontWeight: '600', textAlign }]}>
            {t('settings.freeSlotsTitle')}
          </Text>
          <Text style={[type.caption, { color: colors.textMuted, textAlign }]}>
            {canWatch ? t('settings.freeSlotsBody') : t('quota.bonusMaxed')}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Text style={[type.caption, { color: colors.textMuted, flex: 1, textAlign }]}>
          {t('settings.slotsUsed', { used: quota.used, limit: quota.limit })}
        </Text>
        <Pressable
          accessibilityRole="button"
          disabled={!canWatch || quota.adLoading}
          onPress={() => void watch()}
          style={({ pressed }) => ({
            minHeight: 44,
            paddingHorizontal: spacing.lg,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: !canWatch ? 0.45 : pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 14 }}>
            {justGranted
              ? t('quota.bonusGranted')
              : quota.adLoading
                ? t('quota.watchAdLoading')
                : t('quota.watchAd')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
