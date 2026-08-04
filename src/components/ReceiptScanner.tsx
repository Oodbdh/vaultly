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

      <View style={StyleSheet.absoluteFill}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {/* dim everything outside the capture window */}
          <View style={{ flex: 1, alignSelf: 'stretch', backgroundColor: 'rgba(0,0,0,0.55)' }} />
          <View style={{ flexDirection: 'row', alignSelf: 'stretch', height: frameHeight }}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} />
            <View
              style={{
                width: frameWidth,
                borderRadius: radius.lg,
                borderWidth: 2,
                borderColor: 'rgba(255,255,255,0.9)',
              }}
            />
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} />
          </View>
          <View
            style={{
              flex: 1,
              alignSelf: 'stretch',
              backgroundColor: 'rgba(0,0,0,0.55)',
              alignItems: 'center',
              paddingTop: spacing.xl,
              gap: spacing.xl,
            }}
          >
            <Text
              style={[
                type.body,
                { color: '#fff', textAlign: 'center', paddingHorizontal: spacing.xl },
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
