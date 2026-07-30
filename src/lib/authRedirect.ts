import * as Linking from 'expo-linking';

/**
 * Where Supabase sends the user back to after they click a link in an email
 * (confirm signup, password reset) or finish an OAuth handshake.
 *
 * One helper, because the correct value differs per runtime and getting it
 * wrong is silent — the email link just opens a browser and stops:
 *
 *   Expo Go        exp://<host>/--/auth-callback
 *   dev/prod build vaultly://auth-callback        (scheme from app.config.ts)
 *
 * `Linking.createURL` picks the right form automatically, so the same code
 * ships everywhere. Every generated form has to be on the Supabase redirect
 * allow-list — see README → "Email verification".
 */
export const AUTH_CALLBACK_PATH = 'auth-callback';

export function authRedirectTo(): string {
  return Linking.createURL(`/${AUTH_CALLBACK_PATH}`);
}
