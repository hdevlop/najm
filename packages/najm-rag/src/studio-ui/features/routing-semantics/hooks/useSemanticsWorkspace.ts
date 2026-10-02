import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { RowSelectionState } from '@tanstack/react-table';
import { useApiClient } from '@/lib/api';
import type {
  SemanticPhraseResponse, SemanticsExportPayload, SemanticsImportResult,
  PaginatedSemanticsResponse, SemanticGroupsResponse, ImportJobState, IndexSettings,
} from '@/features/routing-semantics/types';

const DEFAULT_PAGE_SIZE = 50;

export const SEMANTICS_ROOT_KEY = ['rag-studio', 'semantics'] as const;
const phrasesKey = (filters: PhraseFilters, page: { limit: number; offset: number }) =>
  ['rag-studio', 'semantics', 'phrases', filters, page] as const;
const langGroupsKey = (filters: Pick<PhraseFilters, 'toolGroup' | 'toolName'>) =>
  ['rag-studio', 'semantics', 'lang-groups', filters] as const;
const INDEX_SETTINGS_KEY = ['rag-studio', 'semantics', 'index-settings'] as const;

interface PhraseFilters {
  toolGroup: string;
  toolName: string;
  lang: string;
  search: string;
}

function buildSemanticsUrl(filters: PhraseFilters, limit: number, offset: number) {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  if (filters.toolGroup) params.set('toolGroup', filters.toolGroup);
  if (filters.toolName) params.set('toolName', filters.toolName);
  if (filters.lang) params.set('lang', filters.lang);
  if (filters.search) params.set('search', filters.search);
  return `/semantics?${params.toString()}`;
}

export function useSemanticsWorkspace() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  const [toolGroupFilter, setToolGroupFilter] = useState('');
  const [toolFilter, setToolFilter] = useState('');
  const [langFilter, setLangFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pagination, setPagination] = useState<{ pageIndex: number; pageSize: number }>({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [searchQuery]);

  const filters: PhraseFilters = useMemo(() => ({
    toolGroup: toolGroupFilter,
    toolName: toolFilter,
    lang: langFilter,
    search: debouncedSearch,
  }), [toolGroupFilter, toolFilter, langFilter, debouncedSearch]);

  // Reset to page 0 whenever filters change (filters are server-side).
  const filtersSig = `${filters.toolGroup}|${filters.toolName}|${filters.lang}|${filters.search}`;
  useEffect(() => {
    setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
  }, [filtersSig]);

  const limit = pagination.pageSize;
  const offset = pagination.pageIndex * pagination.pageSize;

  const phrasesQuery = useQuery<PaginatedSemanticsResponse>({
    queryKey: phrasesKey(filters, { limit, offset }),
    queryFn: () => apiClient.get<PaginatedSemanticsResponse>(buildSemanticsUrl(filters, limit, offset)),
    placeholderData: (previous) => previous,
  });

  const langGroupsQuery = useQuery({
    queryKey: langGroupsKey({ toolGroup: filters.toolGroup, toolName: filters.toolName }),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.toolGroup) params.set('toolGroup', filters.toolGroup);
      if (filters.toolName) params.set('toolName', filters.toolName);
      const data = await apiClient.get<SemanticGroupsResponse>(`/semantics/groups?${params.toString()}`);
      return data.groups ?? [];
    },
  });

  const indexSettingsQuery = useQuery({
    queryKey: INDEX_SETTINGS_KEY,
    queryFn: () => apiClient.get<IndexSettings>('/settings/index'),
  });

  const phrases = useMemo<SemanticPhraseResponse[]>(() => phrasesQuery.data?.items ?? [], [phrasesQuery.data]);
  const totalPhrases = phrasesQuery.data?.total ?? 0;
  const pageCount = pagination.pageSize > 0 ? Math.ceil(totalPhrases / pagination.pageSize) : 0;

  const invalidateSemantics = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: SEMANTICS_ROOT_KEY });
  }, [queryClient]);

  const refreshPhrases = invalidateSemantics;

  const handleSavePhrase = async (phrase: Partial<SemanticPhraseResponse>): Promise<SemanticPhraseResponse | null> => {
    try {
      const result = phrase.id
        ? await apiClient.patch<SemanticPhraseResponse>(`/semantics/${phrase.id}`, phrase)
        : await apiClient.post<SemanticPhraseResponse>('/semantics', phrase);
      await invalidateSemantics();
      return result;
    } catch (err) {
      console.error('Failed to save phrase:', err);
      throw err;
    }
  };

  const handleReindexSemantics = async () => {
    try {
      await apiClient.post('/semantics/reindex');
      await invalidateSemantics();
    } catch (err) {
      console.error('Failed to reindex semantics:', err);
      throw err;
    }
  };

  const handleExportSemantics = async () =>
    apiClient.get<SemanticsExportPayload>('/semantics/export');

  const handleImportSemantics = async (payload: SemanticsExportPayload) => {
    const result = await apiClient.post<SemanticsImportResult>('/semantics/import', payload);
    await invalidateSemantics();
    return result;
  };

  const handleImportFiles = async (files: File[]) => {
    const formData = new FormData();
    for (const file of files) formData.append('files', file);
    return apiClient.postForm<ImportJobState>('/semantics/import-jobs', formData);
  };

  const pollImportJob = async (jobId: string) =>
    apiClient.get<ImportJobState>(`/semantics/import-jobs/${jobId}`);

  const handleDeletePhrase = async (id: string) => {
    try {
      await apiClient.delete(`/semantics/${id}`);
      await invalidateSemantics();
    } catch (err) {
      console.error('Failed to delete phrase:', err);
    }
  };

  const handleDeleteSemanticsBatch = async (ids: string[]) => {
    const result = await apiClient.post<{ deleted: number }>('/semantics/delete-batch', { ids });
    await invalidateSemantics();
    return result;
  };

  const handleClearAllSemantics = async () => {
    const result = await apiClient.delete<{ deleted: number }>('/semantics');
    setToolFilter('');
    setLangFilter('');
    setSearchQuery('');
    setDebouncedSearch('');
    setRowSelection({});
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    await invalidateSemantics();
    return result;
  };

  return {
    phrases,
    loading: phrasesQuery.isLoading,
    toolGroupFilter,
    toolFilter,
    langFilter,
    searchQuery,
    langGroups: langGroupsQuery.data ?? [],
    totalPhrases,
    allowedLangs: indexSettingsQuery.data?.allowedLangs,
    pagination,
    setPagination,
    pageCount,
    rowCount: totalPhrases,
    rowSelection,
    setRowSelection,
    setToolGroupFilter,
    setToolFilter,
    setLangFilter,
    setSearchQuery,
    refreshPhrases,
    loadLangGroups: () => queryClient.invalidateQueries({ queryKey: ['rag-studio', 'semantics', 'lang-groups'] }),
    handleSavePhrase,
    handleReindexSemantics,
    handleExportSemantics,
    handleImportSemantics,
    handleImportFiles,
    pollImportJob,
    handleDeletePhrase,
    handleDeleteSemanticsBatch,
    handleClearAllSemantics,
  };
}
