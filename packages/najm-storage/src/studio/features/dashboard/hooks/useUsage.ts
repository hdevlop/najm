import useSWR from 'swr';
import { useApiClient } from '../../../lib/api';
import type { UsageSummary } from '../types';

export function useUsage() {
  const api = useApiClient();
  return useSWR<UsageSummary>('usage', () => api.get<UsageSummary>('/usage'), {
    refreshInterval: 60000,
  });
}
