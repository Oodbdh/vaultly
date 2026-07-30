/**
 * Receipt OCR entry point.
 *
 * `extractReceipt` is the single call site the app uses; which backend answers
 * it is decided by `AI_PROVIDER` in `src/constants/config.ts`.
 *
 *   edge   (default) → the `analyze-receipt` Supabase Edge Function. The OpenAI
 *                      key is a server-side secret; the app never holds it.
 *   gemini (opt-in)  → direct client call, key in the bundle. Legacy path,
 *                      kept only because it predates the Edge Function.
 *
 * Every provider returns the same validated `ReceiptExtraction`, so screens are
 * unaffected by the choice.
 */
import { AI_PROVIDER, USE_MOCK_OCR } from '@/constants/config';
import { mockExtractReceipt } from '@/mocks/ocr';
import { extractViaEdgeFunction } from './edge';
import { extractWithGemini } from './gemini';
import type { ExtractionResult, ImageMimeType } from './types';

export * from './types';

/**
 * @param imageBase64 raw base64 (no data: prefix)
 */
export async function extractReceipt(
  imageBase64: string,
  mimeType: ImageMimeType = 'image/jpeg',
  signal?: AbortSignal,
): Promise<ExtractionResult> {
  // Nothing configured (or mock mode) → canned extraction, so the scan flow
  // stays walkable before any backend exists.
  if (USE_MOCK_OCR) return mockExtractReceipt();

  const provider = AI_PROVIDER === 'gemini' ? extractWithGemini : extractViaEdgeFunction;
  return provider(imageBase64, mimeType, signal);
}

export { extractViaEdgeFunction, extractWithGemini };
