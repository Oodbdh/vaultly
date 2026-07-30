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
          <Text style={[type.body, { color: colors.text, textAlign }]}>{t('quota.limitBody')}</Text>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            {quota.gate.allowed === false && quota.gate.canWatchAd ? (
              <Button
                variant="secondary"
                style={{ flex: 1 }}
                disabled={quota.adLoading}
                label={quota.adLoading ? t('quota.watchAdLoading') : t('quota.watchAd')}
                onPress={() => void quota.watchAdForSlot()}
              />
            ) : null}
            <Button style={{ flex: 1 }} label={t('paywall.cta')} onPress={quota.openPaywall} />
          </View>
        </>
      ) : null}
    </View>
  );
}
