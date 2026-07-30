import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useSession } from './useSession';

export type VaultSummary = {
  totalItems: number;
  activeWarranties: number;
  /** Normalised to a monthly figure regardless of each subscription's period. */
  monthlySubscriptionCost: number;
  currency: string;
  expiringSoon: { id: string; merchant: string; expiresOn: string }[];
};

const PER_MONTH: Record<string, number> = {
  weekly: 52 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  yearly: 1 / 12,
};

export function useVaultSummary() {
  const { user } = useSession();

  return useQuery<VaultSummary>({
    queryKey: ['summary', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

      const [items, warranties, subs, expiring] = await Promise.all([
        supabase
          .from('vault_items')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user!.id),
        supabase
          .from('warranties')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user!.id)
          .gte('expires_on', today),
        supabase.from('subscriptions').select('amount, period, currency').eq('user_id', user!.id),
        supabase
          .from('warranties')
          .select('id, expires_on, vault_items(merchant_name)')
          .eq('user_id', user!.id)
          .gte('expires_on', today)
          .lte('expires_on', in30)
          .order('expires_on', { ascending: true })
          .limit(5),
      ]);

      const rows = subs.data ?? [];
      const monthly = rows.reduce(
        (sum, s) => sum + Number(s.amount) * (PER_MONTH[s.period] ?? 1),
        0,
      );

      return {
        totalItems: items.count ?? 0,
        activeWarranties: warranties.count ?? 0,
        monthlySubscriptionCost: Math.round(monthly * 100) / 100,
        currency: rows[0]?.currency ?? 'SAR',
        expiringSoon: (expiring.data ?? []).map((w) => ({
          id: w.id,
          merchant:
            (w as unknown as { vault_items?: { merchant_name?: string } }).vault_items
              ?.merchant_name ?? '',
          expiresOn: w.expires_on,
        })),
      };
    },
  });
}
