import { addBillingCycle, addMonths, isValidISODate, todayISO } from '@/lib/dateMath';

/**
 * Provider-agnostic receipt extraction: the shape, the prompt, the validation
 * and the pure date helpers. Each provider under `ocr/` only has to turn an
 * image into JSON matching `ReceiptExtraction`; everything else is shared, so
 * swapping models can never change what the screens receive.
 */

/** What the receipt is: a recurring service, a physical product, or unclear. */
export type PurchaseType = 'subscription' | 'product' | 'unknown';

export type ReceiptExtraction = {
  purchaseType: PurchaseType;
  /** Subscriptions only — the service being billed, e.g. "Netflix". */
  serviceName: string | null;
  billingCycle: 'weekly' | 'monthly' | 'quarterly' | 'yearly' | null;
  nextRenewal: string | null;   // ISO yyyy-mm-dd
  /** Products only — what was bought, e.g. "Samsung 55\" TV". */
  productName: string | null;
  merchantName: string | null;
  totalAmount: number | null;
  currency: string | null;
  purchaseDate: string | null;      // ISO yyyy-mm-dd
  warrantyExpiry: string | null;    // ISO yyyy-mm-dd, null when not stated
  warrantyMonths: number | null;    // stated term, if the receipt gives one
  category: string | null;
  lineItemCount: number | null;
  confidence: number;               // 0..1, self-reported by the model
};

export type ExtractionResult =
  | { ok: true; data: ReceiptExtraction }
  | { ok: false; reason: 'unreadable' | 'network' | 'quota' | 'auth' | 'unknown'; message?: string };

export type ImageMimeType = 'image/jpeg' | 'image/png' | 'application/pdf';

/** Signature every provider implements. */
export type ExtractFn = (
  imageBase64: string,
  mimeType: ImageMimeType,
  signal?: AbortSignal,
) => Promise<ExtractionResult>;

/**
 * Allowed `category` values — a closed list so the field cannot be answered
 * with a shop name. `normalise()` enforces it again on the client, so an
 * off-list value becomes null rather than being written to the database.
 *
 * Mirrored in supabase/functions/analyze-receipt/index.ts (CATEGORIES). That
 * function is a separate Deno bundle and cannot import from src/, so the two
 * copies must be edited together.
 */
export const RECEIPT_CATEGORIES = [
  'Electronics', 'Groceries', 'Clothing', 'Restaurant', 'Pharmacy', 'Furniture',
  'Fuel', 'Telecom', 'Entertainment', 'Health', 'Beauty', 'Home', 'Automotive',
  'Books', 'Sports', 'Travel', 'Services', 'Other',
] as const;

export type ReceiptCategory = (typeof RECEIPT_CATEGORIES)[number];

export const PROMPT = `You extract structured data from a photo of a purchase receipt or invoice.
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
  ${RECEIPT_CATEGORIES.join(', ')}.
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

/** The field list, shared by both providers' structured-output schemas. */
export const SCHEMA_PROPERTIES = {
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
  category: { type: ['string', 'null'], enum: [...RECEIPT_CATEGORIES, null] },
  lineItemCount: { type: ['integer', 'null'] },
  confidence: { type: 'number' },
} as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CYCLES = ['weekly', 'monthly', 'quarterly', 'yearly'] as const;

/**
 * Second gate on `category`, after the response schema's enum.
 *
 * Anything not on the list becomes null rather than being passed through, so a
 * model that ignores the schema — or the Gemini provider, whose schema dialect
 * has no enum support — still cannot put a shop name in the category column.
 * Matched case-insensitively and returned in canonical casing.
 */
function canonicalCategory(v: unknown): ReceiptCategory | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase();
  if (!s) return null;
  return RECEIPT_CATEGORIES.find((c) => c.toLowerCase() === s) ?? null;
}

/**
 * Never trust the model's JSON directly — a hallucinated date or a string where
 * a number belongs would flow straight into the database otherwise.
 */
export function normalise(raw: Partial<ReceiptExtraction>): ReceiptExtraction {
  const date = (v: unknown) => (typeof v === 'string' && ISO_DATE.test(v) ? v : null);
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  return {
    purchaseType:
      raw.purchaseType === 'subscription' || raw.purchaseType === 'product'
        ? raw.purchaseType
        : 'unknown',
    serviceName: str(raw.serviceName),
    billingCycle: CYCLES.includes(raw.billingCycle as never) ? raw.billingCycle! : null,
    nextRenewal: date(raw.nextRenewal),
    productName: str(raw.productName),
    merchantName: typeof raw.merchantName === 'string' ? raw.merchantName.trim() || null : null,
    totalAmount: num(raw.totalAmount),
    currency: typeof raw.currency === 'string' ? raw.currency.toUpperCase() : 'SAR',
    purchaseDate: date(raw.purchaseDate),
    warrantyExpiry: date(raw.warrantyExpiry),
    warrantyMonths: num(raw.warrantyMonths),
    category: canonicalCategory(raw.category),
    lineItemCount: num(raw.lineItemCount),
    confidence: Math.min(1, Math.max(0, num(raw.confidence) ?? 0)),
  };
}

/** Maps a thrown fetch error onto the result union. */
export function toFailure(e: unknown): ExtractionResult {
  const message = e instanceof Error ? e.message : String(e);
  return { ok: false, reason: /network|fetch/i.test(message) ? 'network' : 'unknown', message };
}

// ── pure helpers used by the review + manual-entry screens ──────────────────

/** Receipt said nothing about warranty → the UI must ask (1 year default). */
export function needsWarrantyPrompt(d: ReceiptExtraction): boolean {
  return d.warrantyExpiry === null && d.warrantyMonths === null;
}

/**
 * Warranty end date. Calendar arithmetic, so "1 month" means the same day next
 * month (clamped at month end), never a fixed number of days.
 */
export function expiryFromMonths(purchaseDate: string | null, months: number): string {
  return addMonths(baseDate(purchaseDate), months);
}

/** Next renewal when the receipt didn't state one: purchase date + one cycle. */
export function renewalFromCycle(
  purchaseDate: string | null,
  cycle: NonNullable<ReceiptExtraction['billingCycle']>,
): string {
  return addBillingCycle(baseDate(purchaseDate), cycle);
}

/** Falls back to today when the receipt gave no usable purchase date. */
function baseDate(purchaseDate: string | null): string {
  return purchaseDate && isValidISODate(purchaseDate) ? purchaseDate : todayISO();
}

/** Which follow-up to offer after a scan; null means just save the invoice. */
export function detectionPrompt(d: ReceiptExtraction): 'subscription' | 'product' | null {
  return d.purchaseType === 'unknown' ? null : d.purchaseType;
}
