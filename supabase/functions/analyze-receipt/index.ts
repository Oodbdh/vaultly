// Receipt OCR. The OpenAI key lives here as a Supabase secret and never leaves
// the server — the client posts an image and gets structured fields back.
//
// Deploy:
//   supabase secrets set OPENAI_API_KEY=sk-...
//   supabase functions deploy analyze-receipt
//
// JWT verification is left ON (the default), so only signed-in users can spend
// your OpenAI quota. `supabase.functions.invoke` sends the session token
// automatically.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';

/** Rejects oversized payloads before they reach OpenAI. ~8MB of base64. */
const MAX_BASE64_CHARS = 8_000_000;

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Allowed `category` values. Closed list on purpose: it is the only thing that
 * makes it structurally impossible for the model to answer the category
 * question with a shop name, which is exactly what it used to do when the
 * prompt said nothing about the field.
 *
 * Mirrored in src/services/ocr/types.ts (RECEIPT_CATEGORIES). The Edge Function
 * is a separate Deno bundle and cannot import from src/, so the two copies must
 * be edited together.
 */
const CATEGORIES = [
  'Electronics', 'Groceries', 'Clothing', 'Restaurant', 'Pharmacy', 'Furniture',
  'Fuel', 'Telecom', 'Entertainment', 'Health', 'Beauty', 'Home', 'Automotive',
  'Books', 'Sports', 'Travel', 'Services', 'Other',
];

const PROMPT = `You extract structured data from a photo of a purchase receipt or invoice.
The receipt may be in English or Arabic; Saudi (SAR) receipts are common.

Three fields are easy to confuse. Keep them strictly separate:
  merchantName — WHO sold it (the shop/business).
  productName  — WHAT was bought (the specific item).
  category     — WHAT KIND of thing it is (a generic class of goods).
Worked example — a Jarir Bookstore receipt for a Samsung 55" television:
  merchantName = "Jarir Bookstore"
  productName  = "Samsung 55\\" TV"
  category     = "Electronics"
Never put a shop name in productName or category. Never put a product name in
merchantName or category. Never put a category in merchantName or productName.

Rules:
- purchaseType: "subscription" for a recurring service charge (streaming, software,
  cloud storage, telecom plan, gym membership — anything that bills again), "product"
  for a physical item that could carry a warranty, "unknown" when neither is clear.
- serviceName / billingCycle / nextRenewal: fill these ONLY for subscriptions. Infer the
  cycle from wording like "monthly", "1 month", "annual". If the receipt states the next
  billing date, normalise it to yyyy-mm-dd; otherwise leave null.
- productName: fill ONLY for products — the item bought, not the store.
- merchantName: the store's trade name, in the language printed on the receipt.
  This is the business, never the item and never the class of item.
- category: the kind of goods or service the receipt is for. Choose exactly one of:
  ${CATEGORIES.join(', ')}.
  Judge it from what was sold, not from the shop's name. Use "Other" when nothing
  fits. This is NEVER the shop's name and NEVER the specific product.
- totalAmount: the grand total actually paid, including VAT. Number only.
- currency: ISO 4217 code. Default to "SAR" when a Saudi VAT number or ر.س appears.
- purchaseDate: normalise to yyyy-mm-dd. Convert Hijri dates to Gregorian.
- warrantyExpiry: ONLY if the receipt explicitly states a warranty end date.
  If it states a duration instead, set warrantyMonths and leave warrantyExpiry null.
  If it says nothing about warranty, set both to null. Never guess.
- confidence: your own 0-1 confidence in the extracted fields overall.
Return null for any field you cannot read. Do not invent values.`;

// Structured Outputs: strict mode needs every key in `required`, with null
// allowed instead of optionality.
const SCHEMA_PROPERTIES = {
  purchaseType: { type: 'string', enum: ['subscription', 'product', 'unknown'] },
  serviceName: { type: ['string', 'null'] },
  billingCycle: { type: ['string', 'null'], enum: ['weekly', 'monthly', 'quarterly', 'yearly', null] },
  nextRenewal: { type: ['string', 'null'], description: 'yyyy-mm-dd' },
  productName: { type: ['string', 'null'] },
  merchantName: { type: ['string', 'null'] },
  totalAmount: { type: ['number', 'null'] },
  currency: { type: ['string', 'null'], description: 'ISO 4217, e.g. SAR' },
  purchaseDate: { type: ['string', 'null'], description: 'yyyy-mm-dd' },
  warrantyExpiry: { type: ['string', 'null'], description: 'yyyy-mm-dd' },
  warrantyMonths: { type: ['integer', 'null'] },
  // Enum, not free text: Structured Outputs then rejects anything off-list at
  // the API boundary, so a merchant name cannot reach the category column.
  category: { type: ['string', 'null'], enum: [...CATEGORIES, null] },
  lineItemCount: { type: ['integer', 'null'] },
  confidence: { type: 'number' },
};

const RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'receipt_extraction',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: SCHEMA_PROPERTIES,
      required: Object.keys(SCHEMA_PROPERTIES),
    },
  },
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return fail('unknown', 'Use POST', 405);

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    // Misconfiguration, not a user error — make it obvious in the logs.
    console.error('OPENAI_API_KEY secret is not set');
    return fail('unknown', 'Server is missing OPENAI_API_KEY', 500);
  }

  // Identify the caller. Only signed-in users may spend OpenAI quota.
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return fail('auth', 'Missing Authorization header', 401);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data: userRes } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
  const user = userRes?.user;
  if (!user) return fail('auth', 'Invalid session', 401);

  let body: { imageBase64?: string; mimeType?: string };
  try {
    body = await req.json();
  } catch {
    return fail('unknown', 'Body must be JSON', 400);
  }

  const imageBase64 = body.imageBase64 ?? '';
  const mimeType = body.mimeType ?? 'image/jpeg';

  if (!imageBase64) return fail('unreadable', 'imageBase64 is required', 400);
  if (imageBase64.length > MAX_BASE64_CHARS) {
    return fail('unreadable', 'Image too large', 413);
  }
  if (!ALLOWED_MIME.includes(mimeType)) {
    return fail('unreadable', `Unsupported mimeType: ${mimeType}`, 415);
  }

  const model = Deno.env.get('OPENAI_MODEL') ?? DEFAULT_MODEL;

  try {
    const res = await fetch(OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: RESPONSE_FORMAT,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: PROMPT },
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: 'high' },
              },
            ],
          },
        ],
      }),
    });

    if (res.status === 429) return fail('quota', 'OpenAI rate limit or quota exceeded', 429);
    if (res.status === 401 || res.status === 403) {
      // The stored secret is wrong — surface as a server fault, never as the
      // caller's problem, and never echo the key.
      console.error('OpenAI rejected the configured OPENAI_API_KEY');
      return fail('unknown', 'Upstream authentication failed', 502);
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`OpenAI HTTP ${res.status}: ${detail.slice(0, 500)}`);
      return fail('unknown', `Upstream error ${res.status}`, 502);
    }

    const json = await res.json();
    const message = json?.choices?.[0]?.message;
    if (message?.refusal) return fail('unreadable', message.refusal, 200);

    const text = message?.content;
    if (!text) return fail('unreadable', 'Empty response', 200);

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return fail('unreadable', 'Model returned malformed JSON', 200);
    }

    return ok({ data: parsed });
  } catch (e) {
    console.error('analyze-receipt failed', e);
    return fail('network', e instanceof Error ? e.message : String(e), 502);
  }
});

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

/** `reason` matches the client's ExtractionResult union so the UI can branch. */
function fail(
  reason: 'unreadable' | 'network' | 'quota' | 'auth' | 'unknown',
  message: string,
  status: number,
) {
  return new Response(JSON.stringify({ error: { reason, message } }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
