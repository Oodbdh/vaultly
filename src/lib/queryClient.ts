import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const queryKeys = {
  profile: (userId: string) => ['profile', userId] as const,
  items: (userId: string) => ['items', userId] as const,
  item: (id: string) => ['item', id] as const,
  quota: (userId: string) => ['quota', userId] as const,
  bonusSlots: (userId: string) => ['bonus-slots', userId] as const,
  offerings: () => ['offerings'] as const,
};
