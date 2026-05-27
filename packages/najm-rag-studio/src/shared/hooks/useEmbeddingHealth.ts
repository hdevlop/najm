import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '@/lib/api';

export interface EmbeddingHealthResult {
  ok: boolean;
  provider: string;
  baseUrl: string;
  model: string;
  error?: string;
  latencyMs: number;
}

export const EMBEDDING_HEALTH_KEY = ['rag-studio', 'health', 'embedding'] as const;

export function useEmbeddingHealth(intervalMs = 30000) {
  const apiClient = useApiClient();

  const query = useQuery({
    queryKey: EMBEDDING_HEALTH_KEY,
    queryFn: async (): Promise<EmbeddingHealthResult> => {
      try {
        return await apiClient.get<EmbeddingHealthResult>('/health/embedding');
      } catch (err) {
        return {
          ok: false,
          provider: 'unknown',
          baseUrl: 'unknown',
          model: 'unknown',
          error: err instanceof Error ? err.message : 'Embedding health check failed',
          latencyMs: 0,
        };
      }
    },
    refetchInterval: intervalMs > 0 ? intervalMs : false,
  });

  return {
    health: query.data ?? null,
    checking: query.isFetching,
    recheck: () => query.refetch().then(() => undefined),
  };
}
