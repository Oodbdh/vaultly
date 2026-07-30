import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { InvoiceCard, SubscriptionCard, WarrantyCard } from '@/components/EntityCards';
import { SkeletonList } from '@/components/Skeleton';
import { colors, radius, spacing, typeScale } from '@/theme';
import { useDirection } from '@/i18n/rtl';
import { calendarDaysUntil } from '@/i18n/relativeTime';
import { useItems } from '@/hooks/useItems';
import type { ListItem } from '@/lib/types';

type Quick = 'all' | 'invoices' | 'warranties' | 'subscriptions' | 'expiring' | 'renewing';

const QUICK: Quick[] = ['all', 'invoices', 'warranties', 'subscriptions', 'expiring', 'renewing'];

/**
 * One search across all three types. The list pages filter within a type; this
 * answers "where did I put that?" without making the user guess the category
 * first — which is the whole reason a vault needs search.
 */
export default function Search() {
  const { t } = useTranslation();
  const { locale, textAlign } = useDirection();
  const type = typeScale(locale);
  const router = useRouter();
  const { data: items = [], isLoading } = useItems();

  const [query, setQuery] = useState('');
  const [quick, setQuick] = useState<Quick>('all');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = items;

    if (quick === 'invoices') out = out.filter((i) => i.kind === 'receipt');
    else if (quick === 'warranties') out = out.filter((i) => !!i.warranty_expires_on);
    else if (quick === 'subscriptions') out = out.filter((i) => !!i.next_renewal);
    else if (quick === 'expiring') {
      out = out.filter((i) => {
        if (!i.warranty_expires_on) return false;
        const d = calendarDaysUntil(i.warranty_expires_on);
        return d >= 0 && d <= 30;
      });
    } else if (quick === 'renewing') {
      out = out.filter((i) => {
        if (!i.next_renewal) return false;
        const d = calendarDaysUntil(i.next_renewal);
        return d >= 0 && d <= 30;
      });
    }

    if (q) {
      out = out.filter(
        (i) =>
          i.merchant_name.toLowerCase().includes(q) || (i.category ?? '').toLowerCase().includes(q),
      );
    }
    return out;
  }, [items, query, quick]);

  const active = !!query.trim() || quick !== 'all';

  function renderRow(item: ListItem) {
    if (item.warranty_expires_on) {
      return (
        <WarrantyCard
          productName={item.merchant_name}
          merchant={item.category}
          purchaseDate={item.purchase_date}
          expiresOn={item.warranty_expires_on}
          onPress={() => router.push(`/item/${item.id}`)}
        />
      );
    }
    if (item.next_renewal) {
      return (
        <SubscriptionCard
          name={item.merchant_name}
          period={item.sub_period ?? 'monthly'}
          nextRenewal={item.next_renewal}
          onPress={() => router.push(`/item/${item.id}`)}
        />
      );
    }
    return (
      <InvoiceCard
        merchant={item.merchant_name}
        purchaseDate={item.purchase_date}
        amount={item.total_amount}
        currency={item.currency}
        onPress={() => router.push(`/item/${item.id}`)}
      />
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: t('search.title'),
          headerBackTitle: t('nav.home'),
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      />
      <FlatList
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.md, paddingBottom: 120 }}
        data={rows}
        keyExtractor={(i) => i.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.xs }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.pill,
                paddingHorizontal: spacing.lg,
                minHeight: 50,
              }}
            >
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                autoFocus
                placeholder={t('search.placeholder')}
                placeholderTextColor={colors.textMuted}
                returnKeyType="search"
                style={{
                  flex: 1,
                  color: colors.text,
                  fontSize: locale === 'ar' ? 16 : 15,
                  textAlign,
                  writingDirection: locale === 'ar' ? 'rtl' : 'ltr',
                  paddingVertical: spacing.md,
                }}
              />
              {query ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('list.clear')}
                  onPress={() => setQuery('')}
                  hitSlop={8}
                >
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.sm, paddingEnd: spacing.lg }}
            >
              {QUICK.map((k) => {
                const on = quick === k;
                return (
                  <Pressable
                    key={k}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => setQuick(k)}
                    style={{
                      minHeight: 40,
                      justifyContent: 'center',
                      paddingHorizontal: spacing.lg,
                      borderRadius: radius.pill,
                      backgroundColor: on ? colors.primary : colors.surface,
                      borderWidth: 1,
                      borderColor: on ? colors.primary : colors.border,
                    }}
                  >
                    <Text
                      style={{
                        color: on ? colors.primaryText : colors.textMuted,
                        fontWeight: '600',
                        fontSize: locale === 'ar' ? 14 : 13,
                      }}
                    >
                      {t(`search.${k}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {active ? (
              <Text style={[type.caption, { color: colors.textMuted, textAlign }]}>
                {t('list.results', { count: rows.length })}
              </Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => renderRow(item)}
        ListEmptyComponent={
          isLoading ? (
            <SkeletonList count={3} />
          ) : active ? (
            <EmptyState
              icon="search-outline"
              title={t('empty.searchTitle')}
              body={t('empty.searchBody')}
              ctaLabel={t('list.clear')}
              onPressCta={() => {
                setQuery('');
                setQuick('all');
              }}
            />
          ) : (
            <EmptyState
              icon="search-outline"
              title={t('search.prompt')}
              body={t('search.promptBody')}
            />
          )
        }
      />
    </>
  );
}
