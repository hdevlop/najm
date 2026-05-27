import { useMemo } from 'react';
import type { TestCase, TestResult } from '../types';

interface UseTestFiltersOptions {
  tests: TestCase[];
  results: Record<string, TestResult>;
  searchQuery: string;
  querySearch: string;
  toolFilter: string;
  statusFilter: string;
}

export function useTestFilters({
  tests,
  results,
  searchQuery,
  querySearch,
  toolFilter,
  statusFilter,
}: UseTestFiltersOptions) {
  const filteredTests = useMemo(() => {
    return tests.filter((test) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!test.name.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (querySearch) {
        const q = querySearch.toLowerCase();
        if (!test.query.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (toolFilter) {
        if (!test.expectedTools.some((t) => t.toLowerCase().includes(toolFilter.toLowerCase()))) {
          return false;
        }
      }
      if (statusFilter) {
        const result = results[test.id];
        if (statusFilter === 'pending' && result) return false;
        if (statusFilter === 'pass' && result?.status !== 'pass') return false;
        if (statusFilter === 'fail' && result?.status !== 'fail') return false;
        if (statusFilter === 'low_confidence' && result?.status !== 'low_confidence') return false;
      }
      return true;
    });
  }, [tests, results, searchQuery, querySearch, toolFilter, statusFilter]);

  return { filteredTests };
}
