/**
 * Gemini receipt extraction. Kept alongside the OpenAI provider so the model
 * can be switched from `.env` without touching a screen.
 *
 * ⚠️ Same prototype posture as the OpenAI provider: the key ships in the
 * bundle. Move behind an Edge Function before release.
 */
import { env } from '@/constants/config';
import {
  PROMPT,
  SCHEMA_PROPERTIES,
  normalise,
  toFailure,
  type ExtractFn,
  type ExtractionResult,
  type ReceiptExtraction,
} from './types';

function endpoint(): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel}:generateContent`;
}

// Gemini uses `nullable: true` rather than a ['string','null'] type union.
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    purchaseType: { type: 'string', enum: ['subscription', 'product', 'unknown'] },
    serviceName: { type: 'string', nullable: true },
    billingCycle: {
      type: 'string',
      nullable: true,
      enum: ['weekly', 'monthly', 'quarterly', 'yearly'],
    },
    nextRenewal: { type: 'string', nullable: true, description: 'yyyy-mm-dd' },
    productName: { type: 'string', nullable: true },
    merchantName: { type: 'string', nullable: true },
    totalAmount: { type: 'number', nullable: true },
    currency: { type: 'string', nullable: true, description: 'ISO 4217, e.g. SAR' },
    purchaseDate: { type: 'string', nullable: true, description: 'yyyy-mm-dd' },
    warrantyExpiry: { type: 'string', nullable: true, description: 'yyyy-mm-dd' },
    warrantyMonths: { type: 'integer', nullable: true },
    category: { type: 'string', nullable: true },
    lineItemCount: { type: 'integer', nullable: true },
    confidence: { type: 'number' },
  },
  required: Object.keys(SCHEMA_PROPERTIES),
} as const;

export const extractWithGemini: ExtractFn = async (imageBase64, mimeType, signal) => {
  if (!env.geminiApiKey) {
    return { ok: false, reason: 'auth', message: 'GEMINI_API_KEY not configured' };
  }

  try {
    const res = await fetch(endpoint(), {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': env.geminiApiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data: imageBase64 } }],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    });

    if (res.status === 401 || res.status === 403) {
      return { ok: false, reason: 'auth', message: 'Gemini rejected the API key' };
    }
    if (res.status === 429) return { ok: false, reason: 'quota' };
    if (!res.ok) return { ok: false, reason: 'unknown', message: `HTTP ${res.status}` };

    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return { ok: false, reason: 'unreadable' };

    return { ok: true, data: normalise(JSON.parse(text) as Partial<ReceiptExtraction>) };
  } catch (e) {
    return toFailure(e) as ExtractionResult;
  }
};
