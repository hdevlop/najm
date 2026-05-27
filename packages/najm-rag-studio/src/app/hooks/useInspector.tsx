import { useState, useCallback } from 'react';
import { useApiClient } from '@/lib/api';

interface ChunkData {
  id: string;
  text: string;
  ordinal: number;
  page: number | null;
  tokens: number;
}

export function useInspector() {
  const apiClient = useApiClient();
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorContent, setInspectorContent] = useState<{ title: string; content: React.ReactNode } | null>(null);

  const handleCitationClick = useCallback(async (chunkId: string, documentId: string) => {
    setInspectorContent({
      title: 'Chunk Details',
      content: (
        <div className="p-4">
          <p className="text-sm text-txt-muted">Loading chunk {chunkId}...</p>
        </div>
      ),
    });
    setInspectorOpen(true);
    try {
      const chunks = await apiClient.get<ChunkData[]>(`/documents/${documentId}/chunks`);
      const chunk = chunks.find((c) => c.id === chunkId);
      if (!chunk) throw new Error('Chunk not found');
      setInspectorContent({
        title: `Chunk ${chunk.ordinal + 1}`,
        content: (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-txt-muted">ID</span>
              <span className="text-sm font-mono text-txt-secondary">{chunk.id}</span>
            </div>
            {chunk.page !== null && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-txt-muted">Page</span>
                <span className="text-sm text-txt-secondary">{chunk.page + 1}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-txt-muted">Tokens</span>
              <span className="text-sm text-txt-secondary">{chunk.tokens}</span>
            </div>
            <div className="pt-2 border-t border-border">
              <p className="text-sm text-txt-secondary leading-relaxed whitespace-pre-wrap">{chunk.text}</p>
            </div>
          </div>
        ),
      });
    } catch (err) {
      setInspectorContent({
        title: 'Error',
        content: (
          <div className="p-4">
            <p className="text-sm text-status-red">{err instanceof Error ? err.message : 'Failed to load chunk'}</p>
          </div>
        ),
      });
    }
  }, [apiClient]);

  const closeInspector = useCallback(() => setInspectorOpen(false), []);

  return {
    inspectorOpen,
    inspectorContent,
    handleCitationClick,
    closeInspector,
  };
}
