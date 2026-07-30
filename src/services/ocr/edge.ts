/**
 * Receipt OCR via the `analyze-receipt` Supabase Edge Function.
 *
 * This is the secure path and the default: the OpenAI key is a Supabase secret
 * held on the server, so nothing sensitive is compiled into the app bundle.
 * The client sends an image and receives structured fields.
 *
 * Uses `fetch` rather than `supabase.functions.invoke` for two reasons:
 * `FunctionInvokeOptions` has no `signal`, so invoke cannot be cancelled when
 * the user backs out of a scan; and reading the function's structured error
 * body is direct here instead of digging through a wrapped error object.
 */
import { env } from '@/constants/config';
import { supabase } from '@/lib/supabase';
import {
  normalise,
  toFailure,
  type ExtractFn,
  type ExtractionResult,
  type ReceiptExtraction,
} from './types';

const FUNCTION_NAME = 'analyze-receipt';

const REASONS = ['unreadable', 'network', 'quota', 'auth', 'unknown'] as const;
type Reason = (typeof REASONS)[number];

function isReason(v: unknown): v is Reason {
  return typeof v === 'string' && (REASONS as readonly string[]).includes(v);
}

export const extractViaEdgeFunction: ExtractFn = async (imageBase64, mimeType, signal) => {
  // The vision model has no PDF path; guard client-side so we don't pay for a
  // round trip that can only fail.
  if (mimeType === 'application/pdf') {
    return { ok: false, reason: 'unreadable', message: 'PDF is not supported by the vision model' };
  }

  // The function verifies the JWT, so an anonymous caller cannot spend quota.
  const { data: sessionRes } = await supabase.auth.getSession();
  const accessToken = sessionRes.session?.access_token;
  if (!accessToken) {
    return { ok: false, reason: 'auth', message: 'Sign in before scanning a receipt' };
  }

  try {
    const res = await fetch(`${env.supabaseUrl}/functions/v1/${FUNCTION_NAME}`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        apikey: env.supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ imageBase64, mimeType }),
    });

    const payload = (await res.json().catch(() => null)) as
      | { data?: Partial<ReceiptExtraction>; error?: { reason?: string; message?: string } }
      | null;

    if (!res.ok || payload?.error) {
      const reason = payload?.error?.reason;
      return {
        ok: false,
        reason: isReason(reason) ? reason : res.status === 401 ? 'auth' : 'unknown',
        message: payload?.error?.message ?? `HTTP ${res.status}`,
      };
    }

    if (!payload?.data) return { ok: false, reason: 'unreadable', message: 'Empty response' };

    // Validate on the client too — the screens' contract is `normalise`, not
    // whatever the model or the function happened to return.
    return { ok: true, data: normalise(payload.data) };
  } catch (e) {
    return toFailure(e) as ExtractionResult;
  }
};
