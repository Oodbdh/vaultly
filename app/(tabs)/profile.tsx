import { useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LanguagePicker } from '@/components/LanguagePicker';
import { PremiumBanner } from '@/components/PremiumBanner';
import { RewardedSlotCard } from '@/components/RewardedSlotCard';
import { colors, radius, spacing, typeScale } from '@/theme';
import { useDirection } from '@/i18n/rtl';
import { useLanguage } from '@/hooks/useLanguage';
import { useAuthStore } from '@/store/authStore';
import { usePremium } from '@/hooks/usePremium';
import { usePaywall } from '@/hooks/usePaywall';
import { useSession } from '@/hooks/useSession';
import { APP_VERSION, openSupportEmail, type SupportTopic } from '@/services/support';

/**
 * Everything secondary lives here, so Home stays a status surface. Grouped into
 * four sections — Account, Preferences, Data, Support — rather than one long
 * scroll of equal-weight rows.
 */
export default function Profile() {
  const { t } = useTranslation();
  const { locale, textAlign, flipIcon } = useDirection();
  const type = typeScale(locale);
  const router = useRouter();
  const signOut = useAuthStore((s) => s.signOut);
  const profile = useAuthStore((s) => s.profile);
  const { user } = useSession();
  const { isPremium } = usePremium();
  const { restore } = usePaywall();
  const lang = useLanguage();
  const [warrantyReminders, setWarrantyReminders] = useState(true);
  const [renewalReminders, setRenewalReminders] = useState(true);

  const soon = (label: string) => Alert.alert(label);

  /**
   * Opens the mail client; if the device has none, the composed message is on
   * the clipboard and we surface the address so the action still leads
   * somewhere.
   */
  async function mail(topic: SupportTopic) {
    const outcome = await openSupportEmail(topic, t, locale, user?.id);
    if (outcome.status === 'copied') {
      Alert.alert(t('support.noMailApp'), t('support.copiedToClipboard', { email: outcome.email }));
    } else if (outcome.status === 'failed') {
      Alert.alert(t('support.noMailApp'), outcome.email);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[type.title, { color: colors.text, textAlign }]}>{t('nav.profile')}</Text>

        {/* Identity card doubles as the account row */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.lg,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.lg,
            padding: spacing.lg,
          }}
        >
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: radius.pill,
              backgroundColor: '#EDF0F6',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 20 }}>
              {(profile?.display_name ?? 'V').trim().charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[type.body, { color: colors.text, fontWeight: '700', textAlign }]}>
              {profile?.display_name ?? t('profile.account')}
            </Text>
            <Text style={[type.caption, { color: colors.textMuted, textAlign }]}>
              {isPremium ? t('settings.planPremium') : t('settings.planFree')}
            </Text>
          </View>
        </View>

        <PremiumBanner />
        {/* Free users only — the card returns null for premium. */}
        <RewardedSlotCard />

        <Section title={t('profile.sectionAccount')}>
          <LinkRow
            label={t('profile.account')}
            icon="person-outline"
            onPress={() => soon(t('profile.account'))}
          />
          <Divider />
          <LinkRow
            label={t('settings.managePlan')}
            icon="sparkles-outline"
            onPress={() => router.push('/paywall')}
          />
          <Divider />
          <LinkRow
            label={t('paywall.restore')}
            icon="refresh-outline"
            onPress={() => void restore()}
          />
        </Section>

        <Section title={t('profile.sectionPreferences')}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t('settings.language')}: ${lang.current.nativeName}`}
            onPress={lang.openPicker}
            style={({ pressed }) => ({
              minHeight: 56,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Ionicons name="language-outline" size={19} color={colors.primary} />
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={[type.body, { color: colors.text, textAlign }]}>
                {t('settings.language')}
              </Text>
              <Text style={[type.caption, { color: colors.textMuted, textAlign }]}>
                {lang.current.nativeName}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.border} style={flipIcon} />
          </Pressable>
          <Divider />
          <Row label={t('settings.warrantyReminders')} icon="notifications-outline">
            <Switch value={warrantyReminders} onValueChange={setWarrantyReminders} />
          </Row>
          <Divider />
          <Row label={t('settings.renewalReminders')} icon="repeat-outline">
            <Switch value={renewalReminders} onValueChange={setRenewalReminders} />
          </Row>
          <Divider />
          <LinkRow
            label={t('profile.categories')}
            icon="pricetags-outline"
            onPress={() => soon(t('profile.categories'))}
          />
        </Section>

        <Section title={t('profile.sectionData')}>
          <LinkRow
            label={t('profile.backup')}
            hint={t('profile.backupHint')}
            icon="cloud-upload-outline"
            onPress={() => soon(t('profile.backup'))}
          />
        </Section>

        <Section title={t('profile.sectionSupport')}>
          <LinkRow
            label={t('support.faq')}
            hint={t('support.faqHint')}
            icon="help-circle-outline"
            onPress={() => router.push('/support/faq')}
          />
          <Divider />
          <LinkRow
            label={t('support.contact')}
            hint={t('support.contactHint')}
            icon="mail-outline"
            onPress={() => void mail('contact')}
          />
          <Divider />
          <LinkRow
            label={t('support.reportBug')}
            hint={t('support.reportBugHint')}
            icon="bug-outline"
            onPress={() => void mail('bug')}
          />
          <Divider />
          <LinkRow
            label={t('support.requestFeature')}
            hint={t('support.requestFeatureHint')}
            icon="bulb-outline"
            onPress={() => void mail('feature')}
          />
          <Divider />
          <LinkRow
            label={t('support.privacy')}
            icon="lock-closed-outline"
            onPress={() => router.push('/support/legal?doc=privacy')}
          />
          <Divider />
          <LinkRow
            label={t('support.terms')}
            icon="document-text-outline"
            onPress={() => router.push('/support/legal?doc=terms')}
          />
          <Divider />
          <LinkRow
            label={t('profile.about')}
            hint={t('profile.version', { version: APP_VERSION })}
            icon="information-circle-outline"
            onPress={() =>
              Alert.alert(t('profile.about'), t('support.aboutBody', { version: APP_VERSION }))
            }
          />
          <Divider />
          <LinkRow
            label={t('settings.signOut')}
            icon="log-out-outline"
            onPress={() => void signOut()}
          />
          <Divider />
          <LinkRow
            label={t('settings.deleteAccount')}
            icon="trash-outline"
            danger
            onPress={() =>
              Alert.alert(t('settings.deleteAccount'), undefined, [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('common.delete'), style: 'destructive' },
              ])
            }
          />
        </Section>
      </ScrollView>

      <LanguagePicker
        open={lang.pickerOpen}
        onClose={lang.closePicker}
        languages={lang.languages}
        currentCode={lang.current.code}
        onSelect={(code) => void lang.change(code)}
      />
    </SafeAreaView>
  );

  function Divider() {
    return <View style={{ height: 1, backgroundColor: colors.border }} />;
  }

  function LinkRow({
    label,
    hint,
    icon,
    onPress,
    danger,
  }: {
    label: string;
    hint?: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    danger?: boolean;
  }) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          minHeight: 52,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Ionicons name={icon} size={19} color={danger ? colors.danger : colors.primary} />
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={[type.body, { color: danger ? colors.danger : colors.text, textAlign }]}>
            {label}
          </Text>
          {hint ? (
            <Text style={[type.caption, { color: colors.textMuted, textAlign }]} numberOfLines={1}>
              {hint}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={17} color={colors.border} style={flipIcon} />
      </Pressable>
    );
  }

  function Row({
    label,
    icon,
    children,
  }: {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    children?: React.ReactNode;
  }) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52 }}>
        <Ionicons name={icon} size={19} color={colors.primary} />
        <Text style={[type.body, { color: colors.text, flex: 1, textAlign }]}>{label}</Text>
        {children}
      </View>
    );
  }

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
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
            paddingHorizontal: spacing.lg,
          }}
        >
          {children}
        </View>
      </View>
    );
  }
}
