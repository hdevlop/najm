import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { RowSelectionState } from '@tanstack/react-table';
import { useApiClient } from '@/lib/api';
import type { ImportJobState } from '@/features/routing-semantics/types';
import type { TestCase, TestResult } from '../types';

interface RoutingTestRow {
  id: string;
  name: string;
  query: string;
  lang: string;
  expectedTools: string[];
  lastStatus: 'pending' | 'pass' | 'fail' | 'low_confidence';
  lastConfidence: number | null;
  lastActualTools: string[] | null;
  lastMissingTools: string[] | null;
  lastScores: Array<{ toolName: string; similarity: number; matchLevel: string }> | null;
  lastRunAt: string | null;
}

interface PaginatedResponse {
  items: RoutingTestRow[];
  total: number;
  limit: number;
  offset: number;
}

interface ExportPayload {
  format: string;
  version: number;
  exportedCount: number;
  tests: Array<{ id: string; name: string; query: string; expectedTools: string[] }>;
}

const DEFAULT_PAGE_SIZE = 50;
export const ROUTING_TESTS_KEY = ['rag-studio', 'routing-tests'] as const;

function rowToTestCase(row: RoutingTestRow): TestCase {
  return { id: row.id, name: row.name, query: row.query, lang: row.lang ?? 'und', expectedTools: row.expectedTools };
}

function rowToResult(row: RoutingTestRow): TestResult | null {
  if (row.lastStatus === 'pending' || row.lastRunAt === null) return null;
  return {
    actualTools: row.lastActualTools ?? [],
    confidence: row.lastConfidence ?? 0,
    status: row.lastStatus,
    missingTools: row.lastMissingTools ?? [],
    scores: (row.lastScores ?? []).map((s) => ({
      toolName: s.toolName,
      similarity: s.similarity,
      matchLevel: (s.matchLevel as 'primary' | 'secondary' | 'below_threshold') ?? 'secondary',
    })),
  };
}

export function useRoutingTests(options: { initialPageSize?: number } = {}) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [importJob, setImportJob] = useState<ImportJobState | null>(null);
  const importPollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [pagination, setPagination] = useState<{ pageIndex: number; pageSize: number }>({
    pageIndex: 0,
    pageSize: options.initialPageSize ?? DEFAULT_PAGE_SIZE,
  });
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const limit = pagination.pageSize;
  const offset = pagination.pageIndex * pagination.pageSize;

  const query = useQuery<PaginatedResponse>({
    queryKey: [...ROUTING_TESTS_KEY, { limit, offset }] as const,
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      params.set('offset', String(offset));
      return apiClient.get<PaginatedResponse>(`/routing-tests?${params.toString()}`);
    },
    placeholderData: (previous) => previous,
  });

  const rows = useMemo<RoutingTestRow[]>(() => query.data?.items ?? [], [query.data]);
  const total = query.data?.total ?? 0;
  const pageCount = pagination.pageSize > 0 ? Math.ceil(total / pagination.pageSize) : 0;

  const invalidate = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: ROUTING_TESTS_KEY });
  }, [queryClient]);

  const refresh = invalidate;

  // Reset to first page when callers signal filter changes.
  const resetPagination = useCallback(() => {
    setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
  }, []);

  // Poll import job until completion
  useEffect(() => {
    if (!importJob) return;
    if (importJob.status === 'completed' || importJob.status === 'failed') {
      if (importPollTimerRef.current) {
        clearInterval(importPollTimerRef.current);
        importPollTimerRef.current = null;
      }
      if (importJob.status === 'completed') invalidate();
      return;
    }
    if (importPollTimerRef.current) return;
    importPollTimerRef.current = setInterval(async () => {
      try {
        const updated = await apiClient.get<ImportJobState>(`/routing-tests/import-jobs/${importJob.jobId}`);
        setImportJob(updated);
      } catch (err) {
        console.error('Failed to poll routing tests import job:', err);
      }
    }, 1500);
  }, [importJob, apiClient, invalidate]);

  useEffect(() => () => {
    if (importPollTimerRef.current) clearInterval(importPollTimerRef.current);
  }, []);

  const addTest = useCallback(async (data: { name: string; query: string; lang?: string; expectedTools: string[] }) => {
    const created = await apiClient.post<RoutingTestRow>('/routing-tests', data);
    await invalidate();
    return created;
  }, [apiClient, invalidate]);

  const updateTest = useCallback(async (id: string, data: { name?: string; query?: string; lang?: string; expectedTools?: string[] }) => {
    const updated = await apiClient.patch<RoutingTestRow>(`/routing-tests/${id}`, data);
    await invalidate();
    return updated;
  }, [apiClient, invalidate]);

  const deleteTest = useCallback(async (id: string) => {
    await apiClient.delete(`/routing-tests/${id}`);
    await invalidate();
  }, [apiClient, invalidate]);

  const deleteTestsBatch = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return { deleted: 0 };
    const result = await apiClient.post<{ deleted: number }>('/routing-tests/delete-batch', { ids });
    await invalidate();
    return result;
  }, [apiClient, invalidate]);

  const deleteAllTests = useCallback(async () => {
    const result = await apiClient.delete<{ deleted: number }>('/routing-tests');
    await invalidate();
    return result;
  }, [apiClient, invalidate]);

  const runOne = useCallback(async (id: string) => {
    setRunningId(id);
    try {
      const updated = await apiClient.post<RoutingTestRow>(`/routing-tests/${id}/run`);
      await invalidate();
      return updated;
    } finally {
      setRunningId(null);
    }
  }, [apiClient, invalidate]);

  const runAll = useCallback(async () => {
    setRunningAll(true);
    try {
      // Option A: run only the rows currently loaded (current page).
      const ids = rows.map((r) => r.id);
      for (const id of ids) {
        setRunningId(id);
        try {
          await apiClient.post<RoutingTestRow>(`/routing-tests/${id}/run`);
        } catch (err) {
          console.error(`Failed to run routing test ${id}:`, err);
        }
      }
      await invalidate();
    } finally {
      setRunningId(null);
      setRunningAll(false);
    }
  }, [apiClient, rows, invalidate]);

  const importFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return null;
    const formData = new FormData();
    for (const file of files) formData.append('files', file);
    const job = await apiClient.postForm<ImportJobState>('/routing-tests/import-jobs', formData);
    setImportJob(job);
    return job;
  }, [apiClient]);

  const dismissImportJob = useCallback(() => setImportJob(null), []);

  const exportToFile = useCallback(async () => {
    const payload = await apiClient.get<ExportPayload>('/routing-tests/export');
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'routing-tests.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [apiClient]);

  const tests = useMemo(() => rows.map(rowToTestCase), [rows]);
  const results = useMemo(() => {
    const map: Record<string, TestResult> = {};
    for (const row of rows) {
      const r = rowToResult(row);
      if (r) map[row.id] = r;
    }
    return map;
  }, [rows]);

  return {
    tests,
    results,
    total,
    loading: query.isLoading,
    runningId,
    runningAll,
    importJob,
    pagination,
    setPagination,
    pageCount,
    rowCount: total,
    rowSelection,
    setRowSelection,
    resetPagination,
    addTest,
    updateTest,
    deleteTest,
    deleteTestsBatch,
    deleteAllTests,
    runOne,
    runAll,
    importFiles,
    dismissImportJob,
    exportToFile,
    refresh,
  };
}
