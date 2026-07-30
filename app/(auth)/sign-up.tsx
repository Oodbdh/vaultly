import { useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { colors, spacing, typeScale } from '@/theme';
import { useDirection } from '@/i18n/rtl';
import { useAuthStore } from '@/store/authStore';

export default function SignUp() {
  const { t, i18n } = useTranslation();
  const { locale, textAlign } = useDirection();
  const type = typeScale(locale);
  const signUpWithEmail = useAuthStore((s) => s.signUpWithEmail);
  const resendConfirmation = useAuthStore((s) => s.resendConfirmation);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Set once the confirmation mail is away — swaps the form for guidance. */
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  async function submit() {
    setError(null);
    setMessage(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError(t('auth.errors.invalidEmail'));
    if (password.length < 8) return setError(t('auth.errors.shortPassword'));
    setBusy(true);
    const res = await signUpWithEmail(email.trim(), password, i18n.language as 'en' | 'ar');
    setBusy(false);
    if (res.error) return setError(t('auth.errors.generic'));
    // No session means confirmation is required — say so plainly instead of
    // leaving the user on a form that looks like it did nothing.
    if (res.needsConfirmation) setAwaitingConfirmation(true);
  }

  async function resend() {
    setBusy(true);
    setError(null);
    const res = await resendConfirmation(email.trim());
    setBusy(false);
    if (res.error) setError(res.error);
    else setMessage(t('auth.resent'));
  }

  if (awaitingConfirmation) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View
          style={{ flex: 1, padding: spacing.xl, gap: spacing.lg, justifyContent: 'center' }}
        >
          <Ionicons name="mail-unread-outline" size={44} color={colors.primary} />
          <Text style={[type.title, { color: colors.text, textAlign }]}>
            {t('auth.checkEmailTitle')}
          </Text>
          <Text style={[type.body, { color: colors.textMuted, textAlign }]}>
            {t('auth.checkEmailBody', { email: email.trim() })}
          </Text>
          <Text style={[type.caption, { color: colors.textMuted, textAlign }]}>
            {t('auth.checkEmailHint')}
          </Text>

          {error ? (
            <Text style={[type.caption, { color: colors.danger, textAlign }]}>{error}</Text>
          ) : null}
          {message ? (
            <Text style={[type.caption, { color: colors.success, textAlign }]}>{message}</Text>
          ) : null}

          <Button
            variant="secondary"
            label={busy ? t('common.loading') : t('auth.resend')}
            disabled={busy}
            onPress={() => void resend()}
          />
          <Link href="/(auth)/sign-in" style={{ color: colors.primary, fontWeight: '600', textAlign: 'center' }}>
            {t('auth.backToSignIn')}
          </Link>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, padding: spacing.xl, gap: spacing.lg, justifyContent: 'center' }}>
        <Text style={[type.title, { color: colors.text, textAlign }]}>{t('auth.signUpTitle')}</Text>

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

        {error ? <Text style={[type.caption, { color: colors.danger, textAlign }]}>{error}</Text> : null}
        {message ? (
          <Text style={[type.caption, { color: colors.success, textAlign }]}>{message}</Text>
        ) : null}

        <Button label={busy ? t('common.loading') : t('auth.signUp')} disabled={busy} onPress={submit} />

        <View style={{ flexDirection: 'row', gap: spacing.xs, justifyContent: 'center' }}>
          <Text style={[type.caption, { color: colors.textMuted }]}>{t('auth.hasAccount')}</Text>
          <Link href="/(auth)/sign-in" style={{ color: colors.primary, fontWeight: '600' }}>
            {t('auth.signIn')}
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}
