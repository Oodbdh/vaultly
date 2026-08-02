/**
 * Deterministic stages of the receipt extraction pipeline (stages 2 and 3).
 *
 * This module is intentionally **pure and dependency-free**: no Deno globals, no
 * network, no imports. Two reasons.
 *   1. The Edge Function bundles it by relative import.
 *   2. Node's bare test runner can import it directly, so the rules that decide
 *      what reaches the database are unit-testable without a model in the loop.
 *
 * The design rule behind everything here: **accuracy beats completeness.** Every
 * function is allowed to return null, and does so whenever the evidence is thin.
 * A missing field costs the user one tap; a wrong field silently corrupts their
 * vault.
 */

// ── Shared shapes ───────────────────────────────────────────────────────────

/** One line of transcribed text, in reading order. */
export type TextBlock = {
  /** 0-based position in reading order. */
  i: number;
  text: string;
  /** Reserved for a future OCR engine that reports geometry. Always null today. */
  bbox?: { x: number; y: number; w: number; h: number } | null;
};

/**
 * A possible value for a field, with the evidence that produced it.
 *
 * Candidates are deliberately *not* deduplicated or resolved at detection time —
 * stage 2 proposes, stage 3 disposes.
 */
export type Candidate<T> = {
  value: T;
  /** 0-100. Set by stage 3; stage 2 seeds it from the match quality. */
  confidence: number;
  /** Index of the source block, for auditing and for the reasoning prompt. */
  block: number;
  /** Why this was proposed — surfaced to the LLM so it can judge, not guess. */
  reason: string;
  /**
   * What kind of line produced this amount. Stage 3 needs to tell a subtotal
   * from a total to run the `subtotal + VAT === total` cross-check; the
   * confidence number alone loses that distinction.
   */
  kind?: 'total' | 'subtotal' | 'vat' | 'promo' | 'plain';
};

export type DateRole = 'purchase' | 'due' | 'warrantyExpiry' | 'renewal' | 'unknown';

export type Candidates = {
  merchant: Candidate<string>[];
  total: Candidate<number>[];
  currency: Candidate<string>[];
  dates: Candidate<{ iso: string; role: DateRole }>[];
  warrantyMonths: Candidate<number>[];
  warrantyExpiry: Candidate<string>[];
  billingCycle: Candidate<BillingCycle>[];
  nextRenewal: Candidate<string>[];
  invoiceNumber: Candidate<string>[];
  vatAmount: Candidate<number>[];
  paymentMethod: Candidate<string>[];
  isSubscription: boolean;
};

export type BillingCycle = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

/** Stage 3 output: one winner per field, each with a 0-100 confidence. */
export type Validated = {
  merchantName: Candidate<string> | null;
  totalAmount: Candidate<number> | null;
  currency: Candidate<string> | null;
  purchaseDate: Candidate<string> | null;
  warrantyMonths: Candidate<number> | null;
  warrantyExpiry: Candidate<string> | null;
  billingCycle: Candidate<BillingCycle> | null;
  nextRenewal: Candidate<string> | null;
  invoiceNumber: Candidate<string> | null;
  vatAmount: Candidate<number> | null;
  paymentMethod: Candidate<string> | null;
  purchaseType: 'subscription' | 'product' | 'unknown';
};

/** Below this, a field is treated as unknown and returned as null. */
export const CONFIDENCE_FLOOR = 70;

// ── Text normalisation (Arabic + English) ───────────────────────────────────

const ARABIC_INDIC = /[٠-٩]/g;   // ٠..٩
const EASTERN_ARABIC = /[۰-۹]/g; // ۰..۹

/**
 * Folds Arabic-Indic and Eastern-Arabic digits to ASCII, and the Arabic decimal
 * (U+066B) / thousands (U+066C) separators to `.` and `,`.
 *
 * Without this every numeric rule below silently fails on a receipt printed in
 * Arabic numerals — which in this market is most of them.
 */
export function foldDigits(input: string): string {
  return input
    .replace(ARABIC_INDIC, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(EASTERN_ARABIC, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, '.')
    .replace(/٬/g, ',');
}

/** Lowercase + digit-folded + whitespace-collapsed, for keyword matching. */
export function norm(input: string): string {
  return foldDigits(input).toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Parses a money token into a number, resolving separator ambiguity.
 *
 * "1,234.56" → 1234.56   (comma thousands, dot decimal)
 * "1.234,56" → 1234.56   (European: dot thousands, comma decimal)
 * "1 234,56" → 1234.56
 * "1234"     → 1234
 *
 * Returns null rather than guessing when the token isn't clearly a number —
 * a wrong total is worse than no total.
 */
export function parseAmount(raw: string): number | null {
  const s = foldDigits(raw).replace(/[^\d.,\s-]/g, '').trim();
  if (!s || !/\d/.test(s)) return null;

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  let cleaned: string;

  if (lastDot >= 0 && lastComma >= 0) {
    // Whichever appears last is the decimal separator.
    cleaned = lastDot > lastComma
      ? s.replace(/[,\s]/g, '')
      : s.replace(/[.\s]/g, '').replace(',', '.');
  } else if (lastComma >= 0) {
    // A lone comma is decimal only when it splits 1-2 trailing digits
    // ("12,50"); otherwise it is a thousands separator ("1,234").
    const tail = s.length - lastComma - 1;
    cleaned = tail === 1 || tail === 2 ? s.replace(/\s/g, '').replace(',', '.') : s.replace(/[,\s]/g, '');
  } else {
    cleaned = s.replace(/\s/g, '');
  }

  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  // Receipts do not have negative or absurd grand totals.
  if (n < 0 || n > 100_000_000) return null;
  return Math.round(n * 100) / 100;
}

// ── Currency ────────────────────────────────────────────────────────────────

const CURRENCY_TOKENS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bsar\b|ر\.?\s?س|ريال|﷼|\bsr\b/i, 'SAR'],
  [/\baed\b|د\.?\s?إ|درهم/i, 'AED'],
  [/\bkwd\b|د\.?\s?ك/i, 'KWD'],
  [/\bbhd\b|د\.?\s?ب/i, 'BHD'],
  [/\bqar\b|ر\.?\s?ق/i, 'QAR'],
  [/\begp\b|ج\.?\s?م/i, 'EGP'],
  [/\busd\b|\$/i, 'USD'],
  [/\beur\b|€/i, 'EUR'],
  [/\bgbp\b|£/i, 'GBP'],
];

export function detectCurrency(blocks: TextBlock[]): Candidate<string>[] {
  const out: Candidate<string>[] = [];
  const seen = new Set<string>();
  for (const b of blocks) {
    for (const [re, code] of CURRENCY_TOKENS) {
      if (re.test(b.text) && !seen.has(code)) {
        seen.add(code);
        out.push({ value: code, confidence: 80, block: b.i, reason: `currency token matched ${code}` });
      }
    }
  }
  return out;
}

// ── Dates ───────────────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
  // Arabic (Levantine and Gulf spellings both appear on receipts)
  'يناير': 1, 'فبراير': 2, 'مارس': 3, 'ابريل': 4, 'أبريل': 4, 'مايو': 5,
  'يونيو': 6, 'يوليو': 7, 'اغسطس': 8, 'أغسطس': 8, 'سبتمبر': 9,
  'اكتوبر': 10, 'أكتوبر': 10, 'نوفمبر': 11, 'ديسمبر': 12,
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function isRealDate(y: number, m: number, d: number): boolean {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * Tabular Islamic (Hijri) → Gregorian. Accurate to about ±1 day, which is why
 * callers drop the confidence: good enough to be useful, never good enough to
 * be asserted as exact.
 */
export function hijriToGregorian(hy: number, hm: number, hd: number): string | null {
  if (hy < 1300 || hy > 1600 || hm < 1 || hm > 12 || hd < 1 || hd > 30) return null;
  const jd =
    Math.floor((11 * hy + 3) / 30) + 354 * hy + 30 * hm -
    Math.floor((hm - 1) / 2) + hd + 1948440 - 385;
  // Julian Day Number → Gregorian
  let l = jd + 68569;
  const n = Math.floor((4 * l) / 146097);
  l = l - Math.floor((146097 * n + 3) / 4);
  const i = Math.floor((4000 * (l + 1)) / 1461001);
  l = l - Math.floor((1461 * i) / 4) + 31;
  const j = Math.floor((80 * l) / 2447);
  const day = l - Math.floor((2447 * j) / 80);
  l = Math.floor(j / 11);
  const month = j + 2 - 12 * l;
  const year = 100 * (n - 49) + i + l;
  return isRealDate(year, month, day) ? iso(year, month, day) : null;
}

const DATE_PATTERNS: ReadonlyArray<{ re: RegExp; take: (m: RegExpMatchArray) => { y: number; m: number; d: number; ambiguous?: boolean } | null }> = [
  // yyyy-mm-dd / yyyy/mm/dd
  {
    re: /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/,
    take: (m) => ({ y: +m[1], m: +m[2], d: +m[3] }),
  },
  // dd-mm-yyyy / mm-dd-yyyy — order resolved below
  {
    re: /(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/,
    take: (m) => {
      const a = +m[1], b = +m[2], y = +m[3];
      if (a > 12 && b <= 12) return { y, m: b, d: a };            // unambiguous dd/mm
      if (b > 12 && a <= 12) return { y, m: a, d: b };            // unambiguous mm/dd
      // Both ≤ 12: genuinely ambiguous. This market writes dd/mm, so prefer it —
      // but mark it so the confidence is docked and the LLM can overrule.
      return { y, m: b, d: a, ambiguous: true };
    },
  },
  // 12 Mar 2026 / 12 مارس 2026
  {
    re: /(\d{1,2})\s+([a-z؀-ۿ]{3,12})\.?\s+(\d{4})/i,
    take: (m) => {
      const mo = MONTHS[m[2].toLowerCase()];
      return mo ? { y: +m[3], m: mo, d: +m[1] } : null;
    },
  },
  // Mar 12, 2026
  {
    re: /([a-z]{3,12})\.?\s+(\d{1,2}),?\s+(\d{4})/i,
    take: (m) => {
      const mo = MONTHS[m[1].toLowerCase()];
      return mo ? { y: +m[3], m: mo, d: +m[2] } : null;
    },
  },
];

const HIJRI_MARKER = /هـ|هجري|\bah\b/i;

const ROLE_KEYWORDS: ReadonlyArray<readonly [RegExp, DateRole]> = [
  [/warranty|guarantee|ضمان/i, 'warrantyExpiry'],
  [/next\s*(billing|renewal|payment)|renews?\s*on|auto[- ]?renew|التجديد|يتجدد|تاريخ\s*التجديد/i, 'renewal'],
  [/due\s*date|payment\s*due|الاستحقاق|تاريخ\s*الاستحقاق/i, 'due'],
  [/invoice\s*date|purchase\s*date|transaction\s*date|order\s*date|date\b|التاريخ|تاريخ\s*الفاتورة|تاريخ\s*الشراء/i, 'purchase'],
];

function roleOf(line: string): DateRole {
  for (const [re, role] of ROLE_KEYWORDS) if (re.test(line)) return role;
  return 'unknown';
}

/** Every date on the receipt, tagged with the role its surrounding words imply. */
export function detectDates(blocks: TextBlock[]): Candidate<{ iso: string; role: DateRole }>[] {
  const out: Candidate<{ iso: string; role: DateRole }>[] = [];

  for (const b of blocks) {
    const line = foldDigits(b.text);
    const role = roleOf(line);
    const hijri = HIJRI_MARKER.test(line);

    for (const { re, take } of DATE_PATTERNS) {
      const m = line.match(re);
      if (!m) continue;
      const parts = take(m);
      if (!parts) continue;

      let value: string | null = null;
      let confidence = 85;
      let reason = `matched ${m[0]}`;

      if (hijri || (parts.y >= 1300 && parts.y <= 1600)) {
        value = hijriToGregorian(parts.y, parts.m, parts.d);
        // Tabular conversion is ±1 day, so it must stay under the floor even
        // after the role bonus below. A Hijri date only survives if the LLM
        // independently corroborates it in stage 5.
        confidence = 60;
        reason = `Hijri ${m[0]} converted (tabular, ±1 day)`;
      } else if (isRealDate(parts.y, parts.m, parts.d)) {
        value = iso(parts.y, parts.m, parts.d);
        if (parts.ambiguous) {
          confidence = 60;
          reason = `${m[0]} — day/month order ambiguous, assumed dd/mm`;
        }
      }

      if (!value) continue;
      if (role !== 'unknown') confidence += 5;
      out.push({ value: { iso: value, role }, confidence: Math.min(95, confidence), block: b.i, reason });
      break; // one date per line is enough; more invites double counting
    }
  }
  return out;
}

// ── Amounts ─────────────────────────────────────────────────────────────────

const TOTAL_STRONG = /grand\s*total|amount\s*paid|total\s*due|net\s*(total|payable)|balance\s*due|total\s*amount|الإجمالي\s*شامل|المبلغ\s*المدفوع|الإجمالي\s*النهائي|صافي\s*المبلغ|المطلوب/i;
const TOTAL_WEAK = /\btotal\b|الاجمالي|الإجمالي|المجموع|الصافي|\bnet\b/i;
const SUBTOTAL = /sub\s*-?\s*total|before\s*(vat|tax)|المجموع\s*الفرعي|قبل\s*الضريبة|الإجمالي\s*قبل/i;
const VAT_LINE = /\bvat\b|\btax\b|ضريبة|القيمة\s*المضافة|ض\.?ق\.?م/i;
const DISCOUNT_LINE = /discount|promo|offer|was\b|instead\s*of|خصم|عرض|بدلا?ً?\s*من|قبل\s*الخصم/i;
const CHANGE_LINE = /change\s*due|change\b|cash\s*back|الباقي|المتبقى|المتبقي/i;

/** Money-looking tokens on a line, largest last. */
function amountsIn(line: string): number[] {
  const folded = foldDigits(line);
  const tokens = folded.match(/-?\d[\d.,\s]*\d|\d/g) ?? [];
  return tokens
    .map(parseAmount)
    .filter((n): n is number => n !== null && n > 0);
}

/**
 * Proposes every plausible grand total, scored by the words on its line.
 *
 * The scoring — not a single regex — is what implements "prefer TOTAL, ignore
 * subtotal unless nothing else exists, ignore promotional and crossed-out
 * prices". Stage 3 then picks the winner.
 */
export function detectTotals(blocks: TextBlock[]): Candidate<number>[] {
  const out: Candidate<number>[] = [];

  for (const b of blocks) {
    const line = b.text;
    const values = amountsIn(line);
    if (!values.length) continue;

    // A line that is only about change given, or a discount, is never the total.
    if (CHANGE_LINE.test(line)) continue;

    const isStrong = TOTAL_STRONG.test(line);
    const isWeak = !isStrong && TOTAL_WEAK.test(line);
    const isSub = SUBTOTAL.test(line);
    const isVat = VAT_LINE.test(line) && !isStrong;
    const isPromo = DISCOUNT_LINE.test(line);

    // Subtotal and VAT lines are recorded but heavily docked: they are only
    // ever used when the receipt has no total line at all.
    let confidence = 30;
    let reason = 'bare amount on a line';
    let kind: NonNullable<Candidate<number>['kind']> = 'plain';
    if (isStrong) { confidence = 95; reason = 'line matches a grand-total phrase'; kind = 'total'; }
    else if (isWeak && !isSub) { confidence = 80; reason = 'line matches a total phrase'; kind = 'total'; }
    if (isSub) { confidence = 40; reason = 'subtotal line — fallback only'; kind = 'subtotal'; }
    if (isVat) { confidence = 20; reason = 'VAT line — not a grand total'; kind = 'vat'; }
    if (isPromo) { confidence = Math.min(confidence, 25); reason = 'promotional/was-price line'; kind = 'promo'; }

    // "was 100 now 80" style lines carry two prices; the payable one is the
    // last. Taking max here would systematically pick the crossed-out price.
    const value = isPromo ? values[values.length - 1] : Math.max(...values);

    out.push({ value, confidence, block: b.i, reason, kind });
  }

  return out;
}

export function detectVat(blocks: TextBlock[]): Candidate<number>[] {
  const out: Candidate<number>[] = [];
  for (const b of blocks) {
    if (!VAT_LINE.test(b.text) || TOTAL_STRONG.test(b.text)) continue;
    const values = amountsIn(b.text);
    if (!values.length) continue;
    // A percentage ("VAT 15%") is not an amount.
    const withoutPercents = /\d\s*%/.test(foldDigits(b.text)) ? values.filter((v) => v > 100) : values;
    if (!withoutPercents.length) continue;
    out.push({
      value: Math.max(...withoutPercents),
      confidence: 75,
      block: b.i,
      reason: 'amount on a VAT/tax line',
    });
  }
  return out;
}

// ── Merchant ────────────────────────────────────────────────────────────────

const DOC_HEADER = /^(simplified\s+)?(tax\s+)?invoice$|^receipt$|^bill$|^statement$|^فاتورة(\s+ضريبية)?(\s+مبسطة)?$|^إيصال$|^سند\s*قبض$/i;
const ADDRESS_HINT = /\b(street|st\.|road|rd\.|ave|avenue|building|bldg|floor|p\.?o\.?\s*box|zip|postal|district|branch)\b|شارع|طريق|حي\b|ص\.?ب|الرمز\s*البريدي|مبنى|الدور|فرع/i;
const CONTACT_HINT = /\b(tel|phone|fax|mobile|email|www\.|http|@)\b|هاتف|جوال|فاكس|بريد/i;
const VAT_ID_HINT = /\b(vat|tax)\s*(no|number|reg|id)\b|الرقم\s*الضريبي|رقم\s*التسجيل/i;
const SLOGAN_HINT = /thank\s*you|welcome|visit\s*again|have\s*a\s*nice|شكرا|أهلا|مرحبا|نتشرف/i;

/**
 * Merchant candidates from the top of the receipt.
 *
 * Everything here is exclusion-driven: the trade name is whatever survives after
 * removing document headers, addresses, contact lines, VAT registration lines,
 * slogans and pure numbers. That is far more robust than trying to positively
 * recognise business names across two languages.
 */
export function detectMerchant(blocks: TextBlock[]): Candidate<string>[] {
  const out: Candidate<string>[] = [];
  // The trade name is nearly always in the first few lines — a name found
  // halfway down is usually a supplier reference, not the seller.
  const head = blocks.slice(0, 8);

  for (const b of head) {
    const raw = b.text.trim();
    if (!raw) continue;
    const line = raw.replace(/\s+/g, ' ');
    if (DOC_HEADER.test(line)) continue;
    if (ADDRESS_HINT.test(line) || CONTACT_HINT.test(line) || VAT_ID_HINT.test(line)) continue;
    if (SLOGAN_HINT.test(line)) continue;
    // Mostly digits → a number, a date or a till id, not a name.
    const digits = (foldDigits(line).match(/\d/g) ?? []).length;
    if (digits > line.length / 3) continue;
    if (line.length < 2 || line.length > 60) continue;

    // Earlier lines are likelier to be the name; the logo line is usually first.
    const confidence = Math.max(55, 90 - b.i * 8);
    out.push({ value: line, confidence, block: b.i, reason: `line ${b.i} survived header/address/slogan filters` });
  }
  return out;
}

// ── Warranty ────────────────────────────────────────────────────────────────

const WARRANTY_LINE = /warranty|guarantee|ضمان/i;

const DURATION_RE =
  /(\d{1,3})\s*[- ]?\s*(year|years|yr|yrs|month|months|mo|mos|سنة|سنوات|سنه|شهر|شهور|أشهر|اشهر)/i;

/** Arabic dual forms carry no digit: "سنتين" = 2 years, "شهرين" = 2 months. */
const ARABIC_DUAL: ReadonlyArray<readonly [RegExp, number]> = [
  [/سنتين|عامين/, 24],
  [/شهرين/, 2],
];

function monthsFrom(qty: number, unit: string): number | null {
  const u = unit.toLowerCase();
  if (/^(year|years|yr|yrs|سنة|سنوات|سنه)$/.test(u)) return qty * 12;
  if (/^(month|months|mo|mos|شهر|شهور|أشهر|اشهر)$/.test(u)) return qty;
  return null;
}

export function detectWarrantyMonths(blocks: TextBlock[]): Candidate<number>[] {
  const out: Candidate<number>[] = [];
  for (const b of blocks) {
    if (!WARRANTY_LINE.test(b.text)) continue;
    const line = foldDigits(b.text);

    const m = line.match(DURATION_RE);
    if (m) {
      const months = monthsFrom(+m[1], m[2]);
      if (months !== null && months > 0 && months <= 240) {
        out.push({ value: months, confidence: 90, block: b.i, reason: `"${m[0]}" on a warranty line` });
        continue;
      }
    }
    for (const [re, months] of ARABIC_DUAL) {
      if (re.test(line)) {
        out.push({ value: months, confidence: 85, block: b.i, reason: 'Arabic dual form on a warranty line' });
        break;
      }
    }
  }
  return out;
}

/** Only an explicitly printed warranty end date — never a computed one. */
export function detectWarrantyExpiry(dates: Candidate<{ iso: string; role: DateRole }>[]): Candidate<string>[] {
  return dates
    .filter((d) => d.value.role === 'warrantyExpiry')
    .map((d) => ({ value: d.value.iso, confidence: d.confidence, block: d.block, reason: 'date on a warranty line' }));
}

// ── Subscription ────────────────────────────────────────────────────────────

const RECURRING = /subscription|recurring|auto[- ]?renew|renews?\b|monthly\s*plan|annual\s*plan|billing\s*cycle|per\s*month|\/mo\b|اشتراك|تجديد\s*تلقائي|شهري|سنوي|باقة/i;

const CYCLE_TOKENS: ReadonlyArray<readonly [RegExp, BillingCycle]> = [
  [/weekly|per\s*week|\/wk\b|أسبوعي|اسبوعي/i, 'weekly'],
  [/quarterly|every\s*3\s*months|ربع\s*سنوي/i, 'quarterly'],
  [/yearly|annual|per\s*year|\/yr\b|سنوي|سنويا/i, 'yearly'],
  [/monthly|per\s*month|\/mo\b|شهري|شهريا/i, 'monthly'],
];

export function detectSubscription(blocks: TextBlock[]): {
  isSubscription: boolean;
  cycles: Candidate<BillingCycle>[];
} {
  let isSubscription = false;
  const cycles: Candidate<BillingCycle>[] = [];

  for (const b of blocks) {
    if (RECURRING.test(b.text)) isSubscription = true;
    for (const [re, cycle] of CYCLE_TOKENS) {
      if (re.test(b.text)) {
        cycles.push({ value: cycle, confidence: 80, block: b.i, reason: `billing-cycle wording matched ${cycle}` });
        break;
      }
    }
  }
  // A cycle word alone ("monthly") is weak evidence; paired with explicit
  // recurrence wording it is strong.
  if (!isSubscription) for (const c of cycles) c.confidence = 45;
  return { isSubscription, cycles };
}

// ── Invoice number and payment method ───────────────────────────────────────

const INVOICE_RE = /(?:invoice|inv|bill|receipt)\s*(?:no\.?|number|#|:)?\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9/-]{2,24})|رقم\s*(?:الفاتورة|فاتورة)\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9/-]{2,24})/i;

export function detectInvoiceNumber(blocks: TextBlock[]): Candidate<string>[] {
  const out: Candidate<string>[] = [];
  for (const b of blocks) {
    const m = foldDigits(b.text).match(INVOICE_RE);
    const value = m?.[1] ?? m?.[2];
    if (!value) continue;
    // A bare year is not an invoice number.
    if (/^(19|20)\d{2}$/.test(value)) continue;
    out.push({ value, confidence: 80, block: b.i, reason: 'invoice-number pattern' });
  }
  return out;
}

const PAYMENT_TOKENS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bmada\b|مدى/i, 'mada'],
  [/\bvisa\b|فيزا/i, 'visa'],
  [/master\s*card|ماستر/i, 'mastercard'],
  [/\bamex\b|american\s*express/i, 'amex'],
  [/apple\s*pay/i, 'apple pay'],
  [/stc\s*pay/i, 'stc pay'],
  [/\bcash\b|نقد[اً]?|كاش/i, 'cash'],
  [/\bcard\b|بطاقة/i, 'card'],
];

export function detectPaymentMethod(blocks: TextBlock[]): Candidate<string>[] {
  const out: Candidate<string>[] = [];
  const seen = new Set<string>();
  for (const b of blocks) {
    for (const [re, value] of PAYMENT_TOKENS) {
      if (re.test(b.text) && !seen.has(value)) {
        seen.add(value);
        out.push({ value, confidence: 75, block: b.i, reason: `payment token ${value}` });
      }
    }
  }
  return out;
}

// ── Stage 2 ─────────────────────────────────────────────────────────────────

export function detectCandidates(blocks: TextBlock[]): Candidates {
  const dates = detectDates(blocks);
  const { isSubscription, cycles } = detectSubscription(blocks);
  return {
    merchant: detectMerchant(blocks),
    total: detectTotals(blocks),
    currency: detectCurrency(blocks),
    dates,
    warrantyMonths: detectWarrantyMonths(blocks),
    warrantyExpiry: detectWarrantyExpiry(dates),
    billingCycle: cycles,
    nextRenewal: dates
      .filter((d) => d.value.role === 'renewal')
      .map((d) => ({ value: d.value.iso, confidence: d.confidence, block: d.block, reason: 'date on a renewal line' })),
    invoiceNumber: detectInvoiceNumber(blocks),
    vatAmount: detectVat(blocks),
    paymentMethod: detectPaymentMethod(blocks),
    isSubscription,
  };
}

// ── Stage 3 ─────────────────────────────────────────────────────────────────

function best<T>(list: Candidate<T>[]): Candidate<T> | null {
  if (!list.length) return null;
  return list.reduce((a, b) => (b.confidence > a.confidence ? b : a));
}

/**
 * Picks the grand total.
 *
 * Cross-check: when a subtotal and a VAT amount are both present and they sum to
 * one of the candidates, that candidate is almost certainly the real total, so
 * it is promoted. This is the single most effective guard against picking a line
 * item on a long receipt.
 */
function pickTotal(c: Candidates): Candidate<number> | null {
  if (!c.total.length) return null;

  const strong = c.total.filter((t) => t.confidence >= 80);
  const pool = strong.length ? strong : c.total;
  const chosen = best(pool);
  if (!chosen) return null;

  // Arithmetic cross-check: if a subtotal and a VAT amount are both present and
  // some candidate equals their sum, that candidate is the real grand total.
  // On a long receipt this is the strongest signal available — it beats keyword
  // matching, because line items can carry total-ish words too.
  const subtotal = c.total.find((t) => t.kind === 'subtotal');
  const vat = best(c.vatAmount);
  if (subtotal && vat) {
    const expected = subtotal.value + vat.value;
    const sums = c.total.find((t) => t.kind !== 'subtotal' && Math.abs(t.value - expected) < 0.02);
    if (sums) {
      return {
        ...sums,
        confidence: Math.max(sums.confidence, 90),
        reason: `${sums.reason}; equals subtotal + VAT`,
      };
    }
  }
  return chosen;
}

/** The purchase date: an explicitly labelled one, else the earliest plausible. */
function pickPurchaseDate(c: Candidates): Candidate<string> | null {
  const labelled = c.dates.filter((d) => d.value.role === 'purchase');
  const pool = labelled.length ? labelled : c.dates.filter((d) => d.value.role === 'unknown');
  if (!pool.length) return null;
  const chosen = pool.reduce((a, b) => (b.confidence > a.confidence ? b : a));
  return {
    value: chosen.value.iso,
    // An unlabelled date is a guess about *which* date it is, so dock it below
    // the floor unless the LLM can corroborate it.
    confidence: labelled.length ? chosen.confidence : Math.min(chosen.confidence, 65),
    block: chosen.block,
    reason: labelled.length ? chosen.reason : `${chosen.reason} (unlabelled date)`,
  };
}

export function validate(c: Candidates): Validated {
  const total = pickTotal(c);
  const purchaseDate = pickPurchaseDate(c);
  const cycle = best(c.billingCycle);

  const purchaseType: Validated['purchaseType'] = c.isSubscription
    ? 'subscription'
    : c.warrantyMonths.length || c.warrantyExpiry.length
      ? 'product'
      : 'unknown';

  return {
    merchantName: best(c.merchant),
    totalAmount: total,
    // A currency is only meaningful next to an amount; default is applied later.
    currency: best(c.currency),
    purchaseDate,
    warrantyMonths: best(c.warrantyMonths),
    warrantyExpiry: best(c.warrantyExpiry),
    billingCycle: purchaseType === 'subscription' ? cycle : null,
    nextRenewal: best(c.nextRenewal),
    invoiceNumber: best(c.invoiceNumber),
    vatAmount: best(c.vatAmount),
    paymentMethod: best(c.paymentMethod),
    purchaseType,
  };
}

/**
 * Reconciles stage 3 (rules) with stage 4 (LLM) — the deterministic half of
 * stage 5.
 *
 * Agreement raises confidence; disagreement hands it to whichever side is more
 * confident; anything left under the floor becomes null. The LLM never wins by
 * default, which is what stops a fluent-sounding hallucination from overwriting
 * a value that was actually read off the receipt.
 */
export function reconcile<T>(
  ruleSide: Candidate<T> | null,
  llmValue: T | null,
  llmConfidence: number,
  equals: (a: T, b: T) => boolean = (a, b) => a === b,
): { value: T | null; confidence: number } {
  if (ruleSide && llmValue !== null && equals(ruleSide.value, llmValue)) {
    return { value: ruleSide.value, confidence: Math.min(99, Math.max(ruleSide.confidence, llmConfidence) + 10) };
  }
  if (ruleSide && llmValue === null) return { value: ruleSide.value, confidence: ruleSide.confidence - 10 };
  if (!ruleSide && llmValue !== null) return { value: llmValue, confidence: Math.min(llmConfidence, 75) };
  if (!ruleSide) return { value: null, confidence: 0 };
  return ruleSide.confidence >= llmConfidence
    ? { value: ruleSide.value, confidence: ruleSide.confidence - 15 }
    : { value: llmValue, confidence: llmConfidence - 15 };
}

/** Applies the floor. Anything uncertain leaves as null, by design. */
export function applyFloor<T>(r: { value: T | null; confidence: number }): T | null {
  return r.confidence >= CONFIDENCE_FLOOR ? r.value : null;
}
