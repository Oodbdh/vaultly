import { STORAGE_BUCKET, USE_MOCK_DATA } from '@/constants/config';
import { supabase } from '@/lib/supabase';
import type { Profile, ProfileUpdate } from '@/lib/database.types';
import { mockFetchProfile, mockUpdateProfile } from '@/mocks/backend';

/**
 * Every read and write of `profiles`, in one place.
 *
 * Before this module the profile row was touched from three unrelated files —
 * `store/authStore.ts` (read), `hooks/useSession.ts` (locale write) and
 * `services/notifications.ts` (push-token write) — each repeating the
 * `USE_MOCK_DATA` branch. That spread is how the locale bug survived: the
 * write in `useSession` was fire-and-forget, so a CHECK violation on a
 * non-en/ar locale never surfaced anywhere. Reads and writes now share one
 * error path.
 *
 * Failures are returned, never thrown. Nothing here is on a path the user
 * asked to block on — the profile is metadata around the vault, not the vault.
 */

export type ProfileResult =
  | { ok: true; profile: Profile }
  | { ok: false; error: string };

export async function fetchProfile(userId: string): Promise<Profile | null> {
  if (USE_MOCK_DATA) return mockFetchProfile();

  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) {
    if (__DEV__) console.warn('[vaultly] profile read failed:', error.message);
    return null;
  }
  return data as Profile;
}

/**
 * Patch the row and return what Postgres actually stored.
 *
 * Returning the persisted row rather than the requested patch matters: a
 * defaulted or constrained column can come back different from what was sent,
 * and the caller should cache the truth.
 */
export type DeleteAccountResult =
  | { status: 'deleted' }
  /** Vault data is gone but the login still exists — see below. */
  | { status: 'data-only' }
  | { status: 'failed'; error: string };

/**
 * Permanently delete the account.
 *
 * Prefers the `delete-account` Edge Function, which holds the service role and
 * is the only thing that can remove the `auth.users` row — RLS grants no delete
 * on `profiles` and none is possible on `auth.users`.
 *
 * When that function is not deployed the client still erases everything it is
 * permitted to: every vault row (warranties and subscriptions cascade) and
 * every stored receipt image. That is reported as `data-only`, never as a
 * success, because the login would still exist.
 */
export async function deleteAccount(userId: string): Promise<DeleteAccountResult> {
  if (USE_MOCK_DATA) return { status: 'deleted' };

  const { error: fnError } = await supabase.functions.invoke('delete-account', {
    body: {},
  });
  if (!fnError) return { status: 'deleted' };

  if (__DEV__) {
    console.warn('[vaultly] delete-account function unavailable, erasing data only:', fnError.message);
  }

  try {
    const { data: files } = await supabase.storage.from(STORAGE_BUCKET).list(userId);
    if (files?.length) {
      await supabase.storage
        .from(STORAGE_BUCKET)
        .remove(files.map((f) => `${userId}/${f.name}`));
    }
    const { error } = await supabase.from('vault_items').delete().eq('user_id', userId);
    if (error) return { status: 'failed', error: error.message };
    return { status: 'data-only' };
  } catch (e) {
    return { status: 'failed', error: e instanceof Error ? e.message : String(e) };
  }
}

export async function updateProfile(
  userId: string,
  patch: ProfileUpdate,
): Promise<ProfileResult> {
  if (USE_MOCK_DATA) return { ok: true, profile: mockUpdateProfile(patch) };

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    if (__DEV__) console.warn('[vaultly] profile update failed:', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, profile: data as Profile };
}
