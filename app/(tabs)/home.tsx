import { useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { InvoiceCard, SubscriptionCard, WarrantyCard } from '@/components/EntityCards';
import { SkeletonList } from '@/components/Skeleton';
import { LanguageSwitcher } from '@/components/LanguagePicker';
import { NeedsAttention, type AttentionEntry } from '@/components/NeedsAttention';
import { QuotaBanner } from '@/components/QuotaBanner';
import { SectionHeader } from '@/components/SectionHeader';
import { SummaryCard } from '@/components/SummaryCard';
import { colors, radius, spacing, typeScale } from '@/theme';
import { useDirection } from '@/i18n/rtl';
import { useItems } from '@/hooks/useItems';
import { useItemQuota } from '@/hooks/useItemQuota';
import { useSession } from '@/hooks/useSession';

/** Local-clock greeting; the emoji is part of the copy in every language. */
function greetingKey(): 'morning' | 'afternoon' | 'evening' {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

export default function Home() {
  const { t } = useTranslation();
  const { locale, textAlign } = useDirection();
  const type = typeScale(locale);
  const router = useRouter();
  const { profile } = useSession();
  const quota = useItemQuota();
  const { data: items = [], isLoading, refetch, isRefetching } = useItems();

  const { invoices, warranties, subscriptions, attention } = useMemo(() => {
    const subs = items.filter((i) => !!i.next_renewal);
    const warr = items.filter((i) => !!i.warranty_expires_on);
    const entries: AttentionEntry[] = [
      ...warr.map((w) => ({
        id: `w-${w.id}`,
        title: w.merchant_name,
        subtitle: t('sections.warranties'),
        date: w.warranty_expires_on!,
        kind: 'warranty' as const,
      })),
      ...subs.map((s) => ({
        id: `s-${s.id}`,
        title: s.merchant_name,
        subtitle: t('sections.subscriptions'),
        date: s.next_renewal!,
        kind: 'subscription' as const,
      })),
    ];
    return {
      invoices: items.filter((i) => i.kind === 'receipt').slice(0, 3),
      warranties: warr.slice(0, 2),
      subscriptions: subs.slice(0, 2),
      attention: entries,
    };
  }, [items, t]);

  const name = profile?.display_name;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View
        style={{
          paddingHorizontal: spacing.xl,
          paddingBottom: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.title, { color: colors.text, textAlign }]} numberOfLines={1}>
            {name ? t(`greeting.${greetingKey()}`, { name }) : t('greeting.fallback')}
          </Text>
          <Text style={[type.caption, { color: colors.textMuted, textAlign }]}>
            {quota.isPremium
              ? t('dashboard.unlimited')
              : t('dashboard.ofLimit', { used: quota.used, limit: quota.limit })}
          </Text>
        </View>
        <LanguageSwitcher />
      </View>

      {/* Search is one tap from the command centre, not buried in a list page */}
      <Pressable
        accessibilityRole="search"
        accessibilityLabel={t('search.title')}
        onPress={() => router.push('/search')}
        style={({ pressed }) => ({
          marginHorizontal: spacing.xl,
          marginBottom: spacing.sm,
          minHeight: 46,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: radius.pill,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Ionicons name="search" size={17} color={colors.textMuted} />
        <Text style={[type.caption, { color: colors.textMuted, flex: 1, textAlign }]}>
          {t('search.placeholder')}
        </Text>
      </Pressable>

      <ScrollView
        contentContainerStyle={{
          padding: spacing.xl,
          paddingTop: spacing.sm,
          gap: spacing.xl,
          paddingBottom: 120, // clears the FAB and tab bar
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
      >
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <SummaryCard
            icon="receipt-outline"
            label={t('summary.invoices')}
            value={String(items.filter((i) => i.kind === 'receipt').length)}
          />
          <SummaryCard
            icon="shield-checkmark-outline"
            label={t('summary.warranties')}
            value={String(items.filter((i) => !!i.warranty_expires_on).length)}
            tint={colors.success}
          />
          <SummaryCard
            icon="repeat-outline"
            label={t('summary.subscriptions')}
            value={String(items.filter((i) => !!i.next_renewal).length)}
            tint={colors.accent}
          />
        </View>

        {/* Needs Attention sits directly below the summary — the first thing read */}
        <NeedsAttention
          entries={attention}
          onPressEntry={(e) => router.push(`/item/${e.id.slice(2)}`)}
        />

        <QuotaBanner />

        <Section
          title={t('sections.subscriptions')}
          onViewAll={() => router.push('/subscriptions')}
          empty={!subscriptions.length}
          loading={isLoading}
          emptyIcon="card-outline"
          emptyKind="subscriptions"
          onEmptyCta={() => router.push('/item/add-subscription')}
        >
          {subscriptions.map((s) => (
            <SubscriptionCard
              key={s.id}
              name={s.merchant_name}
              period={s.sub_period ?? 'monthly'}
              nextRenewal={s.next_renewal!}
              onPress={() => router.push(`/item/${s.id}`)}
            />
          ))}
        </Section>

        <Section
          title={t('sections.warranties')}
          onViewAll={() => router.push('/warranties')}
          empty={!warranties.length}
          loading={isLoading}
          emptyIcon="shield-outline"
          emptyKind="warranties"
          onEmptyCta={() => router.push('/item/add-warranty')}
        >
          {warranties.map((w) => (
            <WarrantyCard
              key={w.id}
              productName={w.merchant_name}
              merchant={w.category}
              purchaseDate={w.purchase_date}
              expiresOn={w.warranty_expires_on!}
              onPress={() => router.push(`/item/${w.id}`)}
            />
          ))}
        </Section>

        <Section
          title={t('sections.recentInvoices')}
          onViewAll={() => router.push('/invoices')}
          empty={!invoices.length}
          loading={isLoading}
          emptyIcon="receipt-outline"
          emptyKind="invoices"
          onEmptyCta={() => router.push('/item/new')}
        >
          {invoices.map((i) => (
            <InvoiceCard
              key={i.id}
              merchant={i.merchant_name}
              purchaseDate={i.purchase_date}
              amount={i.total_amount}
              currency={i.currency}
              onPress={() => router.push(`/item/${i.id}`)}
            />
          ))}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  onViewAll,
  empty,
  loading,
  emptyIcon,
  emptyKind,
  onEmptyCta,
  children,
}: {
  title: string;
  onViewAll: () => void;
  empty: boolean;
  loading: boolean;
  emptyIcon: 'receipt-outline' | 'shield-outline' | 'card-outline';
  emptyKind: 'invoices' | 'warranties' | 'subscriptions';
  onEmptyCta: () => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: spacing.md }}>
      <SectionHeader title={title} onViewAll={empty ? undefined : onViewAll} />
      {loading ? (
        <SkeletonList count={2} />
      ) : empty ? (
        <EmptyState
          compact
          icon={emptyIcon}
          title={t(`empty.${emptyKind}Title`)}
          ctaLabel={t(`empty.${emptyKind}Cta`)}
          onPressCta={onEmptyCta}
        />
      ) : (
        children
      )}
    </View>
  );
}
