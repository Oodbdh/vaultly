import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Linking from 'expo-linking';

import { Button } from '@/components/Button';
import { completeAuthFromUrl } from '@/lib/authCallback';
import { colors, spacing, typeScale } from '@/theme';
import { useDirection } from '@/i18n/rtl';

/**
 * Landing screen for every auth deep link — email confirmation, password
 * reset, OAuth return.
 *
 * `Linking.useURL()` is used rather than route params because the implicit
 * flow puts its tokens in the URL *fragment*, which the router does not expose.
 * It also covers both entry paths: a cold start from a tapped link, and a link
 * arriving while the app is already open.
 */
export default function AuthCallback() {
  const { t } = useTranslation();
  const { locale, textAlign } = useDirection();
  const type = typeScale(locale);
  const router = useRouter();
  const url = Linking.useURL();

  const [state, setState] = useState<'working' | 'done' | 'error'>('working');
  const [message, setMessage] = useState<string | null>(null);
  // A link must only be redeemed once: the code is single-use, and a second
  // exchange would fail and overwrite the success we just had.
  const handled = useRef(false);

  useEffect(() => {
    if (!url || handled.current) return;
    handled.current = true;

    void (async () => {
      const result = await completeAuthFromUrl(url);
      if (result.status === 'signed-in') {
        setState('done');
        // The auth gate in _layout redirects on session change; this just makes
        // the transition immediate rather than waiting for a re-render.
        router.replace('/(tabs)/home');
        return;
      }
      if (result.status === 'ignored') {
        router.replace('/(tabs)/home');
        return;
      }
      setState('error');
      setMessage(result.message);
    })();
  }, [url, router]);

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
