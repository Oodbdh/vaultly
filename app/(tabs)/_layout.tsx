import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AddSheet } from '@/components/AddSheet';
import { colors, radius, spacing } from '@/theme';
import { useUIStore } from '@/store/uiStore';

/**
 * Three-slot bar: Home · FAB · Profile. The FAB is not a tab — it's an elevated
 * button that overlaps the bar and opens the add sheet, so it stays reachable
 * from every screen in the tab tree.
 */
export default function TabsLayout() {
  const { t } = useTranslation();
  const openAddSheet = useUIStore((s) => s.openAddSheet);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            height: 68,
            paddingTop: 6,
            paddingBottom: 10,
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: t('nav.home'),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
            ),
          }}
        />

        {/* Spacer tab: renders nothing, never navigable — it reserves the centre
            slot so Home and Profile sit either side of the FAB. */}
        <Tabs.Screen
          name="add-placeholder"
          options={{
            title: '',
            tabBarButton: () => <View style={{ width: 84 }} />,
          }}
          listeners={{ tabPress: (e) => e.preventDefault() }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: t('nav.profile'),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
            ),
          }}
        />
      </Tabs>

      {/* FAB — centred, elevated, above the bar */}
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 30 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('nav.add')}
          onPress={openAddSheet}
          style={({ pressed }) => ({
            alignSelf: 'center',
            width: 64,
            height: 64,
            borderRadius: radius.pill,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 4,
            borderColor: colors.bg,
            shadowColor: '#0B1220',
            shadowOpacity: 0.28,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 6 },
            elevation: 8,
            transform: [{ scale: pressed ? 0.94 : 1 }],
          })}
        >
          <Ionicons name="add" size={32} color={colors.primaryText} />
        </Pressable>
      </View>

      <AddSheet />
    </>
  );
}
