import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { PressableCard } from '@/components/PressableCard';
import { RenewalCountdown } from '@/components/RenewalCountdown';
import { SkeletonBlock, SkeletonList } from '@/components/Skeleton';
import { WarrantyCountdown } from '@/components/WarrantyCountdown';
import { resolveStatus, StatusBadge } from '@/components/StatusBadge';
import { colors, radius, spacing, typeScale } from '@/theme';
import { useDirection, formatCurrency, formatDate } from '@/i18n/rtl';
import { useDeleteItem, useItem } from '@/hooks/useItems';
import { signedReceiptUrl } from '@/services/storage';
import { scheduleWarrantyReminders } from '@/services/notifications';

/**
 * Wallet-style detail: the artefact itself fills the top of the screen, and
 * everything factual sits beneath it in one quiet card. Actions come last —
 * you look before you act.
 */
export default function ItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { locale, textAlign, flipIcon } = useDirection();
  const type = typeScale(locale);
  const router = useRouter();
  const { data: item, isLoading } = useItem(id!);
  const del = useDeleteItem();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [reminderSet, setReminderSet] = useState(false);

  useEffect(() => {
    if (item?.image_path) void signedReceiptUrl(item.image_path).then(setImageUrl).catch(() => {});
  }, [item?.image_path]);

  if (isLoading || !item) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.xl, gap: spacing.lg }}>
        <SkeletonBlock width="100%" height={300} round={radius.lg} />
        <SkeletonList count={2} />
      </View>
    );
  }

  // Bound after the loading guard: the handlers below are hoisted declarations,
  // so they don't inherit the narrowing that `if (!item) return` gives the JSX.
  const vaultItem = item;
  const expiresOn = item.warranty?.expires_on ?? null;
  const sub = item.subscription ?? null;
  const { status, days } = resolveStatus({
    kind: item.kind,
    warrantyExpiresOn: expiresOn,
    nextRenewal: sub?.next_renewal ?? null,
    ocrConfidence: item.ocr_confidence,
  });

  function confirmDelete() {
    Alert.alert(t('item.deleteConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => del.mutate(vaultItem.id, { onSuccess: () => router.back() }),
      },
    ]);
  }

  async function share() {
    if (!imageUrl) return;
    await Share.share({ url: imageUrl, message: `${vaultItem.merchant_name} — Vaultly` });
  }

  async function remindMe() {
    if (!expiresOn) return;
    await scheduleWarrantyReminders({
      itemId: vaultItem.id,
      merchant: vaultItem.merchant_name,
      expiresOn,
    });
    setReminderSet(true);
  }

  /** Actions are derived from state, not hard-coded. */
  const actions = [
    !expiresOn && !sub && {
      key: 'addWarranty',
      icon: 'shield-outline' as const,
      label: t('actions.addWarranty'),
      onPress: () =>
        router.push({
          pathname: '/item/add-warranty',
          params: { product: item.merchant_name, date: item.purchase_date ?? '' },
        }),
      primary: true,
    },
    expiresOn && status !== 'expired' && {
      key: 'remind',
      icon: 'notifications-outline' as const,
      label: reminderSet ? t('actions.reminderSet') : t('actions.setReminder'),
      onPress: () => void remindMe(),
      primary: true,
    },
    status === 'expired' && {
      key: 'claim',
      icon: 'help-buoy-outline' as const,
      label: t('actions.claimWarranty'),
      onPress: () => Alert.alert(t('actions.claimWarranty')),
      primary: true,
    },
    imageUrl && {
      key: 'share',
      icon: 'share-outline' as const,
      label: t('actions.shareReceipt'),
      onPress: () => void share(),
    },
  ].filter(Boolean) as {
    key: string;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
    primary?: boolean;
  }[];

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      />
      <ScrollView
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: spacing.xl, paddingTop: 0, gap: spacing.lg, paddingBottom: spacing.xxl * 2 }}
        showsVerticalScrollIndicator={false}
      >
        {/* The artefact, large — Wallet leads with the pass, not with metadata */}
        <PressableCard
          onPress={imageUrl ? () => {} : undefined}
          accessibilityLabel={t('actions.viewReceipt')}
          style={{ padding: 0, overflow: 'hidden', height: 320 }}
        >
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          ) : (
            <View
              style={{
                flex: 1,
                backgroundColor: '#F1F0EC',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.sm,
              }}
            >
              <Ionicons
                name={sub ? 'card-outline' : 'receipt-outline'}
                size={34}
                color={colors.textMuted}
              />
              <Text style={[type.caption, { color: colors.textMuted }]}>
                {t('item.receiptImage')}
              </Text>
            </View>
          )}
        </PressableCard>

        <View style={{ gap: spacing.sm }}>
          <Text style={[type.title, { color: colors.text, textAlign }]}>{item.merchant_name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <StatusBadge status={status} days={days} />
            {item.total_amount != null ? (
              <Text style={[type.heading, { color: colors.text }]}>
                {formatCurrency(item.total_amount, locale, item.currency)}
              </Text>
            ) : null}
          </View>
        </View>

        {expiresOn ? (
          <WarrantyCountdown
            expiresOn={expiresOn}
            totalDays={(item.warranty?.duration_months ?? 12) * 30}
          />
        ) : null}

        {sub ? (
          <RenewalCountdown
            nextRenewal={sub.next_renewal}
            amount={Number(sub.amount)}
            currency={sub.currency}
            period={sub.period}
            autoRenews={sub.auto_renews}
          />
        ) : null}

        <View style={{ gap: spacing.sm }}>
          <Label>{t('detail.overview')}</Label>
          <View
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.lg,
              paddingHorizontal: spacing.lg,
            }}
          >
            <Detail label={t('item.merchant')} value={item.merchant_name} />
            <Divider />
            <Detail
              label={t('item.purchaseDate')}
              value={item.purchase_date ? formatDate(item.purchase_date, locale) : '—'}
            />
            <Divider />
            <Detail
              label={t('item.total')}
              value={
                item.total_amount != null
                  ? formatCurrency(item.total_amount, locale, item.currency)
                  : '—'
              }
            />
            <Divider />
            <Detail label={t('item.category')} value={item.category ?? '—'} />
            <Divider />
            <Detail
              label={t('item.warrantyExpiry')}
              value={expiresOn ? formatDate(expiresOn, locale) : t('warranty.noWarranty')}
            />
            {item.notes ? (
              <>
                <Divider />
                <Detail label={t('item.notes')} value={item.notes} />
              </>
            ) : null}
          </View>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Label>{t('detail.actions')}</Label>
          <View style={{ gap: spacing.md }}>
            {actions.map((a) => (
              <Pressable
                key={a.key}
                accessibilityRole="button"
                onPress={a.onPress}
                style={({ pressed }) => ({
                  minHeight: 54,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingHorizontal: spacing.lg,
                  borderRadius: radius.md,
                  backgroundColor: a.primary ? colors.primary : colors.surface,
                  borderWidth: a.primary ? 0 : 1,
                  borderColor: colors.border,
                  opacity: pressed ? 0.88 : 1,
                })}
              >
                <Ionicons
                  name={a.icon}
                  size={19}
                  color={a.primary ? colors.primaryText : colors.primary}
                />
                <Text
                  style={{
                    flex: 1,
                    color: a.primary ? colors.primaryText : colors.text,
                    fontWeight: '600',
                    fontSize: locale === 'ar' ? 17 : 16,
                    textAlign,
                  }}
                >
                  {a.label}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={17}
                  color={a.primary ? 'rgba(255,255,255,0.5)' : colors.border}
                  style={flipIcon}
                />
              </Pressable>
            ))}

            <Pressable
              accessibilityRole="button"
              onPress={confirmDelete}
              style={({ pressed }) => ({
                minHeight: 54,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={{ color: colors.danger, fontWeight: '600', fontSize: 16 }}>
                {t('common.delete')}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </>
  );

  function Divider() {
    return <View style={{ height: 1, backgroundColor: colors.border }} />;
  }

  function Label({ children }: { children: React.ReactNode }) {
    return (
      <Text
        style={[
          type.caption,
          {
            color: colors.textMuted,
            textAlign,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            fontWeight: '700',
            paddingHorizontal: spacing.xs,
          },
        ]}
      >
        {children}
      </Text>
    );
  }

  function Detail({ label, value }: { label: string; value: string }) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.lg,
          minHeight: 50,
          paddingVertical: spacing.sm,
        }}
      >
        <Text style={[type.body, { color: colors.textMuted, textAlign }]}>{label}</Text>
        <Text
          style={[
            type.body,
            {
              color: colors.text,
              fontWeight: '600',
              flex: 1,
              // trailing edge, whichever side that is
              textAlign: locale === 'ar' ? 'left' : 'right',
            },
          ]}
          numberOfLines={2}
        >
          {value}
        </Text>
      </View>
    );
  }
}
