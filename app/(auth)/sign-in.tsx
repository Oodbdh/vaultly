import { useState } from 'react';
import { Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { colors, spacing, typeScale } from '@/theme';
import { useDirection } from '@/i18n/rtl';
import { EMAIL_NOT_CONFIRMED, useAuthStore } from '@/store/authStore';
import { completeAuthFromUrl } from '@/lib/authCallback';
import { authRedirectTo } from '@/lib/authRedirect';
import { supabase } from '@/lib/supabase';

export default function SignIn() {
  const { t } = useTranslation();
  const { locale, textAlign } = useDirection();
  const type = typeScale(locale);
  const signInWithEmail = useAuthStore((s) => s.signInWithEmail);
  const resendConfirmation = useAuthStore((s) => s.resendConfirmation);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Credentials were right but the address was never confirmed. */
  const [unconfirmed, setUnconfirmed] = useState(false);

  async function submit() {
    setError(null);
    setMessage(null);
    setUnconfirmed(false);
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError(t('auth.errors.invalidEmail'));
    if (password.length < 8) return setError(t('auth.errors.shortPassword'));
    setBusy(true);
    const res = await signInWithEmail(email.trim(), password);
    setBusy(false);
    if (!res.error) return;
    // Telling someone their password is wrong when it isn't sends them into a
    // reset loop that cannot help — the address just needs confirming.
    if (res.error === EMAIL_NOT_CONFIRMED) {
      setUnconfirmed(true);
      setError(t('auth.errors.emailNotConfirmed'));
      return;
    }
    setError(t('auth.errors.invalidCredentials'));
  }

  async function resend() {
    setBusy(true);
    setError(null);
    const res = await resendConfirmation(email.trim());
    setBusy(false);
    if (res.error) setError(res.error);
    else setMessage(t('auth.resent'));
  }

  async function oauth(provider: 'apple' | 'google') {
    setError(null);
    const redirectTo = authRedirectTo();
    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (oauthError || !data?.url) {
      setError(t('auth.errors.providerUnavailable'));
      return;
    }
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') return; // user dismissed the sheet
    // Same handler as the email links — it understands the PKCE `code` the
    // manual fragment parsing here used to miss entirely.
    const outcome = await completeAuthFromUrl(result.url);
    if (outcome.status === 'error') setError(outcome.message);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, padding: spacing.xl, gap: spacing.lg, justifyContent: 'center' }}>
        <Text style={[type.title, { color: colors.text, textAlign }]}>{t('auth.signInTitle')}</Text>
        <Text style={[type.body, { color: colors.textMuted, textAlign }]}>
          {t('auth.signInSubtitle')}
        </Text>

        <Field
          label={t('auth.email')}
          placeholder={t('auth.emailPlaceholder')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Field
          label={t('auth.password')}
          placeholder={t('auth.passwordPlaceholder')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {error ? (
          <Text style={[type.caption, { color: colors.danger, textAlign }]}>{error}</Text>
        ) : null}
        {message ? (
          <Text style={[type.caption, { color: colors.success, textAlign }]}>{message}</Text>
        ) : null}

        <Button label={busy ? t('common.loading') : t('auth.signIn')} disabled={busy} onPress={submit} />
        {unconfirmed ? (
          <Button
            variant="secondary"
            label={busy ? t('common.loading') : t('auth.resend')}
            disabled={busy}
            onPress={() => void resend()}
          />
        ) : null}
        <Button variant="secondary" label={t('auth.continueWithApple')} onPress={() => void oauth('apple')} />
        <Button variant="secondary" label={t('auth.continueWithGoogle')} onPress={() => void oauth('google')} />

        <View style={{ flexDirection: 'row', gap: spacing.xs, justifyContent: 'center' }}>
          <Text style={[type.caption, { color: colors.textMuted }]}>{t('auth.noAccount')}</Text>
          <Link href="/(auth)/sign-up" style={{ color: colors.primary, fontWeight: '600' }}>
            {t('auth.signUp')}
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}

