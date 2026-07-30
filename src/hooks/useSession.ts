import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';

import { USE_MOCK_DATA } from '@/constants/config';
import { supabase } from '@/lib/supabase';
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
    void supabase
      .from('profiles')
      .update({ locale: i18n.language as 'en' | 'ar' })
      .eq('id', user.id);
  }, [i18n.language, user, profile]);
}
