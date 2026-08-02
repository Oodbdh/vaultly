import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Slot, SplashScreen, Stack, useRouter, useSegments } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { initI18n } from '@/i18n';
import { AUTH_CALLBACK_PATH } from '@/lib/authRedirect';
import { queryClient } from '@/lib/queryClient';
import { colors } from '@/theme';
import { useAuthSubscription, useSession, useSyncProfileLocale } from '@/hooks/useSession';
import { subscribeToEntitlements } from '@/store/entitlementStore';
import { registerForPush } from '@/services/notifications';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // i18n must resolve before first paint so RTL applies to the initial tree.
    initI18n().finally(() => {
      setReady(true);
      void SplashScreen.hideAsync();
    });
  }, []);

  useEffect(subscribeToEntitlements, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <AuthGate />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

/** Redirects between the (auth) and (tabs) groups as the session changes. */
function AuthGate() {
  useAuthSubscription();
  useSyncProfileLocale();
  const { isSignedIn, initialising, user } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (initialising) return;
    const inAuthGroup = segments[0] === '(auth)';
    // The callback screen is exempt in BOTH directions. It runs before a
    // session exists, so the signed-out rule would unmount it mid-exchange and
    // the confirmation link would silently do nothing; and it navigates itself
    // once the exchange succeeds.
    if (segments[0] === AUTH_CALLBACK_PATH) return;
    if (!isSignedIn && !inAuthGroup) router.replace('/(auth)/sign-in');
    if (isSignedIn && inAuthGroup) router.replace('/(tabs)/home');
  }, [isSignedIn, initialising, segments, router]);

  useEffect(() => {
    if (user) void registerForPush(user.id);
  }, [user]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="auth-callback" />
      <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
      <Stack.Screen name="item/[id]" options={{ headerShown: true }} />
      <Stack.Screen name="item/add-warranty" options={{ presentation: 'modal' }} />
      <Stack.Screen name="item/add-subscription" options={{ presentation: 'modal' }} />
      <Stack.Screen name="invoices" options={{ headerShown: true }} />
      <Stack.Screen name="warranties" options={{ headerShown: true }} />
      <Stack.Screen name="search" options={{ headerShown: true }} />
      <Stack.Screen name="account" options={{ headerShown: true }} />
      <Stack.Screen name="support/faq" options={{ headerShown: true }} />
      <Stack.Screen name="support/legal" options={{ headerShown: true }} />
      <Stack.Screen name="subscriptions" options={{ headerShown: true }} />
      <Stack.Screen name="item/new" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
