import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '@/lib/api';
import type { MCPTool, UnmatchedQuery } from '@/features/logs/types';

const COUNT_KEY = ['rag-studio', 'unmatched', 'count'] as const;
const INBOX_KEY = ['rag-studio', 'unmatched', 'inbox'] as const;

export function useUnmatchedInbox(options: { enabled?: boolean } = {}) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  const countQuery = useQuery({
    queryKey: COUNT_KEY,
    queryFn: () => apiClient.get<{ count: number }>('/unmatched/count').then((r) => r.count ?? 0),
  });

  const inboxQuery = useQuery({
    queryKey: INBOX_KEY,
    queryFn: async () => {
      const [items, tools] = await Promise.all([
        apiClient.get<UnmatchedQuery[]>('/unmatched'),
        apiClient.get<MCPTool[]>('/tools/list'),
      ]);
      return { items, tools };
    },
    enabled: options.enabled ?? false,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['rag-studio', 'unmatched'] });
  }, [queryClient]);

  const mapUnmatched = useCallback(async (id: string, toolName: string) => {
    await apiClient.post(`/unmatched/${encodeURIComponent(id)}/map`, { toolName });
    invalidate();
  }, [apiClient, invalidate]);

  const discardUnmatched = useCallback(async (id: string) => {
    await apiClient.delete(`/unmatched/${encodeURIComponent(id)}`);
    invalidate();
  }, [apiClient, invalidate]);

  const items = inboxQuery.data?.items ?? [];
  const unmatchedCount = inboxQuery.data ? items.length : (countQuery.data ?? 0);

  return {
    unmatchedCount,
    unmatchedItems: items,
    unmatchedTools: inboxQuery.data?.tools ?? [],
    unmatchedLoading: inboxQuery.isFetching,
    loadUnmatchedInbox: invalidate,
    mapUnmatched,
    discardUnmatched,
  };
}
