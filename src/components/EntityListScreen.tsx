import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { InvoiceCard, SubscriptionCard, WarrantyCard } from '@/components/EntityCards';
import { SkeletonList } from '@/components/Skeleton';
import {
  ListControls,
  type FilterKey,
  type SortKey,
} from '@/components/ListControls';
import { colors, spacing } from '@/theme';
import { calendarDaysUntil } from '@/i18n/relativeTime';
import { useItems } from '@/hooks/useItems';
import { useUIStore } from '@/store/uiStore';
import type { ListItem } from '@/lib/types';

export type ListKind = 'invoices' | 'warranties' | 'subscriptions';

const CONFIG: Record<
  ListKind,
  { titleKey: string; emptyIcon: 'receipt-outline' | 'shield-outline' | 'card-outline'; filters?: FilterKey[] }
> = {
  invoices: { titleKey: 'sections.allInvoices', emptyIcon: 'receipt-outline' },
  warranties: {
    titleKey: 'sections.allWarranties',
    emptyIcon: 'shield-outline',
    filters: ['all', 'active', 'expiring', 'expired'],
  },
  subscriptions: {
    titleKey: 'sections.allSubscriptions',
    emptyIcon: 'card-outline',
    filters: ['all', 'expiring'],
  },
};

/**
 * Shared body for the three "View all" pages. They differ only in how rows are
 * filtered, sorted and rendered, so one component covers all three and Back
 * always lands on Home.
 */
export function EntityListScreen({ kind }: { kind: ListKind }) {
  const { t } = useTranslation();
  const router = useRouter();
  const openAddSheet = useUIStore((s) => s.openAddSheet);
  const { data: items = [], isLoading, refetch, isRefetching } = useItems();

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>(kind === 'invoices' ? 'date' : 'remaining');
  const [filter, setFilter] = useState<FilterKey>('all');

  /** The date this kind counts towards; invoices have none. */
  const dateOf = (i: ListItem) =>
    kind === 'warranties' ? i.warranty_expires_on : kind === 'subscriptions' ? i.next_renewal : null;

  const all = useMemo(
    () =>
      kind === 'invoices'
        ? items.filter((i) => i.kind === 'receipt')
        : items.filter((i) => !!dateOf(i)),
    [items, kind],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = all;

    if (q) {
      out = out.filter(
        (i) =>
          i.merchant_name.toLowerCase().includes(q) ||
          (i.category ?? '').toLowerCase().includes(q),
      );
    }

    if (filter !== 'all') {
      out = out.filter((i) => {
        const d = dateOf(i);
        if (!d) return false;
        const days = calendarDaysUntil(d);
        if (filter === 'expired') return days < 0;
        if (filter === 'expiring') return days >= 0 && days <= 30;
        return days > 30; // active
      });
    }

    return [...out].sort((a, b) => {
      if (sort === 'name') return a.merchant_name.localeCompare(b.merchant_name);
      if (sort === 'remaining') {
        const da = dateOf(a);
        const db = dateOf(b);
        if (!da || !db) return 0;
        return calendarDaysUntil(da) - calendarDaysUntil(db);
      }
      return b.created_at.localeCompare(a.created_at);
    });
  }, [all, query, filter, sort, kind]);

  const filtering = !!query.trim() || filter !== 'all';

  function renderRow(item: ListItem) {
    if (kind === 'invoices') {
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
    if (kind === 'warranties') {
      return (
        <WarrantyCard
          productName={item.merchant_name}
          merchant={item.category}
          purchaseDate={item.purchase_date}
          expiresOn={item.warranty_expires_on!}
          onPress={() => router.push(`/item/${item.id}`)}
        />
      );
    }
    return (
      <SubscriptionCard
        name={item.merchant_name}
        period={item.sub_period ?? 'monthly'}
        nextRenewal={item.next_renewal!}
        onPress={() => router.push(`/item/${item.id}`)}
      />
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: t(CONFIG[kind].titleKey),
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
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
        }
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          all.length || filtering ? (
            <View style={{ marginBottom: spacing.xs }}>
              <ListControls
                query={query}
                onQueryChange={setQuery}
                sort={sort}
                onSortChange={setSort}
                filter={filter}
                onFilterChange={setFilter}
                filters={CONFIG[kind].filters}
                resultCount={rows.length}
              />
            </View>
          ) : null
        }
        renderItem={({ item }) => renderRow(item)}
        ListEmptyComponent={
          isLoading ? (
            <SkeletonList count={3} />
          ) : filtering ? (
            <EmptyState
              icon="search-outline"
              title={t('empty.searchTitle')}
              body={t('empty.searchBody')}
              ctaLabel={t('list.clear')}
              onPressCta={() => {
                setQuery('');
                setFilter('all');
              }}
            />
          ) : (
            <EmptyState
              icon={CONFIG[kind].emptyIcon}
              title={t(`empty.${kind}Title`)}
              body={t(`empty.${kind}Body`)}
              ctaLabel={t(
              kind === 'warranties'
                ? 'empty.warrantiesCta2'
                : kind === 'subscriptions'
                  ? 'empty.subscriptionsCta2'
                  : 'empty.invoicesCta',
            )}
              onPressCta={() =>
                kind === 'invoices'
                  ? router.push('/item/new')
                  : kind === 'warranties'
                    ? router.push('/item/add-warranty')
                    : router.push('/item/add-subscription')
              }
            />
          )
        }
        ListFooterComponent={
          // Keeps the add sheet one tap away at the bottom of a long list.
          rows.length > 6 ? (
            <View style={{ height: spacing.xl }} onTouchEnd={openAddSheet} />
          ) : null
        }
      />
    </>
  );
}
