import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
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

/**
 * Manual warranty entry — no receipt required. Also the landing point when a
 * scan is classified as a product purchase.
 */
export default function AddWarranty() {
  const { t } = useTranslation();
  const { locale, textAlign } = useDirection();
  const type = typeScale(locale);
  const router = useRouter();
  const params = useLocalSearchParams<{
    product?: string;
    merchant?: string;
    amount?: string;
    date?: string;
    imageUri?: string;
  }>();

  const prefilled = !!params.product || !!params.merchant;
  const [productName, setProductName] = useState(params.product ?? '');
  const [merchant, setMerchant] = useState(params.merchant ?? '');
  const [amount, setAmount] = useState(params.amount ?? '');
  const [purchaseDate, setPurchaseDate] = useState(
    params.date ?? new Date().toISOString().slice(0, 10),
  );
  const [choice, setChoice] = useState<WarrantyChoice>(DEFAULT_CHOICE);

  const create = useCreateItem(() => router.replace('/paywall'));
  const expiresOn = resolveExpiry(choice, purchaseDate);

  function save() {
    if (!expiresOn) return; // Save is disabled in this state; guard anyway.
    create.mutate(
      {
        kind: 'warranty',
        merchantName: productName.trim() || merchant.trim() || t('form.productName'),
        totalAmount: amount ? Number(amount) : null,
        purchaseDate,
        category: merchant.trim() || null,
        localImageUri: params.imageUri ?? null,
        warranty: { expiresOn, durationMonths: resolveDurationMonths(choice) },
      },
      { onSuccess: () => router.replace('/(tabs)/home') },
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: t('addSheet.addWarranty') }} />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
        <Text style={[type.title, { color: colors.text, textAlign }]}>
          {t('addSheet.addWarranty')}
        </Text>
        {prefilled ? (
          <View
            style={{
              backgroundColor: '#EAF4EF',
              borderWidth: 1,
              borderColor: '#CFE5DA',
              borderRadius: radius.md,
              padding: spacing.md,
            }}
          >
            <Text style={[type.caption, { color: colors.success, textAlign }]}>
              {t('detect.autoFilled')} · {t('detect.needsInput')}
            </Text>
          </View>
        ) : null}

        <Field label={t('form.productName')} value={productName} onChangeText={setProductName} />
        <Field label={t('item.merchant')} value={merchant} onChangeText={setMerchant} />
        <Field
          label={`${t('item.total')} (${t('common.sar')})`}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />
        <Field
          label={t('item.purchaseDate')}
          value={purchaseDate}
          onChangeText={setPurchaseDate}
          placeholder="2026-07-28"
        />

        <View style={{ gap: spacing.sm }}>
          <Text style={[type.caption, { color: colors.textMuted, textAlign }]}>
            {t('form.warrantyPeriod')}
          </Text>
          <WarrantyDurationPicker
            value={choice}
            onChange={setChoice}
            purchaseDate={purchaseDate}
          />
        </View>

        <Button
          label={create.isPending ? t('common.loading') : t('common.save')}
          disabled={create.isPending || !expiresOn}
          onPress={save}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
