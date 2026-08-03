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
import type { ListItem, ReminderKind, ReminderTarget } from '@/lib/types';
import { addBillingCycle, todayISO } from '@/lib/dateMath';
import {
  mockCreateItem,
  mockCreateSubscription,
  mockDeleteItem,
  mockFetchQuota,
  mockGetItem,
  mockListItems,
  mockListReminderTargets,
  mockRenewSubscription,
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

/**
 * Every item that should currently hold a reminder of one kind, with the exact
 * inputs the schedule functions take — including each row's own
 * `reminder_days`, so re-scheduling restores what was there rather than
 * flattening everything to the defaults.
 */
export async function listReminderTargets(
  userId: string,
  kind: ReminderKind,
): Promise<ReminderTarget[]> {
  if (USE_MOCK_DATA) return mockListReminderTargets(kind);

  if (kind === 'warranty') {
    // The merchant name lives on the item, not the warranty. Two flat queries
    // rather than an embed: the join direction here is the one supabase-js
    // types least predictably, and the row counts are small.
    const [{ data: warranties, error }, { data: items, error: itemsError }] = await Promise.all([
      supabase.from('warranties').select('item_id, expires_on, reminder_days').eq('user_id', userId),
      supabase.from('vault_items').select('id, merchant_name').eq('user_id', userId),
    ]);
    if (error) throw error;
    if (itemsError) throw itemsError;

    const merchantById = new Map((items ?? []).map((i) => [i.id, i.merchant_name]));
    return (warranties ?? []).flatMap<ReminderTarget>((w) => {
      const merchant = merchantById.get(w.item_id);
      // An orphan would have no name to put in the notification body.
      if (!merchant) return [];
      return [
        {
          kind: 'warranty',
          itemId: w.item_id,
          merchant,
          expiresOn: w.expires_on,
          reminderDays: w.reminder_days,
        },
      ];
    });
  }

  const { data, error } = await supabase
    .from('subscriptions')
    .select('item_id, name, next_renewal, amount, currency, reminder_days')
    .eq('user_id', userId);
  if (error) throw error;

  return (data ?? []).flatMap<ReminderTarget>((s) =>
    // `subscriptions.item_id` is nullable; without one there is nothing to key
    // the reminder on.
    s.item_id
      ? [
          {
            kind: 'renewal',
            itemId: s.item_id,
            name: s.name,
            nextRenewal: s.next_renewal,
            amountLabel: `${s.amount} ${s.currency}`,
            reminderDays: s.reminder_days,
          },
        ]
      : [],
  );
}

/**
 * Re-schedule one kind of reminder across the whole vault.
 *
 * This is what makes switching a toggle back on restore reminders for items
 * that already existed, instead of only for ones touched afterwards. The
 * schedule functions consult the preference themselves and return `[]` while it
 * is off, so the caller must persist `true` *before* calling this.
 *
 * Returns the number of individual reminders scheduled — items whose date has
 * already passed contribute none.
 */
export async function rescheduleReminders(userId: string, kind: ReminderKind): Promise<number> {
  const targets = await listReminderTargets(userId, kind);
  let scheduled = 0;

  for (const target of targets) {
    const ids =
      target.kind === 'warranty'
        ? await scheduleWarrantyReminders({
            itemId: target.itemId,
            merchant: target.merchant,
            expiresOn: target.expiresOn,
            reminderDays: target.reminderDays,
          })
        : await scheduleRenewalReminders({
            subscriptionId: target.itemId,
            name: target.name,
            nextRenewal: target.nextRenewal,
            amountLabel: target.amountLabel,
            reminderDays: target.reminderDays,
          });
    scheduled += ids.length;
  }

  return scheduled;
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

/**
 * Renew an expired subscription in place, within its 48-hour grace window.
 *
 * Everything that identifies the subscription is left alone — name, amount,
 * currency, period, auto_renews, reminder_days, notes, category, image. Only
 * the cycle dates move: the item's `purchase_date` becomes the new start and
 * `next_renewal` one billing cycle after it. "Active" is not a stored column;
 * it follows from `next_renewal` being in the future again.
 *
 * The caller is responsible for checking `renewalWindow(...).renewable` first —
 * this is deliberately a dumb write so the window rule lives in one tested
 * place rather than being duplicated here.
 *
 * Subscriptions only. Nothing here touches warranties or receipts.
 */
export async function renewSubscription(
  itemId: string,
): Promise<{ startDate: string; nextRenewal: string }> {
  if (USE_MOCK_DATA) return mockRenewSubscription(itemId);

  const { data: sub, error: readError } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('item_id', itemId)
    .single();
  if (readError) throw readError;

  const startDate = todayISO();
  const nextRenewal = addBillingCycle(startDate, sub.period);

  const { error: subError } = await supabase
    .from('subscriptions')
    .update({ next_renewal: nextRenewal })
    .eq('item_id', itemId);
  if (subError) throw subError;

  // The item's purchase date doubles as the subscription's start date.
  const { error: itemError } = await supabase
    .from('vault_items')
    .update({ purchase_date: startDate })
    .eq('id', itemId);
  if (itemError) throw itemError;

  // Reminder *settings* are unchanged; the reminders themselves are re-pointed
  // at the new date. Identifiers are derived, so this replaces rather than
  // duplicates the old ones.
  await scheduleRenewalReminders({
    subscriptionId: itemId,
    name: sub.name,
    nextRenewal,
    amountLabel: `${sub.amount} ${sub.currency}`,
    reminderDays: sub.reminder_days,
  });

  return { startDate, nextRenewal };
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
