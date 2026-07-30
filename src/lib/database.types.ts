/**
 * Hand-written for the initial setup. Regenerate from the live schema with:
 *   npm run db:types
 */
export type ItemKind = 'receipt' | 'warranty' | 'subscription';
export type BillingPeriod = 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type PlanTier = 'free' | 'premium';
export type OcrStatus = 'pending' | 'processing' | 'done' | 'failed' | 'manual';

export type Profile = {
  id: string;
  display_name: string | null;
  locale: 'en' | 'ar';
  currency: string;
  plan_tier: PlanTier;
  premium_until: string | null;
  push_token: string | null
  created_at: string;
  updated_at: string;
};

export type VaultItem = {
  id: string;
  user_id: string;
  kind: ItemKind;
  merchant_name: string;
  total_amount: number | null;
  currency: string;
  purchase_date: string | null;
  category: string | null;
  notes: string | null;
  image_path: string | null;
  ocr_status: OcrStatus;
  ocr_raw: unknown | null;
  ocr_confidence: number | null;
  created_at: string;
  updated_at: string;
};

export type Warranty = {
  id: string;
  item_id: string;
  user_id: string;
  duration_months: number | null;
  expires_on: string;
  provider: string | null;
  reminder_days: number[];
  created_at: string;
};

export type Subscription = {
  id: string;
  item_id: string | null;
  user_id: string;
  name: string;
  amount: number;
  currency: string;
  period: BillingPeriod;
  next_renewal: string;
  auto_renews: boolean;
  reminder_days: number[];
  created_at: string;
};

export type BonusSlot = {
  id: string;
  user_id: string;
  source: string;
  granted_at: string;
  expires_at: string;
};

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile>;
      vault_items: Table<
        VaultItem,
        Omit<VaultItem, 'id' | 'created_at' | 'updated_at'> & { id?: string }
      >;
      warranties: Table<Warranty, Omit<Warranty, 'id' | 'created_at'> & { id?: string }>;
      subscriptions: Table<Subscription, Omit<Subscription, 'id' | 'created_at'> & { id?: string }>;
      bonus_slots: Table<BonusSlot>;
    };
    Views: Record<string, never>;
    Functions: {
      is_premium: { Args: { uid: string }; Returns: boolean };
      item_allowance: { Args: { uid: string }; Returns: number };
    };
    Enums: {
      item_kind: ItemKind;
      billing_period: BillingPeriod;
      plan_tier: PlanTier;
      ocr_status: OcrStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
