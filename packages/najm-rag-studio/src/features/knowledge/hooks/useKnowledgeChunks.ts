import { useState, useCallback } from 'react';
import { useApiClient } from '@/lib/api';
import type { DocumentChunkResponse } from '@/features/knowledge/types';

export function useKnowledgeChunks() {
  const apiClient = useApiClient();
  const [chunks, setChunks] = useState<DocumentChunkResponse[]>([]);
  const [loading, setLoading] = useState(false);

  const loadChunks = useCallback(async (docId: string) => {
    setLoading(true);
    try {
      const c = await apiClient.get<DocumentChunkResponse[]>(`/documents/${docId}/chunks`);
      setChunks(c);
    } catch (err) {
      console.error('Failed to load chunks:', err);
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  const loadAllChunks = useCallback(async () => {
    setLoading(true);
    try {
      const list = await apiClient.get<DocumentChunkResponse[]>('/chunks?limit=200&offset=0');
      setChunks(list);
    } catch (err) {
      console.error('Failed to load chunks:', err);
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  return { chunks, loading, loadChunks, loadAllChunks };
}
