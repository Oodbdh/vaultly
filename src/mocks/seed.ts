import { DEMO_SHOWCASE } from '@/constants/config';
import type {
  BillingPeriod,
  ItemKind,
  Profile,
  Subscription,
  VaultItem,
  Warranty,
} from '@/lib/database.types';

/**
 * Seed rows for the in-memory backend, chosen to reproduce the design boards:
 * every countdown tier (expired-today red, 16-days amber, 120-days green,
 * renews-in-3 red, renews-in-15 amber) is on screen at once, so all card and
 * badge states are reviewable without touching the data.
 */

export const MOCK_USER_ID = 'mock-user-0001';

/**
 * `yyyy-mm-dd`, `offsetDays` from today, built from local parts so it can never
 * slip a day across timezones — `calendarDaysUntil` parses these at local
 * midnight. Dates are relative rather than fixed so the countdowns keep reading
 * the way the design shows them however long this seed sits here.
 */
export function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/** ISO timestamp, `offsetDays` from now — for `created_at` ordering. */
function isoStamp(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString();
}

export const mockProfile: Profile = {
  id: MOCK_USER_ID,
  display_name: 'Adi',
  locale: 'en',
  currency: 'SAR',
  // Showcase runs as premium so the quota banner and rewarded-ad card fall away.
  // Not vanity: the free tier caps at 4 items, and a store screenshot showing a
  // full vault beside "3 of 4 items used" reads as a bug.
  plan_tier: DEMO_SHOWCASE ? 'premium' : 'free',
  premium_until: DEMO_SHOWCASE ? isoStamp(328) : null,
  push_token: null,
  warranty_reminders: true,
  renewal_reminders: true,
  created_at: isoStamp(-120),
  updated_at: isoStamp(0),
};

type SeedRow = {
  id: string;
  kind: ItemKind;
  /** Card title: the store for invoices, the product for warranties, the service for subscriptions. */
  title: string;
  /** Secondary line: the store for warranties, the category elsewhere. */
  secondary: string | null;
  amount: number | null;
  /** ISO 4217. Omitted rows fall back to `SAR`, which is what the design seed wants. */
  currency?: string;
  purchasedDaysAgo: number;
  warranty?: { expiresInDays: number; durationMonths: number };
  subscription?: { period: BillingPeriod; renewsInDays: number };
};

const SEED: SeedRow[] = [
  // ── Invoices ──────────────────────────────────────────────────────────────
  {
    id: 'inv-jarir',
    kind: 'receipt',
    title: 'Jarir Bookstore',
    secondary: 'Electronics',
    amount: 2499,
    purchasedDaysAgo: 24,
  },
  {
    id: 'inv-extra',
    kind: 'receipt',
    title: 'Extra Stores',
    secondary: 'Home appliances',
    amount: 1850,
    purchasedDaysAgo: 60,
  },
  {
    id: 'inv-panda',
    kind: 'receipt',
    title: 'Panda',
    secondary: 'Groceries',
    amount: 342.75,
    purchasedDaysAgo: 3,
  },

  // ── Warranties — one per urgency tier ─────────────────────────────────────
  {
    id: 'war-tv',
    kind: 'warranty',
    title: 'Samsung 55" TV',
    secondary: 'Jarir Bookstore',
    amount: 2499,
    purchasedDaysAgo: 365,
    warranty: { expiresInDays: 0, durationMonths: 12 }, // "Expires today"
  },
  {
    id: 'war-dyson',
    kind: 'warranty',
    title: 'Dyson V15',
    secondary: 'Extra Stores',
    amount: 1850,
    purchasedDaysAgo: 349,
    warranty: { expiresInDays: 16, durationMonths: 12 }, // "16 days left"
  },
  {
    id: 'war-ac',
    kind: 'warranty',
    title: 'AC unit',
    secondary: 'Extra Stores',
    amount: 1850,
    purchasedDaysAgo: 245,
    warranty: { expiresInDays: 120, durationMonths: 12 }, // "120 days left"
  },

  // ── Subscriptions ─────────────────────────────────────────────────────────
  {
    id: 'sub-netflix',
    kind: 'subscription',
    title: 'Netflix',
    secondary: 'Entertainment',
    amount: 56,
    purchasedDaysAgo: 27,
    subscription: { period: 'monthly', renewsInDays: 3 }, // "Renews in 3 days"
  },
  {
    id: 'sub-spotify',
    kind: 'subscription',
    title: 'Spotify',
    secondary: 'Music',
    amount: 21.99,
    purchasedDaysAgo: 15,
    subscription: { period: 'monthly', renewsInDays: 15 },
  },
];

/**
 * Store-listing data set, used when `EXPO_PUBLIC_DEMO_SHOWCASE=true`.
 *
 * Separate from `SEED` rather than replacing it: that one exists to put every
 * countdown tier on screen at once for design review, and a set tuned for
 * screenshots would quietly destroy that. This one optimises for a different
 * thing — a vault that looks lived in, across enough merchants and categories
 * that no list reads as thin, with the warranty and renewal dates spread so the
 * urgency colours vary down the screen instead of banding.
 *
 * Currencies follow the merchant's home market, which is also what exercises
 * the "keep the invoice's own currency" rule on a real screen: a euro IKEA
 * receipt stays in euros next to a dirham Noon one. Amounts are therefore
 * priced in each currency rather than converted from a single figure - a
 * MacBook is $1,999, not $9,299, and a Starbucks run is $12.85, not $42.50.
 *
 * Titles are kept short on purpose. The cards give a name roughly 12-14
 * characters beside a countdown pill, so "Adobe Creative Cloud" rendered as
 * "Adobe Crea..." and told the reader nothing.
 */
const SHOWCASE_SEED: SeedRow[] = [
  // ── Receipts ──────────────────────────────────────────────────────────────
  { id: 'sc-starbucks', kind: 'receipt', title: 'Starbucks', secondary: 'Restaurant', amount: 12.85, currency: 'USD', purchasedDaysAgo: 1 },
  { id: 'sc-carrefour', kind: 'receipt', title: 'Carrefour', secondary: 'Groceries', amount: 86.4, currency: 'EUR', purchasedDaysAgo: 2 },
  { id: 'sc-apple', kind: 'receipt', title: 'Apple Store', secondary: 'Electronics', amount: 1199, currency: 'USD', purchasedDaysAgo: 5 },
  { id: 'sc-ikea', kind: 'receipt', title: 'IKEA', secondary: 'Furniture', amount: 429.9, currency: 'EUR', purchasedDaysAgo: 12 },
  { id: 'sc-zara', kind: 'receipt', title: 'Zara', secondary: 'Clothing', amount: 159.95, currency: 'EUR', purchasedDaysAgo: 19 },
  { id: 'sc-nike', kind: 'receipt', title: 'Nike', secondary: 'Sports', amount: 172, currency: 'USD', purchasedDaysAgo: 31 },
  { id: 'sc-noon', kind: 'receipt', title: 'Noon', secondary: 'Home', amount: 1249, currency: 'AED', purchasedDaysAgo: 44 },

  // ── Warranties — spread across the urgency tiers ──────────────────────────
  // purchasedDaysAgo + expiresInDays ≈ durationMonths × 30.4, so the detail
  // screen's progress bar and its day count agree with each other.
  { id: 'sc-tv', kind: 'warranty', title: 'Samsung 65" TV', secondary: 'Extra', amount: 5499, currency: 'SAR', purchasedDaysAgo: 722, warranty: { expiresInDays: 8, durationMonths: 24 } },
  { id: 'sc-macbook', kind: 'warranty', title: 'MacBook Pro', secondary: 'Apple Store', amount: 1999, currency: 'USD', purchasedDaysAgo: 319, warranty: { expiresInDays: 46, durationMonths: 12 } },
  { id: 'sc-dyson', kind: 'warranty', title: 'Dyson V15', secondary: 'Jarir', amount: 2749, currency: 'SAR', purchasedDaysAgo: 603, warranty: { expiresInDays: 127, durationMonths: 24 } },
  { id: 'sc-washer', kind: 'warranty', title: 'LG Washer', secondary: 'Extra', amount: 2199, currency: 'SAR', purchasedDaysAgo: 518, warranty: { expiresInDays: 212, durationMonths: 24 } },
  { id: 'sc-sony', kind: 'warranty', title: 'Sony XM5', secondary: 'Noon', amount: 1399, currency: 'AED', purchasedDaysAgo: 56, warranty: { expiresInDays: 309, durationMonths: 12 } },

  // ── Subscriptions ─────────────────────────────────────────────────────────
  // Only Amazon was specified; the other four are US-billed global services, so
  // they take USD rather than a currency invented for them.
  { id: 'sc-netflix', kind: 'subscription', title: 'Netflix', secondary: 'Entertainment', amount: 22.99, currency: 'USD', purchasedDaysAgo: 28, subscription: { period: 'monthly', renewsInDays: 2 } },
  { id: 'sc-spotify', kind: 'subscription', title: 'Spotify', secondary: 'Entertainment', amount: 16.99, currency: 'USD', purchasedDaysAgo: 19, subscription: { period: 'monthly', renewsInDays: 11 } },
  { id: 'sc-icloud', kind: 'subscription', title: 'iCloud+', secondary: 'Services', amount: 2.99, currency: 'USD', purchasedDaysAgo: 12, subscription: { period: 'monthly', renewsInDays: 18 } },
  { id: 'sc-adobe', kind: 'subscription', title: 'Adobe CC', secondary: 'Services', amount: 59.99, currency: 'USD', purchasedDaysAgo: 5, subscription: { period: 'monthly', renewsInDays: 25 } },
  // "Amazon Prime" still ellipsed on the home card, where the renewal pill
  // takes most of the row. The merchant is the recognisable part.
  { id: 'sc-prime', kind: 'subscription', title: 'Amazon', secondary: 'Services', amount: 139, currency: 'USD', purchasedDaysAgo: 298, subscription: { period: 'yearly', renewsInDays: 67 } },
];

export type MockTables = {
  items: VaultItem[];
  warranties: Warranty[];
  subscriptions: Subscription[];
};

/** Fresh copy of the seed — called once at boot, and again on reset. */
export function buildSeed(): MockTables {
  const items: VaultItem[] = [];
  const warranties: Warranty[] = [];
  const subscriptions: Subscription[] = [];
  const rows = DEMO_SHOWCASE ? SHOWCASE_SEED : SEED;

  rows.forEach((row, index) => {
    items.push({
      id: row.id,
      user_id: MOCK_USER_ID,
      kind: row.kind,
      merchant_name: row.title,
      total_amount: row.amount,
      currency: row.currency ?? 'SAR',
      purchase_date: isoDay(-row.purchasedDaysAgo),
      category: row.secondary,
      notes: null,
      image_path: null,
      ocr_status: 'manual',
      ocr_raw: null,
      ocr_confidence: null,
      // Descending order in the lists follows this, so later entries read as newer.
      created_at: isoStamp(-(rows.length - index)),
      updated_at: isoStamp(-(rows.length - index)),
    });

    if (row.warranty) {
      warranties.push({
        id: `${row.id}-w`,
        item_id: row.id,
        user_id: MOCK_USER_ID,
        duration_months: row.warranty.durationMonths,
        expires_on: isoDay(row.warranty.expiresInDays),
        provider: row.secondary,
        reminder_days: [30, 7, 1],
        created_at: isoStamp(-row.purchasedDaysAgo),
      });
    }

    if (row.subscription) {
      subscriptions.push({
        id: `${row.id}-s`,
        item_id: row.id,
        user_id: MOCK_USER_ID,
        name: row.title,
        amount: row.amount ?? 0,
        currency: row.currency ?? 'SAR',
        period: row.subscription.period,
        next_renewal: isoDay(row.subscription.renewsInDays),
        auto_renews: true,
        reminder_days: [3, 1],
        created_at: isoStamp(-row.purchasedDaysAgo),
      });
    }
  });

  return { items, warranties, subscriptions };
}
