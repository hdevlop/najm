import { useState, useCallback, useEffect } from 'react';
import type { RoutingPreviewResult } from '@/features/routing-semantics/types';
import type { PendingRoutingLabQuery } from '@/lib/chatDraftsContext';

export function useRoutingLab(
  onPreview: (query: string) => Promise<RoutingPreviewResult>,
  pendingQuery?: PendingRoutingLabQuery | null,
) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RoutingPreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);

  const handlePreview = useCallback(async (q?: unknown) => {
    const queryText = typeof q === 'string' ? q : query;
    if (!queryText.trim()) return;
    setLoading(true);
    setError(null);
    setElapsedMs(null);
    const startedAt = performance.now();
    try {
      const res = await onPreview(queryText);
      setResult(res);
      setElapsedMs(Math.round(performance.now() - startedAt));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
      setElapsedMs(Math.round(performance.now() - startedAt));
    } finally {
      setLoading(false);
    }
  }, [query, onPreview]);

  useEffect(() => {
    if (pendingQuery?.query) {
      setQuery(pendingQuery.query);
      if (pendingQuery.autoRun) {
        handlePreview(pendingQuery.query);
      }
    }
  }, [pendingQuery]);

  return { query, setQuery, loading, result, error, elapsedMs, handlePreview };
}
