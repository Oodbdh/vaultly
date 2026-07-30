import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing, typeScale } from '@/theme';
import { useDirection } from '@/i18n/rtl';
import { useUIStore } from '@/store/uiStore';
import { useItemQuota } from '@/hooks/useItemQuota';

type Action = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  bg: string;
  title: string;
  hint: string;
  // `typedRoutes` is on, so destinations are checked against the route tree.
  route: Href;
};

/**
 * The "+" sheet. Three ways into the vault; the FAB never launches the camera
 * directly, so adding a warranty or subscription by hand is a first-class path.
 */
export function AddSheet() {
  const { t } = useTranslation();
  const { locale, textAlign, flipIcon } = useDirection();
  const type = typeScale(locale);
  const router = useRouter();
  const { addSheetOpen, closeAddSheet } = useUIStore();
  const quota = useItemQuota();

  // Staggered rise: sheet slides up, rows fade in just behind it.
  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(slide, {
      toValue: addSheetOpen ? 1 : 0,
      duration: addSheetOpen ? 260 : 180,
      easing: addSheetOpen ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [addSheetOpen, slide]);

  const actions: Action[] = [
    {
      key: 'scan',
      icon: 'scan-outline',
      tint: colors.primary,
      bg: '#EDF0F6',
      title: t('addSheet.scanReceipt'),
      hint: t('addSheet.scanReceiptHint'),
      route: '/item/new',
    },
    {
      key: 'warranty',
      icon: 'shield-checkmark-outline',
      tint: colors.success,
      bg: '#EAF4EF',
      title: t('addSheet.addWarranty'),
      hint: t('addSheet.addWarrantyHint'),
      route: '/item/add-warranty',
    },
    {
      key: 'subscription',
      icon: 'card-outline',
      tint: '#B98200',
      bg: '#FCF3E2',
      title: t('addSheet.addSubscription'),
      hint: t('addSheet.addSubscriptionHint'),
      route: '/item/add-subscription',
    },
  ];

  function go(route: Href) {
    closeAddSheet();
    // Quota is checked once, here, rather than in each destination screen.
    setTimeout(() => router.push(quota.gate.allowed ? route : '/paywall'), 180);
  }

  return (
    <Modal visible={addSheetOpen} transparent animationType="fade" onRequestClose={closeAddSheet}>
      <Pressable
        accessibilityLabel={t('common.close')}
        onPress={closeAddSheet}
        style={{ flex: 1, backgroundColor: 'rgba(10,12,18,0.45)', justifyContent: 'flex-end' }}
      >
        <Animated.View
          style={{
            transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [340, 0] }) }],
          }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: colors.bg,
              borderTopStartRadius: 28,
              borderTopEndRadius: 28,
              padding: spacing.xl,
              paddingBottom: spacing.xxl + spacing.lg,
              gap: spacing.md,
            }}
          >
            <View
              style={{
                width: 42,
                height: 4,
                borderRadius: radius.pill,
                backgroundColor: colors.border,
                alignSelf: 'center',
                marginBottom: spacing.sm,
              }}
            />
            <Text style={[type.heading, { color: colors.text, textAlign, marginBottom: spacing.xs }]}>
              {t('addSheet.title')}
            </Text>

            {actions.map((a, i) => (
              <Animated.View
                key={a.key}
                style={{
                  opacity: slide,
                  transform: [
                    {
                      translateY: slide.interpolate({
                        inputRange: [0, 1],
                        outputRange: [18 + i * 8, 0],
                      }),
                    },
                  ],
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  onPress={() => go(a.route)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.lg,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: radius.lg,
                    padding: spacing.lg,
                    transform: [{ scale: pressed ? 0.985 : 1 }],
                  })}
                >
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: radius.md,
                      backgroundColor: a.bg,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name={a.icon} size={26} color={a.tint} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[type.body, { color: colors.text, fontWeight: '700', textAlign }]}>
                      {a.title}
                    </Text>
                    <Text style={[type.caption, { color: colors.textMuted, textAlign }]}>
                      {a.hint}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.border} style={flipIcon} />
                </Pressable>
              </Animated.View>
            ))}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
