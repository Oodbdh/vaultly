import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

/**
 * Shimmering placeholder. Skeletons mirror the real card's silhouette so the
 * page doesn't reflow when data lands — a spinner would tell the user less and
 * move more.
 */
function useShimmer() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 850, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 850, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });
}

export function SkeletonBlock({
  width,
  height,
  round = radius.sm,
}: {
  width: number | `${number}%`;
  height: number;
  round?: number;
}) {
  const opacity = useShimmer();
  return (
    <Animated.View
      style={{ width, height, borderRadius: round, backgroundColor: '#ECEAE5', opacity }}
    />
  );
}

/** Card-shaped skeleton matching WarrantyCard / SubscriptionCard proportions. */
export function SkeletonCard({ lines = 2 }: { lines?: number }) {
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
        <SkeletonBlock width={44} height={44} round={radius.md} />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <SkeletonBlock width="70%" height={13} />
          <SkeletonBlock width="45%" height={11} />
        </View>
        <SkeletonBlock width={78} height={28} round={radius.md} />
      </View>
      {lines > 1 ? <SkeletonBlock width="100%" height={6} round={radius.pill} /> : null}
    </View>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <View style={{ gap: spacing.md }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}
