import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { MONETIZATION, USE_MOCK_DATA } from '@/constants/config';
import { queryKeys } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { mockGrantBonusSlot } from '@/mocks/backend';
import { fetchQuota } from '@/services/receipts';
import { initAds, showRewardedAd } from '@/services/ads';
import { useSession } from './useSession';
import { usePremium } from './usePremium';

export type QuotaGate =
  | { allowed: true }
  | { allowed: false; reason: 'limit'; canWatchAd: boolean };

/**
 * Monetization enforcement, client side:
 *   premium → unlimited, never any ad
 *   free    → 4 permanent items, plus one permanent 5th unlocked by watching a
 *             single rewarded ad. That reward is once per account and never
 *             expires; beyond 5 the only route is Premium.
 * The DB trigger enforces the same rule; this hook exists so the UI can react
 * before the user fills in a form.
 */
export function useItemQuota() {
  const { user } = useSession();
  const { isPremium } = usePremium();
  const qc = useQueryClient();
  const router = useRouter();
  const [adLoading, setAdLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.quota(user?.id ?? 'anon'),
    queryFn: () => fetchQuota(user!.id),
    enabled: !!user && !isPremium,
  });

  const used = data?.used ?? 0;
  const allowance = isPremium ? Infinity : data?.allowance ?? MONETIZATION.freeItemLimit;
  /** 0 before the reward is claimed, 1 after — it never goes back down. */
  const bonusUnlocked = isPremium
    ? 0
    : Math.max(0, Math.min(allowance - MONETIZATION.freeItemLimit, MONETIZATION.rewardedSlotsPerAccount));
  const remaining = isPremium ? Infinity : Math.max(0, allowance - used);

  /**
   * The ad is offered only while the one-off reward is unclaimed. Once claimed,
   * this is false forever, so the 6th item can only ever lead to the paywall.
   */
  const canWatchAd = !isPremium && bonusUnlocked < MONETIZATION.rewardedSlotsPerAccount;

  const gate: QuotaGate = isPremium || remaining > 0
    ? { allowed: true }
    : { allowed: false, reason: 'limit', canWatchAd };

  /** Watch the rewarded ad → server mints the permanent slot → quota refetches. */
  const watchAdForSlot = useCallback(async (): Promise<'granted' | 'dismissed' | 'unavailable'> => {
    if (isPremium) return 'unavailable'; // premium is ad-free, period
    if (!canWatchAd) return 'unavailable'; // reward already claimed — never offer a second
    setAdLoading(true);
    try {
      await initAds();
      const outcome = await showRewardedAd();
      if (outcome.status !== 'earned') {
        return outcome.status === 'dismissed' ? 'dismissed' : 'unavailable';
      }

      if (USE_MOCK_DATA) {
        const granted = await mockGrantBonusSlot();
        if (granted === 'granted') {
          await qc.invalidateQueries({ queryKey: queryKeys.quota(user!.id) });
        }
        return granted;
      }

      // The client cannot write bonus_slots (RLS); the Edge Function verifies
      // and inserts with the service role.
      const { error } = await supabase.functions.invoke('grant-bonus-slot', {
        body: { source: 'rewarded_ad', rewardType: outcome.type, rewardAmount: outcome.amount },
      });
      if (error) return 'unavailable';
      await qc.invalidateQueries({ queryKey: queryKeys.quota(user!.id) });
      return 'granted';
    } finally {
      setAdLoading(false);
    }
  }, [isPremium, canWatchAd, qc, user]);

  const openPaywall = useCallback(() => router.push('/paywall'), [router]);

  return {
    isLoading: isLoading && !isPremium,
    isPremium,
    used,
    limit: isPremium ? Infinity : allowance,
    remaining,
    /** 0 or 1 — whether the one-off permanent slot has been unlocked. */
    bonusUnlocked,
    canWatchAd,
    gate,
    adLoading,
    watchAdForSlot,
    openPaywall,
  };
}
