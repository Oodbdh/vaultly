import { create } from 'zustand';
import type { CustomerInfo } from 'react-native-purchases';

import { DEMO_SHOWCASE } from '@/constants/config';
import { getCustomerInfo, hasPremium, onCustomerInfoChange } from '@/services/purchases';

type EntitlementState = {
  customerInfo: CustomerInfo | null;
  isPremium: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  setInfo: (info: CustomerInfo) => void;
};

/**
 * `isPremium` is the ONE flag every gate reads: item limits, ad triggers,
 * paywall visibility. RevenueCat is the source of truth; the `profiles` row is
 * only a webhook mirror used by server-side quota checks.
 */
export const useEntitlementStore = create<EntitlementState>((set) => ({
  customerInfo: null,
  // Showcase mode has no store account to ask, and RevenueCat would answer
  // "not premium" — which would put the quota banner and the rewarded-ad card
  // back on every screenshot. The mock profile's `plan_tier` cannot do this on
  // its own: every gate in the app reads this flag, not the profile row.
  isPremium: DEMO_SHOWCASE,
  loading: !DEMO_SHOWCASE,

  setInfo: (info) =>
    set({ customerInfo: info, isPremium: DEMO_SHOWCASE || hasPremium(info), loading: false }),

  refresh: async () => {
    if (DEMO_SHOWCASE) {
      set({ isPremium: true, loading: false });
      return;
    }
    const info = await getCustomerInfo();
    set({ customerInfo: info, isPremium: hasPremium(info), loading: false });
  },
}));

export function subscribeToEntitlements(): () => void {
  void useEntitlementStore.getState().refresh();
  return onCustomerInfoChange((info) => useEntitlementStore.getState().setInfo(info));
}
