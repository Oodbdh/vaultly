/**
 * In-memory backend.
 *
 * Mirrors the signatures in `src/services/receipts.ts` and `storage.ts` one for
 * one, so `USE_MOCK_DATA` swaps the data source without a single screen, hook
 * or query key changing. Swap it off and the same calls hit Supabase.
 *
 * State lives for the lifetime of the JS bundle: edits survive navigation and
 * pull-to-refresh, and reset on a reload. That is deliberate — persisting mock
 * writes would just be a second database to keep in step with the schema.
 */
import { MONETIZATION } from '@/constants/config';
import { addBillingCycle } from '@/lib/dateMath';
import type {
  BillingPeriod,
  ItemKind,
  Json,
  Profile,
  ProfileUpdate,
  Subscription,
  VaultItem,
  Warranty,
} from '@/lib/database.types';
import { QuotaExceededError } from '@/lib/errors';
import type { ListItem } from '@/lib/types';
import { buildSeed, isoDay, MOCK_USER_ID, mockProfile, type MockTables } from './seed';

let db: MockTables = buildSeed();

/**
 * The free-tier counter, deliberately independent of the seeded rows.
 *
 * The seed fills every list so all card states are visible; if the counter
 * simply counted those rows it would open at 8/4 and the paywall gate would
 * block the add flow before it could be tried. Starting at the design's "3 / 4"
 * keeps the quota banner, the rewarded-slot card, one working add, and then the
 * paywall all reachable in sequence.
 */
let quotaUsed = 3;
/** 0 or 1 — the one-off permanent rewarded slot. Never expires, never resets. */
let bonusSlots = 0;

/** Enough latency for skeletons and pull-to-refresh to actually be visible. */
const LATENCY_MS = 320;

function settle<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), LATENCY_MS));
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function allowance(): number {
  return MONETIZATION.freeItemLimit + bonusSlots;
}

function assertQuota(): void {
  if (quotaUsed >= allowance()) throw new QuotaExceededError();
}

// ── Profile ─────────────────────────────────────────────────────────────────

/**
 * Held as mutable state rather than returning the frozen seed, so a preference
 * toggled in Settings survives navigating away and back — the same thing the
 * real profile row does.
 */
let profile: Profile = { ...mockProfile };

export function mockFetchProfile(): Promise<Profile> {
  return settle(profile);
}

export function mockUpdateProfile(patch: ProfileUpdate): Profile {
  profile = { ...profile, ...patch, updated_at: new Date().toISOString() };
  return profile;
}

/**
 * Mock twin of `renewSubscription`: moves only the cycle dates and leaves every
 * other field on the row exactly as it was.
 */
export function mockRenewSubscription(
  itemId: string,
): Promise<{ startDate: string; nextRenewal: string }> {
  const sub = db.subscriptions.find((s) => s.item_id === itemId);
  const item = db.items.find((i) => i.id === itemId);
  if (!sub || !item) return Promise.reject(new Error(`Mock subscription not found: ${itemId}`));

  const startDate = isoDay(0);
  sub.next_renewal = addBillingCycle(startDate, sub.period);
  item.purchase_date = startDate;
  item.updated_at = new Date().toISOString();

  return settle({ startDate, nextRenewal: sub.next_renewal });
}

// ── Reads ───────────────────────────────────────────────────────────────────

/** Flattens the related date onto each row exactly as the Supabase join does. */
function toListItem(item: VaultItem): ListItem {
  const warranty = db.warranties.find((w) => w.item_id === item.id);
  const subscription = db.subscriptions.find((s) => s.item_id === item.id);
  return {
    ...item,
    warranty_expires_on: warranty?.expires_on ?? null,
    next_renewal: subscription?.next_renewal ?? null,
    sub_amount: subscription?.amount ?? null,
    sub_period: subscription?.period ?? null,
  };
}

export function mockListItems(kind?: ItemKind): Promise<ListItem[]> {
  const rows = db.items
    .filter((i) => !kind || i.kind === kind)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(toListItem);
  return settle(rows);
}

export function mockGetItem(
  id: string,
): Promise<VaultItem & { warranty: Warranty | null; subscription: Subscription | null }> {
  const item = db.items.find((i) => i.id === id);
  if (!item) return Promise.reject(new Error(`Mock item not found: ${id}`));
  return settle({
    ...item,
    warranty: db.warranties.find((w) => w.item_id === id) ?? null,
    subscription: db.subscriptions.find((s) => s.item_id === id) ?? null,
  });
}

export function mockFetchQuota(): Promise<{ used: number; allowance: number }> {
  return settle({ used: quotaUsed, allowance: allowance() });
}

// ── Writes ──────────────────────────────────────────────────────────────────

export type MockNewItem = {
  kind?: ItemKind;
  merchantName: string;
  totalAmount: number | null;
  currency?: string;
  purchaseDate: string | null;
  category?: string | null;
  notes?: string | null;
  localImageUri?: string | null;
  warranty?: { expiresOn: string; durationMonths?: number | null } | null;
  ocr?: { raw: Json; confidence: number } | null;
};

export async function mockCreateItem(input: MockNewItem): Promise<VaultItem> {
  assertQuota();

  const item: VaultItem = {
    id: newId('item'),
    user_id: MOCK_USER_ID,
    kind: input.kind ?? 'receipt',
    merchant_name: input.merchantName,
    total_amount: input.totalAmount,
    currency: input.currency ?? 'SAR',
    purchase_date: input.purchaseDate,
    category: input.category ?? null,
    notes: input.notes ?? null,
    // The local file URI stands in for a storage path; `mockSignedUrl` hands it
    // straight back, so a photo just taken renders on the detail screen.
    image_path: input.localImageUri ?? null,
    ocr_status: input.ocr ? 'done' : 'manual',
    ocr_raw: input.ocr?.raw ?? null,
    ocr_confidence: input.ocr?.confidence ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  db.items.push(item);
  quotaUsed += 1;

  if (input.warranty) {
    db.warranties.push({
      id: newId('war'),
      item_id: item.id,
      user_id: MOCK_USER_ID,
      duration_months: input.warranty.durationMonths ?? null,
      expires_on: input.warranty.expiresOn,
      provider: null,
      reminder_days: [30, 7, 1],
      created_at: new Date().toISOString(),
    });
  }

  return settle(item);
}

export async function mockCreateSubscription(input: {
  name: string;
  merchant?: string | null;
  amount: number;
  currency?: string;
  period: BillingPeriod;
  nextRenewal: string;
  localImageUri?: string | null;
}): Promise<VaultItem> {
  assertQuota();

  const item: VaultItem = {
    id: newId('item'),
    user_id: MOCK_USER_ID,
    kind: 'subscription',
    merchant_name: input.name,
    total_amount: input.amount,
    currency: input.currency ?? 'SAR',
    purchase_date: isoDay(0),
    category: input.merchant ?? null,
    notes: null,
    image_path: input.localImageUri ?? null,
    ocr_status: 'manual',
    ocr_raw: null,
    ocr_confidence: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  db.items.push(item);
  quotaUsed += 1;

  db.subscriptions.push({
    id: newId('sub'),
    item_id: item.id,
    user_id: MOCK_USER_ID,
    name: input.name,
    amount: input.amount,
    currency: input.currency ?? 'SAR',
    period: input.period,
    next_renewal: input.nextRenewal,
    auto_renews: true,
    reminder_days: [3, 1],
    created_at: new Date().toISOString(),
  });

  return settle(item);
}

export function mockUpdateItem(id: string, patch: Partial<VaultItem>): Promise<VaultItem> {
  const index = db.items.findIndex((i) => i.id === id);
  if (index < 0) return Promise.reject(new Error(`Mock item not found: ${id}`));
  const updated = { ...db.items[index]!, ...patch, updated_at: new Date().toISOString() };
  db.items[index] = updated;
  return settle(updated);
}

export function mockDeleteItem(id: string): Promise<void> {
  db.items = db.items.filter((i) => i.id !== id);
  db.warranties = db.warranties.filter((w) => w.item_id !== id);
  db.subscriptions = db.subscriptions.filter((s) => s.item_id !== id);
  quotaUsed = Math.max(0, quotaUsed - 1);
  return settle(undefined);
}

/**
 * Stands in for the rewarded-ad Edge Function: mints the one permanent bonus
 * slot. Mirrors `bonus_slots_user_once` — a second call always reports
 * 'unavailable', so the mock cannot demonstrate a behaviour the server forbids.
 */
export function mockGrantBonusSlot(): Promise<'granted' | 'unavailable'> {
  if (bonusSlots >= MONETIZATION.rewardedSlotsPerAccount) return settle('unavailable' as const);
  bonusSlots = MONETIZATION.rewardedSlotsPerAccount;
  return settle('granted' as const);
}

// ── Storage ─────────────────────────────────────────────────────────────────

/** No upload happens; the local URI is the "path". */
export function mockUploadImage(localUri: string): Promise<string> {
  return settle(localUri);
}

export function mockSignedUrl(path: string): Promise<string> {
  return settle(path);
}

/** Test hook — drops every write and restores the seed. */
export function resetMockBackend(): void {
  db = buildSeed();
  quotaUsed = 3;
  bonusSlots = 0;
}
