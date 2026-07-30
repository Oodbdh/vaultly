import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing, typeScale } from '@/theme';
import { useDirection } from '@/i18n/rtl';

export type SortKey = 'date' | 'name' | 'remaining';
export type FilterKey = 'all' | 'active' | 'expiring' | 'expired';

/**
 * Search + filter + sort for the list pages. Sort cycles through a single pill
 * rather than opening a menu — three options don't earn a modal, and one tap
 * beats two.
 */
export function ListControls({
  query,
  onQueryChange,
  sort,
  onSortChange,
  filter,
  onFilterChange,
  filters,
  resultCount,
}: {
  query: string;
  onQueryChange: (v: string) => void;
  sort: SortKey;
  onSortChange: (s: SortKey) => void;
  filter: FilterKey;
  onFilterChange: (f: FilterKey) => void;
  /** Omit to hide the filter row (invoices have no lifecycle to filter by). */
  filters?: FilterKey[];
  resultCount: number;
}) {
  const { t } = useTranslation();
  const { locale, textAlign, flipIcon } = useDirection();
  const type = typeScale(locale);

  const sortOrder: SortKey[] = ['date', 'name', 'remaining'];
  const sortLabel = t(
    sort === 'date' ? 'list.sortDate' : sort === 'name' ? 'list.sortName' : 'list.sortRemaining',
  );

  return (
    <View style={{ gap: spacing.md }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          minHeight: 48,
        }}
      >
        <Ionicons name="search" size={17} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={onQueryChange}
          placeholder={t('list.search')}
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
            onPress={() => onQueryChange('')}
            hitSlop={8}
          >
            <Ionicons name="close-circle" size={17} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {filters?.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm, paddingEnd: spacing.sm }}
            style={{ flex: 1 }}
          >
            {filters.map((f) => {
              const active = filter === f;
              return (
                <Pressable
                  key={f}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => onFilterChange(f)}
                  style={{
                    minHeight: 40,
                    justifyContent: 'center',
                    paddingHorizontal: spacing.lg,
                    borderRadius: radius.pill,
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                  }}
                >
                  <Text
                    style={{
                      color: active ? colors.primaryText : colors.textMuted,
                      fontWeight: '600',
                      fontSize: locale === 'ar' ? 14 : 13,
                    }}
                  >
                    {t(
                      f === 'all'
                        ? 'list.filterAll'
                        : f === 'active'
                          ? 'list.filterActive'
                          : f === 'expiring'
                            ? 'list.filterExpiring'
                            : 'list.filterExpired',
                    )}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('list.sortBy')}: ${sortLabel}`}
          onPress={() => onSortChange(sortOrder[(sortOrder.indexOf(sort) + 1) % sortOrder.length]!)}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            minHeight: 40,
            paddingHorizontal: spacing.md,
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name="swap-vertical" size={15} color={colors.primary} style={flipIcon} />
          <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13 }}>
            {sortLabel}
          </Text>
        </Pressable>
      </View>

      <Text style={[type.caption, { color: colors.textMuted, textAlign }]}>
        {t('list.results', { count: resultCount })}
      </Text>
    </View>
  );
}
