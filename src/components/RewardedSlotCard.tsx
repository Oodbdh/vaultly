import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing, typeScale } from '@/theme';
import { useDirection } from '@/i18n/rtl';
import { FREE_MAX_SLOTS } from '@/constants/config';
import { useItemQuota } from '@/hooks/useItemQuota';
import { usePremium } from '@/hooks/usePremium';

/**
 * Rewarded-ad trigger. Rendered only for free users — the premium branch returns
 * null, which is how "completely ad-free" is guaranteed at the UI layer too.
 *
 * The ad is offered exactly once per account. Once the permanent slot is
 * claimed the card stays visible to confirm the new ceiling, but the button is
 * gone entirely — there is no second reward to offer, now or later.
 */
export function RewardedSlotCard() {
  const { t } = useTranslation();
  const { locale, textAlign } = useDirection();
  const type = typeScale(locale);
  const { isPremium } = usePremium();
  const quota = useItemQuota();
  const [justGranted, setJustGranted] = useState(false);

  if (isPremium) return null;

  const canWatch = quota.canWatchAd;

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
            {canWatch ? t('settings.freeSlotsTitle') : t('settings.freeSlotsClaimedTitle')}
          </Text>
          <Text style={[type.caption, { color: colors.textMuted, textAlign }]}>
            {canWatch
              ? t('settings.freeSlotsBody')
              : t('settings.freeSlotsClaimedBody', { limit: FREE_MAX_SLOTS })}
          </Text>
        </View>
      </View>

      {/* Caption and action share a line when both fit, and the action drops to
          its own full-width line when they do not.

          `flex: 1` on the caption used to mean flexBasis 0, so the caption
          collapsed towards nothing while the button — sized to a label that
          runs from 34 characters in Arabic to 46 in French — took the row and
          overflowed the card. Arabic has the shortest string of the five, which
          is the only reason it looked balanced. Giving the caption an `auto`
          basis with a floor, and letting the row wrap, makes the result depend
          on the space actually available rather than on how terse the language
          happens to be. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          flexWrap: 'wrap',
        }}
      >
        <Text
          style={[
            type.caption,
            {
              color: colors.textMuted,
              flexGrow: 1,
              flexShrink: 1,
              flexBasis: 'auto',
              minWidth: 110,
              textAlign,
            },
          ]}
        >
          {t('settings.slotsUsed', { used: quota.used, limit: quota.limit })}
        </Text>
        {/* Confirmation wins over the button: the quota refetch lands a moment
            after the grant, so `canWatch` is briefly still true. No button at
            all once the reward is claimed — the offer is gone for good. */}
        {justGranted ? (
          <Text
            numberOfLines={2}
            style={{
              color: colors.success,
              fontWeight: '600',
              fontSize: 14,
              flexShrink: 1,
              textAlign,
            }}
          >
            {t('quota.bonusGranted')}
          </Text>
        ) : canWatch ? (
          <Pressable
            accessibilityRole="button"
            disabled={quota.adLoading}
            onPress={() => void watch()}
            style={({ pressed }) => ({
              minHeight: 44,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 1,
              maxWidth: '100%',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              numberOfLines={2}
              style={{
                color: colors.primary,
                fontWeight: '600',
                fontSize: 14,
                textAlign: 'center',
              }}
            >
              {quota.adLoading ? t('quota.watchAdLoading') : t('quota.watchAd')}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
