import type { EmailOtpType } from '@supabase/supabase-js';

import { supabase } from './supabase';

/**
 * Turns an incoming auth deep link into a session.
 *
 * Supabase can hand back four different shapes depending on the flow, the
 * email template and whether something went wrong, so all four are handled
 * here rather than assuming one:
 *
 *   ?code=...                        PKCE — the default for this client
 *   ?token_hash=...&type=signup      templates using {{ .TokenHash }}
 *   #access_token=...&refresh_token= implicit flow / older templates
 *   ?error=...&error_description=... expired or already-used link
 *
 * Query and fragment are both parsed because native deep links deliver the
 * fragment intact, and Supabase puts tokens there in the implicit flow.
 */

export type AuthCallbackResult =
  | { status: 'signed-in' }
  | { status: 'ignored' }
  /**
   * The link was accepted but produced no session, and GoTrue explained why in
   * plain text. The email-change flow does this when "Secure email change" is
   * on: confirming one address returns "Please proceed to confirm link sent to
   * the other email" and holds `email_change_confirm_status` at 1 until the
   * second link is opened. Treating that as `ignored` is what made the flow
   * look like it silently did nothing.
   */
  | { status: 'notice'; message: string }
  | { status: 'error'; message: string };

/** Collects params from both `?query` and `#fragment` into one map. */
function paramsOf(url: string): URLSearchParams {
  const out = new URLSearchParams();
  const qIndex = url.indexOf('?');
  const hIndex = url.indexOf('#');

  if (qIndex >= 0) {
    const end = hIndex > qIndex ? hIndex : url.length;
    for (const [k, v] of new URLSearchParams(url.slice(qIndex + 1, end))) out.set(k, v);
  }
  if (hIndex >= 0) {
    for (const [k, v] of new URLSearchParams(url.slice(hIndex + 1))) out.set(k, v);
  }
  return out;
}

const OTP_TYPES: EmailOtpType[] = ['signup', 'recovery', 'invite', 'magiclink', 'email_change'];

function asOtpType(v: string | null): EmailOtpType | null {
  return v && (OTP_TYPES as string[]).includes(v) ? (v as EmailOtpType) : null;
}

export async function completeAuthFromUrl(url: string): Promise<AuthCallbackResult> {
  const params = paramsOf(url);

  // Supabase reports failures as query params, not HTTP errors — an expired or
  // already-consumed link lands here.
  const error = params.get('error') ?? params.get('error_code');
  if (error) {
    return {
      status: 'error',
      message: params.get('error_description')?.replace(/\+/g, ' ') ?? error,
    };
  }

  // 1. PKCE. The verifier was stored at signUp time, so this only works on the
  //    device that started the flow — which is the normal mobile case.
  const code = params.get('code');
  if (code) {
    const { error: e } = await supabase.auth.exchangeCodeForSession(code);
    return e ? { status: 'error', message: e.message } : { status: 'signed-in' };
  }

  // 2. Token hash — used when the email template emits {{ .TokenHash }}.
  //    Works cross-device, since nothing local is required.
  const tokenHash = params.get('token_hash') ?? params.get('token');
  const type = asOtpType(params.get('type'));
  if (tokenHash && type) {
    const { error: e } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    return e ? { status: 'error', message: e.message } : { status: 'signed-in' };
  }

  // 3. Implicit flow / OAuth returning tokens directly.
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (access_token && refresh_token) {
    const { error: e } = await supabase.auth.setSession({ access_token, refresh_token });
    return e ? { status: 'error', message: e.message } : { status: 'signed-in' };
  }

  // 4. No session to establish, but GoTrue said something worth showing. Checked
  //    last so a link carrying both a credential and a message still redeems.
  const notice = params.get('message');
  if (notice) return { status: 'notice', message: notice.replace(/\+/g, ' ') };

  // Not an auth link — e.g. the app was opened by some other deep link.
  return { status: 'ignored' };
}
