import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutRectangle } from 'react-native';
import { CameraView, useCameraPermissions, type CameraCapturedPicture } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { Button } from './Button';
import { colors, radius, spacing, typeScale } from '@/theme';
import { useDirection } from '@/i18n/rtl';

/**
 * Preview aspect ratio as width/height in portrait.
 *
 * Pinned with the `ratio` prop rather than left to the device, because the
 * cover maths below has to know it. Setting `ratio` switches the native preview
 * from FILL to FIT — which is exactly what we want here: sized to a true 16:9
 * box, FIT introduces no letterboxing of its own, and the parent does the
 * cropping instead. 16:9 is also the closest common sensor ratio to a modern
 * tall phone, so it crops the least.
 */
const PREVIEW_ASPECT = 9 / 16;

/**
 * Receipt scanner. The overlay is built from plain Views (four dimming panes +
 * corner marks) so it scales to any screen and needs no drawn assets.
 *
 * The preview is sized to **cover** its container rather than fit inside it.
 * A camera view simply told to `flex: 1` is handed a box whose aspect ratio is
 * the screen minus the header — around 0.48 on a tall phone — which no sensor
 * produces, so the preview letterboxes and the black backdrop shows through as
 * bars. Scaling to cover and clipping the overflow fills the area completely
 * while keeping the image's true proportions; nothing is stretched.
 *
 * The overlay is a sibling of the camera, not a child. As a child it would
 * inherit the deliberately oversized (clipped) frame and its own alignment
 * would be pushed off-screen with it.
 */
export function ReceiptScanner({
  onCaptured,
  onPickFromLibrary,
}: {
  onCaptured: (uri: string) => void;
  onPickFromLibrary: () => void;
}) {
  const { t } = useTranslation();
  const { locale } = useDirection();
  const type = typeScale(locale);
  const [box, setBox] = useState<LayoutRectangle | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  /** Smallest size at this aspect ratio that still covers the container. */
  const preview = useMemo(() => {
    if (!box?.width || !box.height) return null;
    const fillsByWidth = box.width / box.height > PREVIEW_ASPECT;
    const width = fillsByWidth ? box.width : box.height * PREVIEW_ASPECT;
    const height = fillsByWidth ? box.width / PREVIEW_ASPECT : box.height;
    // Centre the overflow so the crop is even on both sides.
    return { width, height, left: (box.width - width) / 2, top: (box.height - height) / 2 };
  }, [box]);

  // Receipts are tall — a 3:4.4 window frames most of them without cropping.
  // Measured from the container rather than the window, so the header above the
  // scanner does not push the frame off centre.
  const frameWidth = Math.min((box?.width ?? 0) - spacing.xl * 2, 420);
  const frameHeight = Math.min(frameWidth * 1.45, (box?.height ?? 0) * 0.56);

  if (!permission?.granted) {
    return (
      <View style={{ flex: 1, padding: spacing.xl, gap: spacing.lg, justifyContent: 'center' }}>
        <Ionicons name="camera-outline" size={40} color={colors.textMuted} />
        <Text style={[type.heading, { color: colors.text }]}>{t('scan.permissionTitle')}</Text>
        <Text style={[type.body, { color: colors.textMuted }]}>{t('scan.permissionBody')}</Text>
        <Button label={t('scan.grantPermission')} onPress={() => void requestPermission()} />
        <Button variant="secondary" label={t('scan.chooseFromLibrary')} onPress={onPickFromLibrary} />
      </View>
    );
  }

  async function capture() {
    if (busy) return;
    setBusy(true);
    try {
      const photo: CameraCapturedPicture | undefined = await cameraRef.current?.takePictureAsync({
        quality: 0.7,
        skipProcessing: false,
      });
      if (photo?.uri) onCaptured(photo.uri);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View
      style={{ flex: 1, backgroundColor: '#000', overflow: 'hidden' }}
      onLayout={(e) => setBox(e.nativeEvent.layout)}
    >
      {preview ? (
        <CameraView
          ref={cameraRef}
          style={{
            position: 'absolute',
            left: preview.left,
            top: preview.top,
            width: preview.width,
            height: preview.height,
          }}
          facing="back"
          enableTorch={torch}
          ratio="16:9"
        />
      ) : null}

      {/*
        Nothing here paints over the preview. The overlay used to dim
        everything outside the capture window with four rgba(0,0,0,0.55) panes,
        which meant most of the screen was 55% black and the camera looked
        broken rather than framed. The frame is a *guide*, not a crop - the
        captured photo has always been the full sensor frame - so hiding the
        rest of the image bought nothing and cost the user the ability to see
        what they were aiming at.

        Legibility now comes from shadows on the marks and text themselves,
        never from darkening the image behind them.
      */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          pointerEvents="box-none"
        >
          <View style={{ flex: 1 }} pointerEvents="none" />
          <GuideFrame width={frameWidth} height={frameHeight} />
          <View
            style={{
              flex: 1,
              alignSelf: 'stretch',
              alignItems: 'center',
              paddingTop: spacing.xl,
              gap: spacing.xl,
            }}
            pointerEvents="box-none"
          >
            <Text
              style={[
                type.body,
                {
                  color: '#fff',
                  textAlign: 'center',
                  paddingHorizontal: spacing.xl,
                  // Carries the text over a bright receipt without dimming it.
                  textShadowColor: 'rgba(0,0,0,0.85)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 4,
                },
              ]}
            >
              {t('scan.alignHint')}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xxl }}>
              <CircleButton
                icon="images-outline"
                label={t('scan.gallery')}
                onPress={onPickFromLibrary}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('scan.capture')}
                onPress={() => void capture()}
                style={({ pressed }) => ({
                  width: 74,
                  height: 74,
                  borderRadius: 37,
                  borderWidth: 4,
                  borderColor: 'rgba(255,255,255,0.55)',
                  backgroundColor: busy ? colors.textMuted : '#fff',
                  opacity: pressed ? 0.8 : 1,
                })}
              />
              <CircleButton
                icon={torch ? 'flash' : 'flash-off'}
                label={torch ? t('scan.flashOn') : t('scan.flashOff')}
                onPress={() => setTorch((v) => !v)}
              />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * Corner markers plus a hairline outline — the whole of the guide.
 *
 * A guide drawn on an undimmed preview has to survive being shown against a
 * white receipt, which is the usual case and the one where plain white marks
 * disappear. Each mark therefore carries its own drop shadow rather than
 * relying on a darkened backdrop. The outline is deliberately faint; the
 * corners are what the eye actually aligns to.
 */
function GuideFrame({ width, height }: { width: number; height: number }) {
  const ARM = 30;
  const THICK = 3;
  const shadow = {
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  } as const;

  const corners = [
    { top: 0, start: 0, borderTopWidth: THICK, borderStartWidth: THICK, borderTopStartRadius: radius.md },
    { top: 0, end: 0, borderTopWidth: THICK, borderEndWidth: THICK, borderTopEndRadius: radius.md },
    { bottom: 0, start: 0, borderBottomWidth: THICK, borderStartWidth: THICK, borderBottomStartRadius: radius.md },
    { bottom: 0, end: 0, borderBottomWidth: THICK, borderEndWidth: THICK, borderBottomEndRadius: radius.md },
  ];

  return (
    <View style={{ width, height }} pointerEvents="none">
      <View
        style={[
          StyleSheet.absoluteFillObject,
          { borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)' },
          shadow,
        ]}
      />
      {corners.map((c, i) => (
        <View
          key={i}
          style={[
            { position: 'absolute', width: ARM, height: ARM, borderColor: '#fff' },
            c,
            shadow,
          ]}
        />
      ))}
    </View>
  );
}

function CircleButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'rgba(255,255,255,0.16)',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={22} color="#fff" />
    </Pressable>
  );
}
