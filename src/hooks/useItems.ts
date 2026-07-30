import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryClient';
import type { ItemKind } from '@/lib/database.types';
import {
  createItem,
  deleteItem,
  getItem,
  listItems,
  updateItem,
  QuotaExceededError,
  type NewItemInput,
} from '@/services/receipts';
import { useSession } from './useSession';

export function useItems(kind?: ItemKind) {
  const { user } = useSession();
  return useQuery({
    queryKey: [...queryKeys.items(user?.id ?? 'anon'), kind ?? 'all'],
    queryFn: () => listItems(user!.id, kind),
    enabled: !!user,
  });
}

export function useItem(id: string) {
  return useQuery({ queryKey: queryKeys.item(id), queryFn: () => getItem(id), enabled: !!id });
}

export function useCreateItem(onQuotaBlocked?: () => void) {
  const { user } = useSession();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: NewItemInput) => createItem(user!.id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.items(user!.id) });
      void qc.invalidateQueries({ queryKey: queryKeys.quota(user!.id) });
    },
    onError: (error) => {
      if (error instanceof QuotaExceededError) onQuotaBlocked?.();
    },
  });
}

export function useUpdateItem(id: string) {
  const { user } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Parameters<typeof updateItem>[1]) => updateItem(id, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.item(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.items(user!.id) });
    },
  });
}

export function useDeleteItem() {
  const { user } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteItem(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.items(user!.id) });
      void qc.invalidateQueries({ queryKey: queryKeys.quota(user!.id) });
    },
  });
}
