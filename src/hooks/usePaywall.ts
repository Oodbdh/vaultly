import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { MONETIZATION } from '@/constants/config';
import { queryKeys } from '@/lib/queryClient';
import {
  getMonthlyPackage,
  purchasePremium,
  restorePurchases,
} from '@/services/purchases';
import { useEntitlementStore } from '@/store/entitlementStore';

export function usePaywall() {
  const [busy, setBusy] = useState(false);
  const setInfo = useEntitlementStore((s) => s.setInfo);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.offerings(),
    queryFn: getMonthlyPackage,
    staleTime: 5 * 60_000,
  });

  const pkg = data?.pkg ?? null;
  const priceLabel = pkg?.product.priceString ?? MONETIZATION.monthlyPriceFallback;

  const purchase = useCallback(async (): Promise<'purchased' | 'cancelled' | 'error'> => {
    if (!pkg) return 'error';
    setBusy(true);
    try {
      const outcome = await purchasePremium(pkg);
      if (outcome.status === 'purchased') setInfo(outcome.info);
      return outcome.status === 'purchased' ? 'purchased' : outcome.status === 'cancelled' ? 'cancelled' : 'error';
    } finally {
      setBusy(false);
    }
  }, [pkg, setInfo]);

  const restore = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    try {
      const info = await restorePurchases();
      // null when the store SDK isn't available (Expo Go) or isn't configured.
      if (!info) return false;
      setInfo(info);
      return !!info.entitlements.active[MONETIZATION.entitlementId];
    } catch {
      return false;
    } finally {
      setBusy(false);
    }
  }, [setInfo]);

  return { pkg, priceLabel, isLoading, busy, purchase, restore };
}
