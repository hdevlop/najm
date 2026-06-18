import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '@/lib/api';
import type { DocumentListItem } from '@/features/knowledge/types';

export const KNOWLEDGE_DOCUMENTS_KEY = ['rag-studio', 'knowledge', 'documents'] as const;

export function useKnowledgeDocuments(onError?: (message: string) => void) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [inspectingDoc, setInspectingDoc] = useState<DocumentListItem | null>(null);

  const reportError = (message: string, err: unknown) => {
    console.error(message, err);
    onError?.(message);
  };

  const query = useQuery({
    queryKey: KNOWLEDGE_DOCUMENTS_KEY,
    queryFn: async () => {
      try {
        return await apiClient.get<DocumentListItem[]>('/documents');
      } catch (err) {
        reportError('Failed to load documents.', err);
        throw err;
      }
    },
  });

  const documents = query.data ?? [];

  const invalidate = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: KNOWLEDGE_DOCUMENTS_KEY });
  }, [queryClient]);

  const handleUpload = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      await apiClient.postForm('/documents/import', formData);
      await invalidate();
    } catch (err) {
      reportError('Failed to upload document.', err);
    }
  }, [apiClient, invalidate]);

  const handleReindex = useCallback(async (id: string) => {
    try {
      await apiClient.post(`/documents/${id}/reindex`);
      await invalidate();
    } catch (err) {
      reportError('Failed to reindex document.', err);
    }
  }, [apiClient, invalidate]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await apiClient.delete(`/documents/${id}`);
      await invalidate();
    } catch (err) {
      reportError('Failed to delete document.', err);
    }
  }, [apiClient, invalidate]);

  const handleInspect = useCallback((id: string) => {
    const doc = documents.find((d) => d.id === id);
    if (doc) setInspectingDoc(doc);
  }, [documents]);

  return {
    documents,
    loading: query.isFetching,
    loaded: query.isSuccess || query.isError,
    uploadOpen,
    setUploadOpen,
    loadDocuments: invalidate,
    handleUpload,
    handleReindex,
    handleDelete,
    handleInspect,
    inspectingDoc,
    setInspectingDoc,
  };
}
