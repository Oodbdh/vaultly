import { useEntitlementStore } from '@/store/entitlementStore';

/** The single premium gate. `showAds` is its inverse by definition. */
export function usePremium() {
  const { isPremium, loading, customerInfo, refresh } = useEntitlementStore();
  return {
    isPremium,
    loading,
    showAds: !isPremium,
    expiresAt:
      customerInfo?.entitlements.active.premium_access?.expirationDate ?? null,
    willRenew: customerInfo?.entitlements.active.premium_access?.willRenew ?? false,
    refresh,
  };
}
