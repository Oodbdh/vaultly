import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import {
  RenewalPicker,
  renewalFromParams,
  resolveRenewal,
  type RenewalChoice,
} from '@/components/RenewalPicker';
import { colors, radius, spacing, typeScale } from '@/theme';
import { useDirection } from '@/i18n/rtl';
import { useCreateSubscription } from '@/hooks/useCreateSubscription';
import type { BillingPeriod } from '@/lib/database.types';

/**
 * Manual subscription entry. Also the landing point when a scan is classified
 * as a subscription — everything the model read arrives as route params, so the
 * user only fills the gaps.
 */
export default function AddSubscription() {
  const { t } = useTranslation();
  const { locale, textAlign } = useDirection();
  const type = typeScale(locale);
  const router = useRouter();
  const params = useLocalSearchParams<{
    name?: string;
    merchant?: string;
    amount?: string;
    cycle?: BillingPeriod;
    renewal?: string;
    imageUri?: string;
  }>();

  const prefilled = !!params.name || !!params.amount;
  const [name, setName] = useState(params.name ?? '');
  const [amount, setAmount] = useState(params.amount ?? '');
  const [renewal, setRenewal] = useState<RenewalChoice>(() =>
    renewalFromParams(params.cycle, params.renewal),
  );

  const create = useCreateSubscription(() => router.replace('/paywall'));
  const nextRenewal = resolveRenewal(renewal);

  function save() {
    if (!nextRenewal) return; // Save is disabled in this state; guard anyway.
    create.mutate(
      {
        name: name.trim() || t('form.serviceName'),
        merchant: params.merchant ?? null,
        amount: amount ? Number(amount) : 0,
        period: renewal.period,
        nextRenewal,
        localImageUri: params.imageUri ?? null,
      },
      { onSuccess: () => router.replace('/(tabs)/home') },
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: t('addSheet.addSubscription') }} />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
        <Text style={[type.title, { color: colors.text, textAlign }]}>
          {t('addSheet.addSubscription')}
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

        <Field label={t('form.serviceName')} value={name} onChangeText={setName} placeholder="Netflix" />
        <Field
          label={`${t('item.total')} (${t('common.sar')})`}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />

        <View style={{ gap: spacing.sm }}>
          <Text style={[type.caption, { color: colors.textMuted, textAlign }]}>
            {t('form.billingCycle')}
          </Text>
          <RenewalPicker value={renewal} onChange={setRenewal} />
        </View>

        <Button
          label={create.isPending ? t('common.loading') : t('common.save')}
          disabled={create.isPending || !nextRenewal}
          onPress={save}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
