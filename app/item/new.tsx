import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { DetectionSheet } from '@/components/DetectionSheet';
import { Field } from '@/components/Field';
import { ReceiptScanner } from '@/components/ReceiptScanner';
import {
  DEFAULT_CHOICE,
  WarrantyDurationPicker,
  resolveDurationMonths,
  resolveExpiry,
  type WarrantyChoice,
} from '@/components/WarrantyDurationPicker';
import { colors, radius, spacing, typeScale } from '@/theme';
import { useDirection } from '@/i18n/rtl';
import { useCreateItem } from '@/hooks/useItems';
import { useItemQuota } from '@/hooks/useItemQuota';
import { readAsBase64 } from '@/services/storage';
import {
  detectionPrompt,
  extractReceipt,
  needsWarrantyPrompt,
  renewalFromCycle,
  type ReceiptExtraction,
} from '@/services/ocr';

type Step = 'capture' | 'extracting' | 'review';

export default function NewItem() {
  const { t } = useTranslation();
  const { locale, textAlign, flipIcon } = useDirection();
  const type = typeScale(locale);
  const router = useRouter();
  const quota = useItemQuota();
  const create = useCreateItem(() => router.replace('/paywall'));

  const [step, setStep] = useState<Step>('capture');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<ReceiptExtraction | null>(null);
  const [merchant, setMerchant] = useState('');
  const [total, setTotal] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [warranty, setWarranty] = useState<WarrantyChoice>(DEFAULT_CHOICE);
  const [detected, setDetected] = useState<'subscription' | 'product' | null>(null);

  // The DB enforces the limit too; this just avoids a wasted scan.
  useEffect(() => {
    if (!quota.isLoading && !quota.gate.allowed) router.replace('/paywall');
  }, [quota.isLoading, quota.gate.allowed, router]);

  async function pickFromLibrary() {
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (res.canceled || !res.assets[0]) return;
    void onCaptured(res.assets[0].uri);
  }

  async function onCaptured(uri: string) {
    setImageUri(uri);
    setStep('extracting');
    const base64 = await readAsBase64(uri);
    const result = await extractReceipt(base64);

    if (!result.ok) {
      setStep('review'); // fall through to manual entry rather than dead-ending
      Alert.alert(t('scan.failed'), undefined, [{ text: t('scan.enterManually') }]);
      return;
    }

    const d = result.data;
    setExtraction(d);
    setMerchant(d.merchantName ?? '');
    setTotal(d.totalAmount != null ? String(d.totalAmount) : '');
    setPurchaseDate(d.purchaseDate ?? '');
    // A stated term becomes the selected duration, even if it isn't a preset.
    if (d.warrantyMonths) {
      setWarranty({
        mode: 'custom',
        duration: { amount: String(d.warrantyMonths), unit: 'month' },
      });
    }
    setStep('review');
    // Ask once what kind of purchase this is, rather than guessing silently.
    setDetected(detectionPrompt(d));
  }

  /** Hand everything the model read to the matching form; the user fills the rest. */
  function acceptDetection() {
    const d = extraction;
    if (!d) return;
    setDetected(null);
    if (d.purchaseType === 'subscription') {
      router.replace({
        pathname: '/item/add-subscription',
        params: {
          name: d.serviceName ?? d.merchantName ?? '',
          merchant: d.merchantName ?? '',
          amount: d.totalAmount != null ? String(d.totalAmount) : '',
          cycle: d.billingCycle ?? 'monthly',
          renewal: d.nextRenewal ?? renewalFromCycle(d.purchaseDate, d.billingCycle ?? 'monthly'),
          imageUri: imageUri ?? '',
        },
      });
      return;
    }
    router.replace({
      pathname: '/item/add-warranty',
      params: {
        product: d.productName ?? '',
        merchant: d.merchantName ?? '',
        amount: d.totalAmount != null ? String(d.totalAmount) : '',
        date: d.purchaseDate ?? '',
        imageUri: imageUri ?? '',
      },
    });
  }

  function save() {
    // A date printed on the receipt beats anything inferred from a duration.
    const expiresOn = extraction?.warrantyExpiry ?? resolveExpiry(warranty, purchaseDate);

    create.mutate(
      {
        kind: 'receipt',
        // For a receipt these two mean exactly what they say: the shop, and the
        // class of goods. `normalise()` has already rejected any category that
        // is not on the canonical list, so a shop name cannot land here.
        merchantName: merchant.trim() || t('item.merchant'),
        category: extraction?.category ?? null,
        totalAmount: total ? Number(total) : null,
        currency: extraction?.currency ?? 'SAR',
        purchaseDate: purchaseDate || null,
        localImageUri: imageUri,
        warranty: expiresOn
          ? { expiresOn, durationMonths: resolveDurationMonths(warranty) }
          : null,
        ocr: extraction ? { raw: extraction, confidence: extraction.confidence } : null,
      },
      { onSuccess: () => router.back() },
    );
  }

  if (step === 'capture') {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: '#000' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              paddingHorizontal: spacing.lg,
              paddingBottom: spacing.md,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              onPress={() => router.back()}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="close" size={26} color="#fff" />
            </Pressable>
            <Text style={[type.heading, { color: '#fff', flex: 1, textAlign }]}>
              {t('scan.title')}
            </Text>
          </View>
        </SafeAreaView>
        <ReceiptScanner onCaptured={onCaptured} onPickFromLibrary={pickFromLibrary} />
      </View>
    );
  }

  if (step === 'extracting') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg }}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={{
                width: 180,
                height: 240,
                borderRadius: radius.lg,
                backgroundColor: colors.border,
              }}
              resizeMode="cover"
            />
          ) : null}
          <ActivityIndicator />
          <Text style={[type.body, { color: colors.textMuted }]}>{t('scan.extracting')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const askWarranty = !extraction || needsWarrantyPrompt(extraction);
  const lowConfidence = !!extraction && extraction.confidence < 0.6;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.sm,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('scan.retake')}
          onPress={() => setStep('capture')}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} style={flipIcon} />
        </Pressable>
        <Text style={[type.caption, { color: colors.textMuted, flex: 1, textAlign }]}>
          {t('scan.reviewStep', { current: 2, total: 2 })}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingTop: 0, gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' }}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={{
                width: 92,
                height: 122,
                borderRadius: radius.md,
                backgroundColor: colors.border,
              }}
              resizeMode="cover"
            />
          ) : null}
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text style={[type.heading, { color: colors.text, textAlign }]}>
              {t('scan.extractedTitle')}
            </Text>
            <Text
              style={[
                type.caption,
                { color: lowConfidence ? '#8A5A00' : colors.textMuted, textAlign },
              ]}
            >
              {lowConfidence ? t('scan.confidenceLow') : t('scan.extractedHint')}
            </Text>
            <Pressable onPress={() => setStep('capture')} accessibilityRole="button">
              <Text style={[type.caption, { color: colors.primary, fontWeight: '600', textAlign }]}>
                {t('actions.rescan')}
              </Text>
            </Pressable>
          </View>
        </View>

        <Field label={t('item.merchant')} value={merchant} onChangeText={setMerchant} />
        <Field
          label={`${t('item.total')} (${t('common.sar')})`}
          value={total}
          onChangeText={setTotal}
          keyboardType="decimal-pad"
        />
        <Field
          label={t('item.purchaseDate')}
          value={purchaseDate}
          onChangeText={setPurchaseDate}
          placeholder="2026-07-28"
        />

        {askWarranty ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={[type.body, { color: colors.text, fontWeight: '600', textAlign }]}>
              {t('warranty.askDurationTitle')}
            </Text>
            <Text style={[type.caption, { color: colors.textMuted, textAlign }]}>
              {t('warranty.askDurationHint')}
            </Text>
            <WarrantyDurationPicker
              value={warranty}
              onChange={setWarranty}
              purchaseDate={purchaseDate}
              allowNone
            />
          </View>
        ) : null}

        <Button
          label={create.isPending ? t('common.loading') : t('common.save')}
          disabled={create.isPending}
          onPress={save}
        />
      </ScrollView>

      {detected ? (
        <DetectionSheet
          open
          detected={detected}
          onConfirm={acceptDetection}
          onDismiss={() => setDetected(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}
