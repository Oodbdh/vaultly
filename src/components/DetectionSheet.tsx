import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { Button } from './Button';
import { colors, radius, spacing, typeScale } from '@/theme';
import { useDirection } from '@/i18n/rtl';
import type { PurchaseType } from '@/services/ocr';

/**
 * Post-scan confirmation. The model classifies the receipt; we ask once, in the
 * user's own words, rather than silently filing it in the wrong place.
 */
export function DetectionSheet({
  open,
  detected,
  onConfirm,
  onDismiss,
}: {
  open: boolean;
  detected: Exclude<PurchaseType, 'unknown'>;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const { locale, textAlign } = useDirection();
  const type = typeScale(locale);
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(pop, {
      toValue: open ? 1 : 0,
      duration: open ? 240 : 150,
      easing: open ? Easing.out(Easing.back(1.3)) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [open, pop]);

  const isSub = detected === 'subscription';

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onDismiss}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(10,12,18,0.45)',
          justifyContent: 'center',
          padding: spacing.xl,
        }}
      >
        <Animated.View
          style={{
            opacity: pop,
            transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
          }}
        >
          <View
            style={{
              backgroundColor: colors.bg,
              borderRadius: 24,
              padding: spacing.xl,
              gap: spacing.md,
            }}
          >
            <View
              style={{
                width: 58,
                height: 58,
                borderRadius: radius.lg,
                backgroundColor: isSub ? '#FCF3E2' : '#EAF4EF',
                alignItems: 'center',
                justifyContent: 'center',
                alignSelf: 'flex-start',
              }}
            >
              <Ionicons
                name={isSub ? 'card-outline' : 'shield-checkmark-outline'}
                size={28}
                color={isSub ? '#B98200' : colors.success}
              />
            </View>

            <Text style={[type.heading, { color: colors.text, textAlign }]}>
              {isSub ? t('detect.subscriptionTitle') : t('detect.productTitle')}
            </Text>
            <Text style={[type.body, { color: colors.textMuted, textAlign }]}>
              {isSub ? t('detect.subscriptionBody') : t('detect.productBody')}
            </Text>

            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              <Button
                label={isSub ? t('detect.addSubscription') : t('detect.createWarranty')}
                onPress={onConfirm}
              />
              <Button variant="ghost" label={t('detect.notNow')} onPress={onDismiss} />
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
