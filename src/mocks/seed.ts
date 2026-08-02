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
  plan_tier: 'free',
  premium_until: null,
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

  SEED.forEach((row, index) => {
    items.push({
      id: row.id,
      user_id: MOCK_USER_ID,
      kind: row.kind,
      merchant_name: row.title,
      total_amount: row.amount,
      currency: 'SAR',
      purchase_date: isoDay(-row.purchasedDaysAgo),
      category: row.secondary,
      notes: null,
      image_path: null,
      ocr_status: 'manual',
      ocr_raw: null,
      ocr_confidence: null,
      // Descending order in the lists follows this, so later entries read as newer.
      created_at: isoStamp(-(SEED.length - index)),
      updated_at: isoStamp(-(SEED.length - index)),
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
        currency: 'SAR',
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
