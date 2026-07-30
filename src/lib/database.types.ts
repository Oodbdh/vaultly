/**
 * App-facing names for the database schema.
 *
 * The raw schema lives in `database.generated.ts`, which is overwritten wholesale
 * by `npm run db:types`. Nothing hand-written may go in that file. This façade is
 * the hand-written half: it re-exports `Database` for the supabase client and
 * derives the short aliases the app actually imports, so regenerating the schema
 * can never clobber them and the 10 import sites never have to change.
 *
 * Because these alias the generated rows, a column added or renamed in Postgres
 * surfaces as a type error at the call site after the next regeneration, rather
 * than as a silent runtime `undefined`.
 */
import type { Database } from './database.generated';

export type { Database, Json } from './database.generated';

type Tables = Database['public']['Tables'];
type Enums = Database['public']['Enums'];

export type ItemKind = Enums['item_kind'];
export type BillingPeriod = Enums['billing_period'];
export type PlanTier = Enums['plan_tier'];
export type OcrStatus = Enums['ocr_status'];

export type Profile = Tables['profiles']['Row'];
export type VaultItem = Tables['vault_items']['Row'];
export type Warranty = Tables['warranties']['Row'];
export type Subscription = Tables['subscriptions']['Row'];
export type BonusSlot = Tables['bonus_slots']['Row'];

export type ProfileUpdate = Tables['profiles']['Update'];
