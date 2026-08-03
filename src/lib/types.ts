import type { BillingPeriod, VaultItem } from './database.types';

/**
 * A vault row as the lists see it: the item plus the one date each related
 * table contributes, flattened by `listItems()` so cards can render a countdown
 * without a second query.
 */
export type ListItem = VaultItem & {
  warranty_expires_on?: string | null;
  next_renewal?: string | null;
  sub_amount?: number | null;
  sub_period?: BillingPeriod | null;
};

/** The two things the app schedules local reminders for. */
export type ReminderKind = 'warranty' | 'renewal';

/**
 * One item's worth of reminder inputs, in the shape the schedule functions take.
 *
 * Lives here rather than in `services/notifications.ts` so the mock backend can
 * mirror the query without importing a module that pulls in expo-notifications.
 *
 * `itemId` is the **vault item** id in both variants. Renewal reminders are
 * keyed by the item, not by the `subscriptions` row — every existing call site
 * passes the item id as `subscriptionId`, and the identifiers must match or a
 * re-schedule would orphan the reminders it meant to replace.
 */
export type ReminderTarget =
  | {
      kind: 'warranty';
      itemId: string;
      merchant: string;
      expiresOn: string;
      reminderDays: number[];
    }
  | {
      kind: 'renewal';
      itemId: string;
      name: string;
      nextRenewal: string;
      amountLabel: string;
      reminderDays: number[];
    };
