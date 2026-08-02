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

/**
 * What a restore actually did. A boolean could not tell "nothing to restore"
 * apart from "the store rejected us", which is why the button looked inert.
 */
export type RestoreOutcome =
  | { status: 'restored' }
  | { status: 'none' }
  | { status: 'unavailable' }
  | { status: 'error'; message: string };

/**
 * Alert copy for an outcome. Shared by the Profile row and the paywall button
 * so the two cannot drift apart.
 */
export function restoreAlert(
  outcome: RestoreOutcome,
  t: (k: string) => string,
): { title: string; message?: string } {
  switch (outcome.status) {
    case 'restored':
      return { title: t('paywall.restored') };
    case 'none':
      return { title: t('paywall.restoreNone') };
    case 'unavailable':
      return { title: t('paywall.restoreUnavailable') };
    case 'error':
      // The store's own words — never a generic stand-in.
      return { title: t('paywall.restoreFailed'), message: outcome.message };
  }
}

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

  const restore = useCallback(async (): Promise<RestoreOutcome> => {
    setBusy(true);
    try {
      const info = await restorePurchases();

      // null only when the store SDK is absent (Expo Go) or was never
      // configured — RevenueCat itself always resolves with a CustomerInfo.
      if (!info) return { status: 'unavailable' };

      // Entitlements are pushed into the store here, so every gate reading
      // `isPremium` — quota, ads, paywall — reflects the restore immediately.
      setInfo(info);

      return info.entitlements.active[MONETIZATION.entitlementId]
        ? { status: 'restored' }
        : { status: 'none' };
    } catch (e) {
      // Surface the real reason. This used to `return false`, which the callers
      // then discarded, so a failed restore was indistinguishable from a
      // successful one — and from having nothing to restore.
      return { status: 'error', message: e instanceof Error ? e.message : String(e) };
    } finally {
      setBusy(false);
    }
  }, [setInfo]);

  return { pkg, priceLabel, isLoading, busy, purchase, restore };
}
