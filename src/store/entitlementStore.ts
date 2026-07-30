import { create } from 'zustand';
import type { CustomerInfo } from 'react-native-purchases';

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
  isPremium: false,
  loading: true,

  setInfo: (info) => set({ customerInfo: info, isPremium: hasPremium(info), loading: false }),

  refresh: async () => {
    const info = await getCustomerInfo();
    set({ customerInfo: info, isPremium: hasPremium(info), loading: false });
  },
}));

export function subscribeToEntitlements(): () => void {
  void useEntitlementStore.getState().refresh();
  return onCustomerInfoChange((info) => useEntitlementStore.getState().setInfo(info));
}
