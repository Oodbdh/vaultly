import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Linking from 'expo-linking';

import { Button } from '@/components/Button';
import { completeAuthFromUrl } from '@/lib/authCallback';
import { colors, spacing, typeScale } from '@/theme';
import { useDirection } from '@/i18n/rtl';
import { useAuthStore } from '@/store/authStore';

/**
 * Landing screen for every auth deep link — email confirmation, password
 * reset, OAuth return.
 *
 * **Route params are the primary source, not `Linking.useURL()`.** The hook
 * resolves `getInitialURL()` (the URL that *launched* the app) and separately
 * listens for `url` events; when the link arrives while the app is already
 * running, the event fires before that listener attaches, so the hook keeps
 * reporting the launch URL. Under the dev launcher that is permanently
 * `vaultly://expo-development-client/?url=…`, and device traces showed it
 * winning on every single mount — the `code` was visible in route params while
 * `completeAuthFromUrl` was handed the stale URL and returned `ignored`, so
 * `exchangeCodeForSession` was never called.
 *
 * `useURL()` is kept as the fallback because the implicit flow puts its tokens
 * in the URL *fragment*, which the router does not expose as params.
 */
export default function AuthCallback() {
  const { t } = useTranslation();
  const { locale, textAlign } = useDirection();
  const type = typeScale(locale);
  const router = useRouter();
  const url = Linking.useURL();
  const params = useLocalSearchParams();

  /** The link as the router parsed it, rebuilt into a URL for the shared handler. */
  const paramUrl = useMemo(() => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      const s = Array.isArray(v) ? v[0] : v;
      if (typeof s === 'string' && s) qs.set(k, s);
    }
    const q = qs.toString();
    return q ? `vaultly://auth-callback?${q}` : null;
  }, [params]);

  const callbackUrl = paramUrl ?? url;

  const [state, setState] = useState<'working' | 'done' | 'notice' | 'error'>('working');
  const [message, setMessage] = useState<string | null>(null);
  // A link must only be redeemed once: the code is single-use, and a second
  // exchange would fail and overwrite the success we just had.
  const handled = useRef(false);

  useEffect(() => {
    if (!callbackUrl || handled.current) return;
    handled.current = true;

    void (async () => {
      const result = await completeAuthFromUrl(callbackUrl);
      if (result.status === 'signed-in') {
        // An email-change link arrives here too. The address is a claim inside
        // the token, so without reissuing it the app keeps showing the old one
        // even though the change already landed server-side.
        await useAuthStore.getState().refreshUser();
        setState('done');
        // The auth gate in _layout redirects on session change; this just makes
        // the transition immediate rather than waiting for a re-render.
        router.replace('/(tabs)/home');
        return;
      }
      // The link worked but there is more for the user to do — most often the
      // second half of a secure email change. Stop here and say so; bouncing to
      // Home is what made this look like nothing had happened.
      if (result.status === 'notice') {
        await useAuthStore.getState().refreshUser();
        setState('notice');
        setMessage(result.message);
        return;
      }
      if (result.status === 'ignored') {
        router.replace('/(tabs)/home');
        return;
      }
      setState('error');
      setMessage(result.message);
    })();
  }, [callbackUrl, router]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.xl,
          gap: spacing.lg,
        }}
      >
        {state === 'working' ? (
          <>
            <ActivityIndicator color={colors.primary} />
            <Text style={[type.body, { color: colors.textMuted, textAlign: 'center' }]}>
              {t('auth.verifying')}
            </Text>
          </>
        ) : null}

        {state === 'done' ? (
          <>
            <Ionicons name="checkmark-circle" size={44} color={colors.success} />
            <Text style={[type.heading, { color: colors.text, textAlign: 'center' }]}>
              {t('auth.verified')}
            </Text>
          </>
        ) : null}

        {state === 'notice' ? (
          <>
            <Ionicons name="mail-unread" size={44} color={colors.primary} />
            <Text style={[type.heading, { color: colors.text, textAlign: 'center' }]}>
              {t('auth.oneMoreStep')}
            </Text>
            {/* GoTrue's own wording. It names the remaining action precisely
                ("confirm link sent to the other email"), which is better than a
                generic string that could drift from server behaviour. */}
            {message ? (
              <Text style={[type.body, { color: colors.textMuted, textAlign: 'center' }]}>
                {message}
              </Text>
            ) : null}
            <Button
              label={t('common.continue')}
              onPress={() => router.replace('/(tabs)/home')}
              style={{ alignSelf: 'stretch' }}
            />
          </>
        ) : null}

        {state === 'error' ? (
          <>
            <Ionicons name="alert-circle" size={44} color={colors.danger} />
            <Text style={[type.heading, { color: colors.text, textAlign: 'center' }]}>
              {t('auth.verifyFailed')}
            </Text>
            {message ? (
              <Text style={[type.caption, { color: colors.textMuted, textAlign: 'center' }]}>
                {message}
              </Text>
            ) : null}
            <Button
              label={t('auth.backToSignIn')}
              onPress={() => router.replace('/(auth)/sign-in')}
              style={{ alignSelf: 'stretch' }}
            />
          </>
        ) : null}

        {state !== 'error' ? (
          <Text style={[type.caption, { color: colors.textMuted, textAlign }]} />
        ) : null}
      </View>
    </View>
  );
}
