import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from './Button';
import { colors, radius, spacing, typeScale } from '@/theme';
import { useDirection } from '@/i18n/rtl';
import { useItemQuota } from '@/hooks/useItemQuota';

/**
 * Free-tier quota strip. Renders nothing for premium users — which is also how
 * the "completely ad-free" promise is kept: no quota strip, no ad affordance.
 */
export function QuotaBanner() {
  const { t } = useTranslation();
  const { locale, textAlign } = useDirection();
  const type = typeScale(locale);
  const quota = useItemQuota();

  if (quota.isPremium) return null;

  const atLimit = quota.remaining === 0;

  return (
    <View
      style={{
        backgroundColor: atLimit ? '#FDF3F2' : colors.surface,
        borderWidth: 1,
        borderColor: atLimit ? '#F2D6D4' : colors.border,
        borderRadius: radius.md,
        padding: spacing.lg,
        gap: spacing.md,
      }}
    >
      <Text style={[type.caption, { color: colors.textMuted, textAlign }]}>
        {t('quota.banner', { used: quota.used, limit: quota.limit })}
      </Text>

      {atLimit ? (
        <>
          {/* Once the one-off slot is claimed the ad is never mentioned again —
              at that point Premium is the only way past the limit. */}
          <Text style={[type.body, { color: colors.text, textAlign }]}>
            {quota.canWatchAd
              ? t('quota.limitBody')
              : t('quota.limitBodyFinal', { limit: quota.limit })}
          </Text>
          {/* `alignItems: stretch` (the default) is what keeps the two the same
              height once one of them wraps; `flexBasis: 0` with `minWidth: 0`
              is what keeps them the same *width*. Without the explicit basis a
              long label inflates its button's intrinsic width and `flex: 1`
              divides the remainder, so the pair came out lopsided in every
              language whose CTA is longer than Arabic's. */}
          <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: spacing.md }}>
            {quota.gate.allowed === false && quota.gate.canWatchAd ? (
              <Button
                variant="secondary"
                style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 }}
                disabled={quota.adLoading}
                label={quota.adLoading ? t('quota.watchAdLoading') : t('quota.watchAd')}
                onPress={() => void quota.watchAdForSlot()}
              />
            ) : null}
            <Button
              style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 }}
              label={t('paywall.cta')}
              onPress={quota.openPaywall}
            />
          </View>
        </>
      ) : null}
    </View>
  );
}
