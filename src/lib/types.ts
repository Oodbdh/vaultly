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
