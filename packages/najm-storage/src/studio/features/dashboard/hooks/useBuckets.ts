import useSWR from 'swr';
import { useApiClient } from '../../../lib/api';
import type { NamespaceItem } from '../types';

export function useBuckets() {
  const api = useApiClient();
  return useSWR<NamespaceItem[]>('buckets', () => api.get<NamespaceItem[]>('/namespaces'), {
    refreshInterval: 30000,
  });
}
