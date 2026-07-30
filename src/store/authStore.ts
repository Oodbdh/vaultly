import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';

import { USE_MOCK_DATA } from '@/constants/config';
import { authRedirectTo } from '@/lib/authRedirect';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/database.types';
import { mockProfile, mockSession } from '@/mocks/auth';
import { configurePurchases, logOutPurchases } from '@/services/purchases';

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  initialising: boolean;
  setSession: (session: Session | null) => void;
  loadProfile: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithEmail: (
    email: string,
    password: string,
    locale: 'en' | 'ar',
  ) => Promise<{ error?: string; needsConfirmation?: boolean }>;
  /** Re-sends the confirmation email, e.g. when the first link expired. */
  resendConfirmation: (email: string) => Promise<{ error?: string }>;
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

  loadProfile: async () => {
    if (USE_MOCK_DATA) {
      set({ profile: mockProfile });
      return;
    }
    const userId = get().user?.id;
    if (!userId) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) set({ profile: data });
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

  signOut: async () => {
    await logOutPurchases();
    if (!USE_MOCK_DATA) await supabase.auth.signOut();
    set({ session: null, user: null, profile: null, initialising: false });
  },
}));

function applyMockSession(): void {
  useAuthStore.setState({
    session: mockSession,
    user: mockSession.user,
    profile: mockProfile,
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
