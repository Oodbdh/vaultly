import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';

import { USE_MOCK_DATA } from '@/constants/config';
import { updateProfile } from '@/services/profile';
import { useAuthStore, subscribeToAuth } from '@/store/authStore';

export function useSession() {
  const { session, user, profile, initialising } = useAuthStore();
  return { session, user, profile, initialising, isSignedIn: !!session };
}

export function useAuthSubscription() {
  useEffect(subscribeToAuth, []);
}

/** Keeps the profile's stored locale in sync with the active UI language. */
export function useSyncProfileLocale() {
  const { i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);

  useEffect(() => {
    if (USE_MOCK_DATA) return; // nothing to persist to
    if (!user || !profile) return;
    if (profile.locale === i18n.language) return;
    // Through the service, so this write shares the one error path rather than
    // discarding its result — a narrow `locale` CHECK used to fail here in
    // total silence. The column is plain text; the accepted set is the CHECK in
    // migrations/0004, kept in step with SUPPORTED_LOCALES.
    void updateProfile(user.id, { locale: i18n.language });
  }, [i18n.language, user, profile]);
}
