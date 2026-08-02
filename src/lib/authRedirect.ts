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
 *
 * ⚠️ **Pass the path with no leading slash.** `createURL` builds the URL as
 * `${scheme}://${hostUri}${path}`, and in a build with a custom scheme
 * `hostUri` is empty and gets normalised to `'/'`. A path of `/auth-callback`
 * therefore yields `vaultly:///auth-callback` — *three* slashes — while
 * `auth-callback` yields the intended `vaultly://auth-callback`.
 *
 * The triple-slash form broke Google sign-in in a way that showed no error at
 * all: it is not on the Supabase redirect allow-list, and it is also the
 * `returnUrl` that `WebBrowser.openAuthSessionAsync` matches the incoming deep
 * link against with `startsWith`. The redirect that came back therefore never
 * matched, the browser resolved `dismiss` instead of `success`, and
 * `sign-in.tsx` silently returned without ever exchanging the `code`.
 */
export const AUTH_CALLBACK_PATH = 'auth-callback';

export function authRedirectTo(): string {
  return Linking.createURL(AUTH_CALLBACK_PATH);
}
