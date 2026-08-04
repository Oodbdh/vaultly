import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';

import { USE_MOCK_DATA } from '@/constants/config';
import { authRedirectTo } from '@/lib/authRedirect';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/database.types';
import { mockProfile, mockSession } from '@/mocks/auth';
import { setReminderPreferences } from '@/services/notifications';
import { fetchProfile } from '@/services/profile';
import { configurePurchases, logOutPurchases } from '@/services/purchases';

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  initialising: boolean;
  setSession: (session: Session | null) => void;
  /** Cache a row the profile service has already persisted. */
  setProfile: (profile: Profile) => void;
  loadProfile: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithEmail: (
    email: string,
    password: string,
    locale: 'en' | 'ar',
  ) => Promise<{ error?: string; needsConfirmation?: boolean }>;
  /** Re-sends the confirmation email, e.g. when the first link expired. */
  resendConfirmation: (email: string) => Promise<{ error?: string }>;
  /**
   * Starts Supabase's email-change flow. The address on the account does NOT
   * move until the link in the email is opened — Supabase holds the new address
   * as pending and swaps it on verification, so a typo can never lock anyone
   * out. With "Secure email change" on (the default) it mails both the old and
   * the new address and requires both to confirm.
   */
  updateEmail: (email: string) => Promise<{ error?: string }>;
  /** Sets a new password for the signed-in user. */
  updatePassword: (password: string) => Promise<{ error?: string }>;
  /**
   * Re-reads the user from Supabase and reissues the access token.
   *
   * Needed after an email change is confirmed: the email is a *claim inside the
   * JWT*, so the token already on the device keeps reporting the old address
   * until it is reissued, even though the change landed server-side.
   */
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
};

/** Supabase surfaces this when a correct password is used before confirming. */
export const EMAIL_NOT_CONFIRMED = 'email_not_confirmed';

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  initialising: true,

  setSession: (session) => set({ session, user: session?.user ?? null, initialising: false }),

  setProfile: (profile) => set({ profile: mirrorReminderPrefs(profile) }),

  loadProfile: async () => {
    const userId = get().user?.id;
    if (!userId) return;
    const profile = await fetchProfile(userId);
    if (profile) set({ profile: mirrorReminderPrefs(profile) });
  },

  signInWithEmail: async (email, password) => {
    if (USE_MOCK_DATA) {
      applyMockSession();
      return {};
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) return {};
    // Pass the machine-readable code up so the UI can offer "resend" instead of
    // claiming the password was wrong.
    return { error: error.code ?? error.message };
  },

  signUpWithEmail: async (email, password, locale) => {
    if (USE_MOCK_DATA) {
      applyMockSession();
      return {};
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { locale },
        // Without this the link falls back to SITE_URL, which on a web-shaped
        // default opens a browser page instead of the app.
        emailRedirectTo: authRedirectTo(),
      },
    });
    if (error) return { error: error.message };
    return { needsConfirmation: !data.session };
  },

  resendConfirmation: async (email) => {
    if (USE_MOCK_DATA) return {};
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: authRedirectTo() },
    });
    return error ? { error: error.message } : {};
  },

  updateEmail: async (email) => {
    // The mock backend cannot send mail, so returning `{}` here reported
    // "verification link sent" for an operation that never left the device —
    // indistinguishable, from the user's side, from a broken mail server. Every
    // other mock write can be faked honestly because the result is local; this
    // one cannot. Fail loudly instead.
    //
    // The string is deliberately untranslated: it is unreachable in a shipped
    // build, where Supabase credentials are always present and USE_MOCK_DATA is
    // therefore false.
    if (USE_MOCK_DATA) {
      if (__DEV__) {
        console.warn(
          '[vaultly] updateEmail called with USE_MOCK_DATA on — no email was sent. ' +
            'Restart Metro without EXPO_PUBLIC_USE_MOCK_DATA to exercise the real flow.',
        );
      }
      return { error: 'Email change needs the live backend. Mock mode cannot send mail.' };
    }

    const { error } = await supabase.auth.updateUser(
      { email },
      // Same callback the signup link uses; `authCallback.ts` already accepts
      // the `email_change` OTP type, so verification lands back in the app.
      { emailRedirectTo: authRedirectTo() },
    );
    return error ? { error: error.message } : {};
  },

  updatePassword: async (password) => {
    if (USE_MOCK_DATA) return {};
    const { error } = await supabase.auth.updateUser({ password });
    return error ? { error: error.message } : {};
  },

  refreshUser: async () => {
    if (USE_MOCK_DATA) return;

    // A new token carries the updated claims. This is the step that actually
    // makes a confirmed email change visible without a restart or re-login.
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.session) {
      set({ session: data.session, user: data.session.user });
      return;
    }

    // Refresh can legitimately fail (offline, or the refresh token was rotated
    // by the confirmation itself). Fall back to the server's view of the user,
    // which is authoritative even when the local token is stale.
    const { data: fresh } = await supabase.auth.getUser();
    if (fresh.user) set({ user: fresh.user });
  },

  signOut: async () => {
    // Every remote call here is best-effort and must not gate the local
    // teardown. Awaiting them first is what made the button look dead: a
    // hanging or failing /logout meant `set` never ran, so the user stayed on
    // Profile with no error and no state change.
    try {
      await logOutPurchases();
    } catch {
      /* RevenueCat absent or not configured — irrelevant to signing out */
    }

    if (!USE_MOCK_DATA) {
      try {
        await supabase.auth.signOut();
      } catch {
        // Global sign-out needs the network to revoke other devices' tokens.
        // When it cannot, still clear this device's stored session, or a
        // restart would silently restore the one we just "signed out" of.
        try {
          await supabase.auth.signOut({ scope: 'local' });
        } catch {
          /* storage will be overwritten by the next sign-in regardless */
        }
      }
    }

    set({ session: null, user: null, profile: null, initialising: false });
    mirrorReminderPrefs(null);
  },
}));

/**
 * Push the row's reminder preferences into `services/notifications`, which
 * consults them before scheduling anything.
 *
 * The service holds them as module state rather than reaching into this store,
 * so every path that sets `profile` has to hand them over — this is that hand
 * off, and it returns the profile so it can wrap a `set` inline. A null profile
 * (signed out) restores the defaults.
 */
function mirrorReminderPrefs<T extends Profile | null>(profile: T): T {
  setReminderPreferences({
    warranty: profile?.warranty_reminders ?? true,
    renewal: profile?.renewal_reminders ?? true,
  });
  return profile;
}

function applyMockSession(): void {
  useAuthStore.setState({
    session: mockSession,
    user: mockSession.user,
    profile: mirrorReminderPrefs(mockProfile),
    initialising: false,
  });
}

/** Wired once from the root layout. */
export function subscribeToAuth(): () => void {
  if (USE_MOCK_DATA) {
    // Start signed in so the gate lands on Home; sign-out still returns to the
    // auth screens, and signing back in re-applies this same session.
    applyMockSession();
    return () => {};
  }

  supabase.auth.getSession().then(({ data }) => {
    useAuthStore.getState().setSession(data.session);
    if (data.session) {
      void configurePurchases(data.session.user.id);
      void useAuthStore.getState().loadProfile();
    } else {
      void configurePurchases(null);
    }
  });

  const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
    useAuthStore.getState().setSession(session);
    if (session) {
      void configurePurchases(session.user.id);
      void useAuthStore.getState().loadProfile();
    }
  });

  return () => sub.subscription.unsubscribe();
}
