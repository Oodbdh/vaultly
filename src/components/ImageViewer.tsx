import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StatusBar,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@/theme';

/**
 * Full-screen receipt viewer: pinch to zoom, double-tap to toggle, drag to pan
 * while zoomed, swipe down to dismiss.
 *
 * Built on RN's own `Animated` + `PanResponder` rather than
 * gesture-handler/reanimated. Those two are the usual answer, but they are
 * heavyweight native additions and reanimated needs a babel plugin — a lot of
 * moving parts for one screen. Everything here ships with React Native.
 *
 * The image is rendered from the same full-resolution source the detail card
 * uses, with `contain`, so nothing is downscaled or re-encoded.
 */

const MAX_SCALE = 4;
const MIN_SCALE = 1;
/** Scale a double-tap jumps to. */
const DOUBLE_TAP_SCALE = 2.5;
/** Vertical travel, in px, that dismisses when not zoomed. */
const DISMISS_DISTANCE = 120;
const TAP_SLOP = 12;
const TAP_MS = 250;
const DOUBLE_TAP_MS = 300;

function distance(touches: { pageX: number; pageY: number }[]): number {
  const [a, b] = touches;
  if (!a || !b) return 0;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}

export function ImageViewer({
  uri,
  visible,
  onClose,
}: {
  uri: string | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  // Hook, not Dimensions.get — the bounds maths has to follow a rotation.
  const window = useWindowDimensions();

  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const backdrop = useRef(new Animated.Value(1)).current;

  // Animated.Value has no synchronous getter, so the current numbers are
  // mirrored here for the gesture maths.
  const cur = useRef({ scale: 1, x: 0, y: 0 });
  const start = useRef({
    scale: 1,
    x: 0,
    y: 0,
    distance: 0,
    t: 0,
    moved: 0,
    /** Touch count the current baseline was taken at. */
    touches: 0,
    /** Gesture delta when the baseline was taken, so re-baselining is seamless. */
    dx: 0,
    dy: 0,
  });
  const lastTap = useRef(0);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  // Intrinsic size, so pan bounds match the letterboxed `contain` box rather
  // than the whole screen — otherwise you can drag the image off into space.
  useEffect(() => {
    if (!uri) return;
    let alive = true;
    Image.getSize(
      uri,
      (width, height) => alive && setSize({ width, height }),
      () => alive && setSize(null),
    );
    return () => {
      alive = false;
    };
  }, [uri]);

  /** The on-screen box of the image at scale 1 under `contain`. */
  const fitted = useMemo(() => {
    if (!size || !size.width || !size.height) return { width: window.width, height: window.height };
    const ratio = Math.min(window.width / size.width, window.height / size.height);
    return { width: size.width * ratio, height: size.height * ratio };
  }, [size, window.width, window.height]);

  function reset(animated = true) {
    cur.current = { scale: 1, x: 0, y: 0 };
    if (!animated) {
      scale.setValue(1);
      translateX.setValue(0);
      translateY.setValue(0);
      backdrop.setValue(1);
      return;
    }
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, bounciness: 0 }),
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 0 }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 0 }),
      Animated.timing(backdrop, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  }

  // A re-opened viewer must not inherit the previous zoom.
  useEffect(() => {
    if (visible) reset(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  /** How far the image may travel at a given scale before showing empty space. */
  function bounds(atScale: number) {
    return {
      x: Math.max(0, (fitted.width * atScale - window.width) / 2),
      y: Math.max(0, (fitted.height * atScale - window.height) / 2),
    };
  }

  function clampTo(atScale: number, x: number, y: number) {
    const b = bounds(atScale);
    return {
      x: Math.min(b.x, Math.max(-b.x, x)),
      y: Math.min(b.y, Math.max(-b.y, y)),
    };
  }

  function zoomTo(next: number) {
    const target = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
    const p = target === MIN_SCALE ? { x: 0, y: 0 } : clampTo(target, cur.current.x, cur.current.y);
    cur.current = { scale: target, ...p };
    Animated.parallel([
      Animated.spring(scale, { toValue: target, useNativeDriver: true, bounciness: 0 }),
      Animated.spring(translateX, { toValue: p.x, useNativeDriver: true, bounciness: 0 }),
      Animated.spring(translateY, { toValue: p.y, useNativeDriver: true, bounciness: 0 }),
    ]).start();
  }

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (e, g) =>
          e.nativeEvent.touches.length > 1 ||
          cur.current.scale > 1 ||
          Math.abs(g.dy) > 6 ||
          Math.abs(g.dx) > 6,

        onPanResponderGrant: (e) => {
          const touches = e.nativeEvent.touches;
          start.current = {
            scale: cur.current.scale,
            x: cur.current.x,
            y: cur.current.y,
            distance: distance(touches as never),
            t: Date.now(),
            moved: 0,
            touches: touches.length,
            dx: 0,
            dy: 0,
          };
        },

        onPanResponderMove: (e, g) => {
          start.current.moved = Math.max(start.current.moved, Math.hypot(g.dx, g.dy));
          const touches = e.nativeEvent.touches;

          // Lifting one finger mid-pinch changes the gesture's meaning. Re-anchor
          // to where the image is *now*, or it snaps as pan takes over.
          if (touches.length !== start.current.touches) {
            start.current.touches = touches.length;
            start.current.scale = cur.current.scale;
            start.current.x = cur.current.x;
            start.current.y = cur.current.y;
            start.current.distance = distance(touches as never);
            start.current.dx = g.dx;
            start.current.dy = g.dy;
          }

          const dx = g.dx - start.current.dx;
          const dy = g.dy - start.current.dy;

          if (touches.length > 1) {
            const d = distance(touches as never);
            if (!start.current.distance) {
              start.current.distance = d;
              return;
            }
            const next = Math.min(
              MAX_SCALE,
              Math.max(MIN_SCALE * 0.8, (start.current.scale * d) / start.current.distance),
            );
            cur.current.scale = next;
            scale.setValue(next);
            return;
          }

          if (cur.current.scale > 1) {
            const p = clampTo(cur.current.scale, start.current.x + dx, start.current.y + dy);
            cur.current.x = p.x;
            cur.current.y = p.y;
            translateX.setValue(p.x);
            translateY.setValue(p.y);
            return;
          }

          // Not zoomed: a downward drag peels the viewer away, dimming with it.
          if (dy > 0) {
            translateY.setValue(dy);
            backdrop.setValue(Math.max(0.3, 1 - dy / (window.height * 0.6)));
          }
        },

        onPanResponderRelease: (e, g) => {
          const quick = Date.now() - start.current.t < TAP_MS;
          const still = start.current.moved < TAP_SLOP;

          if (quick && still) {
            const now = Date.now();
            if (now - lastTap.current < DOUBLE_TAP_MS) {
              lastTap.current = 0;
              zoomTo(cur.current.scale > 1.05 ? MIN_SCALE : DOUBLE_TAP_SCALE);
            } else {
              lastTap.current = now;
            }
            return;
          }

          if (cur.current.scale <= 1) {
            // Distance or a decisive flick both dismiss.
            if (g.dy - start.current.dy > DISMISS_DISTANCE || g.vy > 0.8) {
              onClose();
              return;
            }
            reset();
            return;
          }

          // Settle any pinch that overshot the limits.
          zoomTo(cur.current.scale);
        },

        onPanResponderTerminationRequest: () => false,
      }),
    // `fitted` feeds the clamp maths, so the responder is rebuilt when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fitted.width, fitted.height, window.width, window.height],
  );

  if (!uri) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      // Android hardware back closes the viewer, not the screen behind it.
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <StatusBar barStyle="light-content" />
      <Animated.View style={{ flex: 1, backgroundColor: '#000', opacity: backdrop }}>
        <View style={{ flex: 1 }} {...responder.panHandlers}>
          <Animated.Image
            source={{ uri }}
            // `contain` at the source resolution — nothing is cropped or resampled.
            resizeMode="contain"
            style={{
              width: '100%',
              height: '100%',
              transform: [{ translateX }, { translateY }, { scale }],
            }}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={onClose}
          hitSlop={12}
          style={{
            position: 'absolute',
            top: spacing.xxl,
            end: spacing.xl,
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.45)',
          }}
        >
          <Ionicons name="close" size={22} color={colors.surface} />
        </Pressable>
      </Animated.View>
    </Modal>
  );
}
