// Receipt extraction — a five-stage pipeline, not a single AI request.
//
//   1. Transcribe   vision model → ordered text blocks. No interpretation.
//   2. Candidates   deterministic rules propose every plausible value.
//   3. Validate     deterministic rules score and pick, 0-100 per field.
//   4. Reason       text-only LLM chooses among the candidates it was given.
//   5. Verify       text-only LLM adjudicates 3 vs 4, then a deterministic
//                   reconcile makes the final call and applies the floor.
//
// Why the split: stages 2 and 3 live in `pipeline.ts`, are pure, and are unit
// tested. The model never sees an image after stage 1 and never invents a value
// that was not already present as a candidate or corroborated by one — which is
// what makes "never fabricate" enforceable rather than merely requested.
//
// The OpenAI key stays a Supabase secret. JWT verification is left ON, so only
// signed-in users can spend quota.
//
// Deploy: supabase functions deploy analyze-receipt --use-api
import { createClient } from 'jsr:@supabase/supabase-js@2';

import {
  applyFloor,
  CONFIDENCE_FLOOR,
  detectCandidates,
  reconcile,
  validate,
  type BillingCycle,
  type Candidate,
  type Candidates,
  type TextBlock,
  type Validated,
} from './pipeline.ts';

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';

const MAX_BASE64_CHARS = 8_000_000;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

/** Bounds the cost of stages 4 and 5 on a long till receipt. */
const MAX_BLOCKS = 200;
const MAX_TRANSCRIPT_CHARS = 6000;

/**
 * Allowed `category` values. Closed list on purpose: it is the only thing that
 * makes it structurally impossible for the model to answer the category
 * question with a shop name.
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

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ── Stage 1: transcription ──────────────────────────────────────────────────

const TRANSCRIBE_PROMPT = `You are an OCR engine, not an analyst.

Transcribe EVERY readable text block from this receipt image.

Rules:
- Output blocks in natural reading order, top to bottom.
- If the image is rotated or upside down, read it in its correct orientation.
- If the image is tilted, blurry or badly lit, transcribe what you can read and
  omit what you genuinely cannot. Do NOT reconstruct or complete text.
- Keep the original language and script. Do not translate.
- Keep a line's label and its value together on one block ("Total  115.00").
- Preserve digits exactly as printed, including Arabic-Indic numerals.
- Do NOT interpret, summarise, reformat, correct or add anything.
- If nothing is legible, return an empty blocks array and legible=false.`;

const TRANSCRIBE_SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name: 'receipt_transcript',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        blocks: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: { text: { type: 'string' } },
            required: ['text'],
          },
        },
        language: { type: 'string', enum: ['ar', 'en', 'mixed', 'other'] },
        legible: { type: 'boolean' },
      },
      required: ['blocks', 'language', 'legible'],
    },
  },
};

// ── Stage 4: reasoning over validated candidates ────────────────────────────

const REASON_PROMPT = `You are given the OCR transcript of a receipt and, for each
field, the candidate values that deterministic rules already found in that
transcript. Your job is to CHOOSE, not to invent.

Hard rules:
- Prefer a candidate. Only supply a value that is not in the candidate list when
  it is plainly visible in the transcript, and then say so via a lower confidence.
- If the transcript does not support a value, return null. Never guess, never
  average, never carry a value over from a different field.
- Amounts: the grand total actually paid. Ignore subtotals unless no total
  exists, ignore VAT lines, ignore crossed-out and promotional "was" prices.
- merchantName: the selling business's trade name. Never an address, never a
  slogan, never a document header such as "Tax Invoice" / "فاتورة ضريبية".
- Dates: purchase date only. A due date, warranty expiry or renewal date is NOT
  the purchase date.
- warrantyExpiry: only if the transcript states an explicit warranty END DATE.
  If it states a duration, put months in warrantyMonths and leave expiry null.
  Never compute an expiry yourself.
- Subscriptions: only when the transcript shows recurring billing.
- confidence values are 0-100 and are per field. Below 70 means "I am not sure",
  and the field will be discarded — use it honestly.

Three fields are easy to confuse. Keep them strictly separate:
  merchantName — WHO sold it (the shop/business).
  productName  — WHAT was bought (the specific item).
  category     — WHAT KIND of thing it is (a generic class of goods).
Worked example — a Jarir Bookstore receipt for a Samsung 55" television:
  merchantName = "Jarir Bookstore", productName = "Samsung 55\\" TV",
  category = "Electronics".

category must be exactly one of: ${CATEGORIES.join(', ')}.
Judge it from what was sold, not from the shop's name. Use "Other" when nothing
fits. It is NEVER the shop's name and NEVER the specific product.`;

const FIELD_SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name: 'receipt_reasoning',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        purchaseType: { type: 'string', enum: ['subscription', 'product', 'unknown'] },
        merchantName: { type: ['string', 'null'] },
        productName: { type: ['string', 'null'] },
        serviceName: { type: ['string', 'null'] },
        totalAmount: { type: ['number', 'null'] },
        currency: { type: ['string', 'null'] },
        purchaseDate: { type: ['string', 'null'], description: 'yyyy-mm-dd' },
        warrantyExpiry: { type: ['string', 'null'], description: 'yyyy-mm-dd' },
        warrantyMonths: { type: ['integer', 'null'] },
        billingCycle: { type: ['string', 'null'], enum: ['weekly', 'monthly', 'quarterly', 'yearly', null] },
        nextRenewal: { type: ['string', 'null'], description: 'yyyy-mm-dd' },
        category: { type: ['string', 'null'], enum: [...CATEGORIES, null] },
        lineItemCount: { type: ['integer', 'null'] },
        confidence: {
          type: 'object',
          additionalProperties: false,
          properties: {
            merchantName: { type: 'number' },
            totalAmount: { type: 'number' },
            currency: { type: 'number' },
            purchaseDate: { type: 'number' },
            warrantyExpiry: { type: 'number' },
            warrantyMonths: { type: 'number' },
            billingCycle: { type: 'number' },
            nextRenewal: { type: 'number' },
            category: { type: 'number' },
          },
          required: [
            'merchantName', 'totalAmount', 'currency', 'purchaseDate',
            'warrantyExpiry', 'warrantyMonths', 'billingCycle', 'nextRenewal', 'category',
          ],
        },
      },
      required: [
        'purchaseType', 'merchantName', 'productName', 'serviceName', 'totalAmount',
        'currency', 'purchaseDate', 'warrantyExpiry', 'warrantyMonths', 'billingCycle',
        'nextRenewal', 'category', 'lineItemCount', 'confidence',
      ],
    },
  },
};

// ── Stage 5: verification ───────────────────────────────────────────────────

const VERIFY_PROMPT = `You are auditing a receipt extraction.

You are given: the OCR transcript, what deterministic rules concluded, and what a
reasoning pass concluded. For each field decide the correct final value.

- If both agree and the transcript supports it, keep it and raise confidence.
- If they disagree, pick the one the transcript actually supports. If neither is
  clearly supported, return null.
- If a value appears in neither the transcript nor either input, it is a
  hallucination: return null.
- Be strict. Returning null is always acceptable. Returning a wrong value is not.
- confidence is 0-100 per field. Below 70 the field is discarded.`;

// ── Orchestration ───────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return fail('unknown', 'Use POST', 405);

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    console.error('OPENAI_API_KEY secret is not set');
    return fail('unknown', 'Server is missing OPENAI_API_KEY', 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return fail('auth', 'Missing Authorization header', 401);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data: userRes } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!userRes?.user) return fail('auth', 'Invalid session', 401);

  let body: { imageBase64?: string; mimeType?: string };
  try {
    body = await req.json();
  } catch {
    return fail('unknown', 'Body must be JSON', 400);
  }

  const imageBase64 = body.imageBase64 ?? '';
  const mimeType = body.mimeType ?? 'image/jpeg';
  if (!imageBase64) return fail('unreadable', 'imageBase64 is required', 400);
  if (imageBase64.length > MAX_BASE64_CHARS) return fail('unreadable', 'Image too large', 413);
  if (!ALLOWED_MIME.includes(mimeType)) return fail('unreadable', `Unsupported mimeType: ${mimeType}`, 415);

  const model = Deno.env.get('OPENAI_MODEL') ?? DEFAULT_MODEL;
  const call = (messages: unknown[], schema: unknown) => callOpenAI(apiKey, model, messages, schema);

  try {
    // ── Stage 1 ─────────────────────────────────────────────────────────────
    const transcript = await call(
      [{
        role: 'user',
        content: [
          { type: 'text', text: TRANSCRIBE_PROMPT },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: 'high' } },
        ],
      }],
      TRANSCRIBE_SCHEMA,
    );
    if ('error' in transcript) return transcript.error;

    const raw = transcript.value as { blocks?: { text?: string }[]; language?: string; legible?: boolean };
    const blocks: TextBlock[] = (raw.blocks ?? [])
      .map((b, i) => ({ i, text: typeof b?.text === 'string' ? b.text : '', bbox: null }))
      .filter((b) => b.text.trim())
      .slice(0, MAX_BLOCKS);

    if (!raw.legible || blocks.length === 0) {
      return fail('unreadable', 'No readable text found in the image', 200);
    }

    const transcriptText = blocks
      .map((b) => `${b.i}: ${b.text}`)
      .join('\n')
      .slice(0, MAX_TRANSCRIPT_CHARS);

    // ── Stages 2 and 3 — deterministic, no model involved ───────────────────
    const candidates = detectCandidates(blocks);
    const rules = validate(candidates);

    // ── Stage 4 ─────────────────────────────────────────────────────────────
    const reasoning = await call(
      [
        { role: 'system', content: REASON_PROMPT },
        {
          role: 'user',
          content:
            `TRANSCRIPT (language: ${raw.language ?? 'unknown'}):\n${transcriptText}\n\n` +
            `CANDIDATES FOUND BY RULES:\n${describeCandidates(candidates)}`,
        },
      ],
      FIELD_SCHEMA,
    );
    if ('error' in reasoning) return reasoning.error;
    const llm = reasoning.value as LlmFields;

    // ── Stage 5 ─────────────────────────────────────────────────────────────
    const verified = await call(
      [
        { role: 'system', content: VERIFY_PROMPT },
        {
          role: 'user',
          content:
            `TRANSCRIPT:\n${transcriptText}\n\n` +
            `RULE-BASED RESULT:\n${describeValidated(rules)}\n\n` +
            `REASONING RESULT:\n${JSON.stringify(llm, null, 1)}`,
        },
      ],
      FIELD_SCHEMA,
    );
    // A failed audit is not fatal — fall back to the reasoning pass rather than
    // losing a scan the user already paid for in latency.
    const audit = 'error' in verified ? llm : (verified.value as LlmFields);

    return ok({ data: assemble(rules, audit) });
  } catch (e) {
    console.error('analyze-receipt failed', e);
    return fail('network', e instanceof Error ? e.message : String(e), 502);
  }
});

// ── Helpers ─────────────────────────────────────────────────────────────────

type LlmFields = {
  purchaseType?: 'subscription' | 'product' | 'unknown';
  merchantName?: string | null;
  productName?: string | null;
  serviceName?: string | null;
  totalAmount?: number | null;
  currency?: string | null;
  purchaseDate?: string | null;
  warrantyExpiry?: string | null;
  warrantyMonths?: number | null;
  billingCycle?: BillingCycle | null;
  nextRenewal?: string | null;
  category?: string | null;
  lineItemCount?: number | null;
  confidence?: Record<string, number>;
};

function conf(f: LlmFields, key: string): number {
  const v = f.confidence?.[key];
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0;
}

/** Compact, auditable rendering of stage 2 for the reasoning prompt. */
function describeCandidates(c: Candidates): string {
  const fmt = <T>(name: string, list: Candidate<T>[], render: (v: T) => string) =>
    list.length
      ? `${name}:\n` + list
          .slice(0, 8)
          .map((x) => `  - ${render(x.value)}  [conf ${x.confidence}, block ${x.block}, ${x.reason}]`)
          .join('\n')
      : `${name}: none found`;

  return [
    fmt('merchant', c.merchant, String),
    fmt('totalAmount', c.total, String),
    fmt('currency', c.currency, String),
    fmt('dates', c.dates, (v) => `${v.iso} (role: ${v.role})`),
    fmt('warrantyMonths', c.warrantyMonths, String),
    fmt('warrantyExpiry', c.warrantyExpiry, String),
    fmt('billingCycle', c.billingCycle, String),
    fmt('nextRenewal', c.nextRenewal, String),
    fmt('invoiceNumber', c.invoiceNumber, String),
    fmt('vatAmount', c.vatAmount, String),
    fmt('paymentMethod', c.paymentMethod, String),
    `recurringBillingDetected: ${c.isSubscription}`,
  ].join('\n');
}

function describeValidated(v: Validated): string {
  const line = <T>(name: string, c: Candidate<T> | null) =>
    `  ${name}: ${c ? `${JSON.stringify(c.value)} [conf ${c.confidence}]` : 'null'}`;
  return [
    line('merchantName', v.merchantName),
    line('totalAmount', v.totalAmount),
    line('currency', v.currency),
    line('purchaseDate', v.purchaseDate),
    line('warrantyMonths', v.warrantyMonths),
    line('warrantyExpiry', v.warrantyExpiry),
    line('billingCycle', v.billingCycle),
    line('nextRenewal', v.nextRenewal),
    line('invoiceNumber', v.invoiceNumber),
    line('vatAmount', v.vatAmount),
    line('paymentMethod', v.paymentMethod),
    `  purchaseType: ${v.purchaseType}`,
  ].join('\n');
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isoOrNull = (v: unknown) => (typeof v === 'string' && ISO_DATE.test(v) ? v : null);

/**
 * Final arbitration. `reconcile` is deliberately the last word: the audit pass
 * can raise confidence in a value the rules already found, but it cannot install
 * a value the rules rejected unless it is confident and the rules had nothing.
 */
function assemble(rules: Validated, f: LlmFields) {
  const merchant = reconcile(rules.merchantName, f.merchantName ?? null, conf(f, 'merchantName'),
    (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase());
  const total = reconcile(rules.totalAmount, typeof f.totalAmount === 'number' ? f.totalAmount : null,
    conf(f, 'totalAmount'), (a, b) => Math.abs(a - b) < 0.005);
  const currency = reconcile(rules.currency, f.currency ? f.currency.toUpperCase() : null, conf(f, 'currency'));
  const purchaseDate = reconcile(rules.purchaseDate, isoOrNull(f.purchaseDate), conf(f, 'purchaseDate'));
  const warrantyMonths = reconcile(rules.warrantyMonths,
    typeof f.warrantyMonths === 'number' ? f.warrantyMonths : null, conf(f, 'warrantyMonths'));
  const warrantyExpiry = reconcile(rules.warrantyExpiry, isoOrNull(f.warrantyExpiry), conf(f, 'warrantyExpiry'));
  const billingCycle = reconcile(rules.billingCycle, f.billingCycle ?? null, conf(f, 'billingCycle'));
  const nextRenewal = reconcile(rules.nextRenewal, isoOrNull(f.nextRenewal), conf(f, 'nextRenewal'));

  const purchaseType =
    f.purchaseType === 'subscription' || rules.purchaseType === 'subscription' ? 'subscription'
      : f.purchaseType === 'product' || rules.purchaseType === 'product' ? 'product'
        : 'unknown';

  // Category has no rule-based candidate — it is a judgement, not a token on the
  // receipt — so it rests on the model's own confidence alone, held to the same
  // floor as everything else.
  const category =
    conf(f, 'category') >= CONFIDENCE_FLOOR && typeof f.category === 'string' ? f.category : null;

  const fieldConfidence = {
    merchantName: merchant.confidence,
    totalAmount: total.confidence,
    currency: currency.confidence,
    purchaseDate: purchaseDate.confidence,
    warrantyExpiry: warrantyExpiry.confidence,
    warrantyMonths: warrantyMonths.confidence,
    billingCycle: billingCycle.confidence,
    nextRenewal: nextRenewal.confidence,
    category: conf(f, 'category'),
  };

  // Overall confidence stays 0..1 for backwards compatibility with the client.
  const scored = Object.values(fieldConfidence).filter((n) => n > 0);
  const overall = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length / 100 : 0;

  return {
    purchaseType,
    serviceName: purchaseType === 'subscription' ? (f.serviceName ?? null) : null,
    billingCycle: purchaseType === 'subscription' ? applyFloor(billingCycle) : null,
    nextRenewal: applyFloor(nextRenewal),
    productName: purchaseType === 'product' ? (f.productName ?? null) : null,
    merchantName: applyFloor(merchant),
    totalAmount: applyFloor(total),
    // A currency with no amount is noise; default only alongside a total.
    currency: applyFloor(currency) ?? (applyFloor(total) !== null ? 'SAR' : null),
    purchaseDate: applyFloor(purchaseDate),
    warrantyExpiry: applyFloor(warrantyExpiry),
    warrantyMonths: applyFloor(warrantyMonths),
    category,
    lineItemCount: typeof f.lineItemCount === 'number' ? f.lineItemCount : null,
    confidence: Math.round(overall * 100) / 100,
    // Extracted for cross-validation; no database column exists for these, so
    // they are informational only and the UI ignores them.
    invoiceNumber: rules.invoiceNumber?.value ?? null,
    vatAmount: rules.vatAmount?.value ?? null,
    paymentMethod: rules.paymentMethod?.value ?? null,
    fieldConfidence,
  };
}

/** One OpenAI call. Returns either the parsed value or a ready-made failure. */
async function callOpenAI(
  apiKey: string,
  model: string,
  messages: unknown[],
  response_format: unknown,
): Promise<{ value: unknown } | { error: Response }> {
  const res = await fetch(OPENAI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, temperature: 0, response_format, messages }),
  });

  if (res.status === 429) return { error: fail('quota', 'OpenAI rate limit or quota exceeded', 429) };
  if (res.status === 401 || res.status === 403) {
    console.error('OpenAI rejected the configured OPENAI_API_KEY');
    return { error: fail('unknown', 'Upstream authentication failed', 502) };
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error(`OpenAI HTTP ${res.status}: ${detail.slice(0, 500)}`);
    return { error: fail('unknown', `Upstream error ${res.status}`, 502) };
  }

  const json = await res.json();
  const message = json?.choices?.[0]?.message;
  if (message?.refusal) return { error: fail('unreadable', message.refusal, 200) };
  const text = message?.content;
  if (!text) return { error: fail('unreadable', 'Empty response', 200) };

  try {
    return { value: JSON.parse(text) };
  } catch {
    return { error: fail('unreadable', 'Model returned malformed JSON', 200) };
  }
}

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
