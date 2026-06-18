import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { TOOL_REFRESH_BUCKETS } from '@/features/assistant';
import type { RefreshBucket } from '@/features/assistant/types';
import { KNOWLEDGE_DOCUMENTS_KEY } from '@/features/knowledge/hooks/useKnowledgeDocuments';
import { TOOLS_KEY } from '@/features/routing-tools/hooks/useToolsWorkspace';
import { SEMANTICS_ROOT_KEY } from '@/features/routing-semantics/hooks/useSemanticsWorkspace';
import { ROUTING_TESTS_KEY } from '@/features/routing-tests/hooks/useRoutingTests';
import { EMBEDDING_HEALTH_KEY } from '@/shared/hooks/useEmbeddingHealth';

const ROUTING_BUCKETS: RefreshBucket[] = ['routing-semantics', 'routing-tests', 'routing-tools'];

const BUCKET_QUERY_KEYS: Record<RefreshBucket, readonly unknown[] | null> = {
  knowledge: KNOWLEDGE_DOCUMENTS_KEY,
  'routing-tools': TOOLS_KEY,
  'routing-semantics': SEMANTICS_ROOT_KEY,
  'routing-tests': ROUTING_TESTS_KEY,
  'embedding-health': EMBEDDING_HEALTH_KEY,
  settings: null,
};

export function useRefreshBuckets() {
  const queryClient = useQueryClient();

  const invalidateBuckets = useCallback((buckets: RefreshBucket[]) => {
    for (const bucket of buckets) {
      const key = BUCKET_QUERY_KEYS[bucket];
      if (key) queryClient.invalidateQueries({ queryKey: key });
    }
  }, [queryClient]);

  const onAssistantToolResult = useCallback((toolName: string) => {
    invalidateBuckets(TOOL_REFRESH_BUCKETS[toolName] ?? []);
  }, [invalidateBuckets]);

  const onDependenciesChange = useCallback(() => {
    invalidateBuckets(ROUTING_BUCKETS);
  }, [invalidateBuckets]);

  return { onAssistantToolResult, onDependenciesChange };
}
