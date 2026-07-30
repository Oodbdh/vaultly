import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { env } from '@/constants/config';
import type { Database } from './database.types';

export const supabase = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // RN has no URL to parse; deep links are handled explicitly in the auth flow.
    detectSessionInUrl: false,
    // PKCE is the correct flow for a native client: the email link carries a
    // short-lived `code` rather than tokens, and the code is worthless without
    // the verifier stored on this device. It also survives the link being
    // prefetched by an email client, which the implicit flow does not.
    flowType: 'pkce',
  },
  global: { headers: { 'x-vaultly-platform': Platform.OS } },
});

// Keep tokens fresh only while the app is in the foreground.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

export const QUOTA_ERROR = 'VAULTLY_QUOTA_EXCEEDED';
export function isQuotaError(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'message' in error &&
    String((error as { message: unknown }).message).includes(QUOTA_ERROR);
}
