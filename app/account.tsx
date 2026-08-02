import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { colors, radius, spacing, typeScale } from '@/theme';
import { useDirection } from '@/i18n/rtl';
import { useAuthStore } from '@/store/authStore';
import { usePremium } from '@/hooks/usePremium';
import { useSession } from '@/hooks/useSession';
import { updateProfile } from '@/services/profile';

/**
 * Account details — display name, email address and password.
 *
 * Each block is independent: its own busy flag and its own message line, so a
 * failed password change cannot appear to be a failed name save. All three use
 * the existing `Field` / `Button` / card styling rather than anything new.
 *
 * Email deliberately does not write to `profiles`. The address lives on
 * `auth.users` and only Supabase may move it, after the new address is
 * verified — see `authStore.updateEmail`.
 */
export default function AccountDetails() {
  const { t } = useTranslation();
  const { locale, textAlign } = useDirection();
  const type = typeScale(locale);

  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const updateEmail = useAuthStore((s) => s.updateEmail);
  const updatePassword = useAuthStore((s) => s.updatePassword);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const { user } = useSession();
  const { isPremium } = usePremium();

  const [name, setName] = useState(profile?.display_name ?? '');
  const [nameBusy, setNameBusy] = useState(false);
  const [nameNote, setNameNote] = useState<Note>(null);

  const [email, setEmail] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailNote, setEmailNote] = useState<Note>(null);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordNote, setPasswordNote] = useState<Note>(null);

  // If the confirmation link was opened while this screen was already mounted —
  // or on a cold start after tapping it — the cached token may still carry the
  // previous address. Re-read the user once on entry so what is shown is the
  // server's answer, not whatever the last token happened to say.
  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  async function saveName() {
    setNameNote(null);
    const next = name.trim();
    if (!next) return setNameNote({ kind: 'error', text: t('account.nameEmpty') });
    if (!user) return;

    setNameBusy(true);
    const res = await updateProfile(user.id, { display_name: next });
    setNameBusy(false);

    if (!res.ok) return setNameNote({ kind: 'error', text: res.error });
    // Cache what Postgres actually stored, so the Profile tab and the greeting
    // on Home update without a refetch.
    setProfile(res.profile);
    setNameNote({ kind: 'success', text: t('account.nameSaved') });
  }

  async function saveEmail() {
    setEmailNote(null);
    const next = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(next)) {
      return setEmailNote({ kind: 'error', text: t('auth.errors.invalidEmail') });
    }
    if (next.toLowerCase() === (user?.email ?? '').toLowerCase()) {
      return setEmailNote({ kind: 'error', text: t('account.sameEmail') });
    }

    setEmailBusy(true);
    const res = await updateEmail(next);
    setEmailBusy(false);

    if (res.error) return setEmailNote({ kind: 'error', text: res.error });
    // The address on the account has NOT moved yet — say so plainly, or people
    // assume it is done and stop watching for the email.
    setEmailNote({ kind: 'success', text: t('account.emailPending', { email: next }) });
    setEmail('');
  }

  async function savePassword() {
    setPasswordNote(null);
    if (password.length < 8) {
      return setPasswordNote({ kind: 'error', text: t('auth.errors.shortPassword') });
    }
    if (password !== confirm) {
      return setPasswordNote({ kind: 'error', text: t('account.passwordMismatch') });
    }

    setPasswordBusy(true);
    const res = await updatePassword(password);
    setPasswordBusy(false);

    if (res.error) return setPasswordNote({ kind: 'error', text: res.error });
    setPassword('');
    setConfirm('');
    setPasswordNote({ kind: 'success', text: t('account.passwordUpdated') });
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: t('profile.account'),
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      />
      <ScrollView
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={{
          padding: spacing.xl,
          gap: spacing.xl,
          paddingBottom: spacing.xxl * 2,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[type.title, { color: colors.text, textAlign }]}>{t('profile.account')}</Text>

        <Card title={t('account.profileSection')}>
          <Field
            label={t('profile.displayName')}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
          <NoteLine note={nameNote} />
          <Button
            label={nameBusy ? t('common.loading') : t('common.save')}
            disabled={nameBusy}
            onPress={() => void saveName()}
          />
          <ReadOnlyRow
            label={t('settings.managePlan')}
            value={isPremium ? t('settings.planPremium') : t('settings.planFree')}
          />
        </Card>

        <Card title={t('account.emailSection')}>
          <ReadOnlyRow label={t('account.currentEmail')} value={user?.email || '—'} />
          <Field
            label={t('account.newEmail')}
            placeholder={t('auth.emailPlaceholder')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
          <NoteLine note={emailNote} />
          <Button
            label={emailBusy ? t('common.loading') : t('account.sendVerification')}
            disabled={emailBusy}
            onPress={() => void saveEmail()}
          />
        </Card>

        <Card title={t('account.passwordSection')}>
          <Field
            label={t('account.newPassword')}
            placeholder={t('auth.passwordPlaceholder')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />
          <Field
            label={t('account.confirmPassword')}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoCapitalize="none"
          />
          <NoteLine note={passwordNote} />
          <Button
            label={passwordBusy ? t('common.loading') : t('account.changePassword')}
            disabled={passwordBusy}
            onPress={() => void savePassword()}
          />
        </Card>
      </ScrollView>
    </>
  );
}

/**
 * The three presentational pieces below live at module scope on purpose.
 *
 * Declared inside `AccountDetails`, they were rebuilt on every render — and a
 * new function identity is a *different component type* to React, so instead of
 * updating the subtree it unmounted and remounted it. Every keystroke therefore
 * destroyed the `TextInput` inside `Card` and took the focus and keyboard with
 * it. Hoisting them keeps the identities stable across renders.
 *
 * They read direction and type scale through `useDirection()` / `typeScale()`
 * the same way `Field`, `Button` and `SelectChip` already do, so the rendered
 * output is identical to what they produced as closures.
 */

/** Same card + caption heading the Profile screen's sections use. */
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  const { locale, textAlign } = useDirection();
  const type = typeScale(locale);
  return (
    <View style={{ gap: spacing.sm }}>
      <Text
        style={[
          type.caption,
          {
            color: colors.textMuted,
            textAlign,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            fontWeight: '700',
            paddingHorizontal: spacing.xs,
          },
        ]}
      >
        {title}
      </Text>
      <View
        style={{
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.lg,
          padding: spacing.lg,
          gap: spacing.md,
        }}
      >
        {children}
      </View>
    </View>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  const { locale, textAlign } = useDirection();
  const type = typeScale(locale);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        minHeight: 44,
      }}
    >
      <Text style={[type.body, { color: colors.textMuted, textAlign }]}>{label}</Text>
      <Text
        style={[
          type.body,
          {
            color: colors.text,
            fontWeight: '600',
            flex: 1,
            // trailing edge, whichever side that is
            textAlign: locale === 'ar' ? 'left' : 'right',
          },
        ]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

/** Same inline success/error line the auth screens use. */
function NoteLine({ note }: { note: Note }) {
  const { locale, textAlign } = useDirection();
  const type = typeScale(locale);
  if (!note) return null;
  return (
    <Text
      style={[
        type.caption,
        { color: note.kind === 'error' ? colors.danger : colors.success, textAlign },
      ]}
    >
      {note.text}
    </Text>
  );
}

type Note = { kind: 'error' | 'success'; text: string } | null;
