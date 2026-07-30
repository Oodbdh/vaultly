import { useRef, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { CameraView, useCameraPermissions, type CameraCapturedPicture } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { Button } from './Button';
import { colors, radius, spacing, typeScale } from '@/theme';
import { useDirection } from '@/i18n/rtl';

/**
 * Receipt scanner. The overlay is built from plain Views (four dimming panes +
 * corner marks) so it scales to any screen and needs no drawn assets.
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
  const { width, height } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  // Receipts are tall — a 3:4.4 window frames most of them without cropping.
  const frameWidth = Math.min(width - spacing.xl * 2, 420);
  const frameHeight = Math.min(frameWidth * 1.45, height * 0.56);

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
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" enableTorch={torch}>
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
      </CameraView>
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
