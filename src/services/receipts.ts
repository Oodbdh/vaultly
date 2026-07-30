import { USE_MOCK_DATA } from '@/constants/config';
import { supabase, isQuotaError } from '@/lib/supabase';
import type {
  BillingPeriod,
  ItemKind,
  Json,
  Subscription,
  VaultItem,
  Warranty,
} from '@/lib/database.types';
import { QuotaExceededError } from '@/lib/errors';
import type { ListItem } from '@/lib/types';
import {
  mockCreateItem,
  mockCreateSubscription,
  mockDeleteItem,
  mockFetchQuota,
  mockGetItem,
  mockListItems,
  mockUpdateItem,
} from '@/mocks/backend';
import { uploadReceiptImage } from './storage';
import { scheduleRenewalReminders, scheduleWarrantyReminders } from './notifications';

export type NewItemInput = {
  kind?: ItemKind;
  merchantName: string;
  totalAmount: number | null;
  currency?: string;
  purchaseDate: string | null;
  category?: string | null;
  notes?: string | null;
  /** local file uri from the picker/camera; uploaded before insert */
  localImageUri?: string | null;
  warranty?: { expiresOn: string; durationMonths?: number | null } | null;
  /** `raw` is persisted to the `jsonb` column, so it must be JSON-serialisable. */
  ocr?: { raw: Json; confidence: number } | null;
};

// Re-exported so call sites keep importing it from the service they use.
export { QuotaExceededError } from '@/lib/errors';

export async function listItems(userId: string, kind?: ItemKind): Promise<ListItem[]> {
  if (USE_MOCK_DATA) return mockListItems(kind);

  let q = supabase
    .from('vault_items')
    // joined so every card can render a live countdown without an extra query
    .select('*, warranties(expires_on), subscriptions(next_renewal, amount, period, currency)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (kind) q = q.eq('kind', kind);
  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []).map((row) => {
    // The embeds resolve through the generated `Relationships`, so supabase-js
    // infers `warranties` / `subscriptions` as arrays here without a cast.
    const { warranties, subscriptions, ...item } = row;
    return {
      ...item,
      warranty_expires_on: warranties?.[0]?.expires_on ?? null,
      next_renewal: subscriptions?.[0]?.next_renewal ?? null,
      sub_amount: subscriptions?.[0]?.amount ?? null,
      sub_period: subscriptions?.[0]?.period ?? null,
    };
  });
}

export async function getItem(
  id: string,
): Promise<VaultItem & { warranty: Warranty | null; subscription: Subscription | null }> {
  if (USE_MOCK_DATA) return mockGetItem(id);

  const [{ data: item, error }, { data: warranty }, { data: subscription }] = await Promise.all([
    supabase.from('vault_items').select('*').eq('id', id).single(),
    supabase.from('warranties').select('*').eq('item_id', id).maybeSingle(),
    supabase.from('subscriptions').select('*').eq('item_id', id).maybeSingle(),
  ]);
  if (error) throw error;
  return {
    ...(item as VaultItem),
    warranty: warranty ?? null,
    subscription: subscription ?? null,
  };
}

/**
 * Insert flow. The DB trigger `enforce_item_quota` is the authority on the
 * 4-item free limit, so a client-side race can never sneak past it — we just
 * translate the error into something the UI can act on (show the paywall).
 */
export async function createItem(userId: string, input: NewItemInput): Promise<VaultItem> {
  if (USE_MOCK_DATA) {
    const item = await mockCreateItem(input);
    if (input.warranty) {
      await scheduleWarrantyReminders({
        itemId: item.id,
        merchant: item.merchant_name,
        expiresOn: input.warranty.expiresOn,
      });
    }
    return item;
  }

  const imagePath = input.localImageUri
    ? await uploadReceiptImage(userId, input.localImageUri)
    : null;

  const { data, error } = await supabase
    .from('vault_items')
    .insert({
      user_id: userId,
      kind: input.kind ?? 'receipt',
      merchant_name: input.merchantName,
      total_amount: input.totalAmount,
      currency: input.currency ?? 'SAR',
      purchase_date: input.purchaseDate,
      category: input.category ?? null,
      notes: input.notes ?? null,
      image_path: imagePath,
      ocr_status: input.ocr ? 'done' : 'manual',
      ocr_raw: input.ocr?.raw ?? null,
      ocr_confidence: input.ocr?.confidence ?? null,
    })
    .select()
    .single();

  if (error) {
    if (isQuotaError(error)) throw new QuotaExceededError();
    throw error;
  }

  if (input.warranty) {
    await supabase.from('warranties').insert({
      item_id: data.id,
      user_id: userId,
      expires_on: input.warranty.expiresOn,
      duration_months: input.warranty.durationMonths ?? null,
      provider: null,
      reminder_days: [30, 7, 1],
    });
    await scheduleWarrantyReminders({
      itemId: data.id,
      merchant: data.merchant_name,
      expiresOn: input.warranty.expiresOn,
    });
  }

  return data;
}

/** Manual subscription entry — also used by the post-scan "add subscription" path. */
export async function createSubscription(
  userId: string,
  input: {
    name: string;
    merchant?: string | null;
    amount: number;
    currency?: string;
    period: BillingPeriod;
    nextRenewal: string;
    localImageUri?: string | null;
  },
): Promise<VaultItem> {
  if (USE_MOCK_DATA) {
    const item = await mockCreateSubscription(input);
    await scheduleRenewalReminders({
      subscriptionId: item.id,
      name: input.name,
      nextRenewal: input.nextRenewal,
      amountLabel: `${input.amount} ${input.currency ?? 'SAR'}`,
    });
    return item;
  }

  const imagePath = input.localImageUri
    ? await uploadReceiptImage(userId, input.localImageUri)
    : null;

  const { data, error } = await supabase
    .from('vault_items')
    .insert({
      user_id: userId,
      kind: 'subscription',
      merchant_name: input.name,
      total_amount: input.amount,
      currency: input.currency ?? 'SAR',
      purchase_date: new Date().toISOString().slice(0, 10),
      category: input.merchant ?? null,
      notes: null,
      image_path: imagePath,
      ocr_status: 'manual',
      ocr_raw: null,
      ocr_confidence: null,
    })
    .select()
    .single();

  if (error) {
    if (isQuotaError(error)) throw new QuotaExceededError();
    throw error;
  }

  await supabase.from('subscriptions').insert({
    item_id: data.id,
    user_id: userId,
    name: input.name,
    amount: input.amount,
    currency: input.currency ?? 'SAR',
    period: input.period,
    next_renewal: input.nextRenewal,
    auto_renews: true,
    reminder_days: [3, 1],
  });

  await scheduleRenewalReminders({
    subscriptionId: data.id,
    name: input.name,
    nextRenewal: input.nextRenewal,
    amountLabel: `${input.amount} ${input.currency ?? 'SAR'}`,
  });

  return data;
}

export async function updateItem(id: string, patch: Partial<VaultItem>): Promise<VaultItem> {
  if (USE_MOCK_DATA) return mockUpdateItem(id, patch);

  const { data, error } = await supabase
    .from('vault_items')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteItem(id: string): Promise<void> {
  if (USE_MOCK_DATA) return mockDeleteItem(id);

  const { error } = await supabase.from('vault_items').delete().eq('id', id);
  if (error) throw error;
}

/** Used + allowance, straight from the DB so client and server agree. */
export async function fetchQuota(userId: string): Promise<{ used: number; allowance: number }> {
  if (USE_MOCK_DATA) return mockFetchQuota();

  const [{ count }, { data: allowance }] = await Promise.all([
    supabase.from('vault_items').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.rpc('item_allowance', { uid: userId }),
  ]);
  return { used: count ?? 0, allowance: Number(allowance ?? 4) };
}
