import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryClient';
import { createSubscription, QuotaExceededError, renewSubscription } from '@/services/receipts';
import { useSession } from './useSession';

export function useCreateSubscription(onQuotaBlocked?: () => void) {
  const { user } = useSession();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: Parameters<typeof createSubscription>[1]) =>
      createSubscription(user!.id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.items(user!.id) });
      void qc.invalidateQueries({ queryKey: queryKeys.quota(user!.id) });
      void qc.invalidateQueries({ queryKey: ['summary', user!.id] });
    },
    onError: (error) => {
      if (error instanceof QuotaExceededError) onQuotaBlocked?.();
    },
  });
}

/**
 * Renew an expired subscription in place. No quota check: this reuses the
 * existing row rather than creating one, so it cannot push the user over the
 * item limit.
 */
export function useRenewSubscription(itemId: string) {
  const { user } = useSession();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => renewSubscription(itemId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.item(itemId) });
      void qc.invalidateQueries({ queryKey: queryKeys.items(user!.id) });
    },
  });
}
