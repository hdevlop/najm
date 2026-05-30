import useSWR from 'swr';
import { useApiClient } from '../../../lib/api';
import type { FileInfo } from '../types';

export function useTrash() {
  const api = useApiClient();
  return useSWR<FileInfo[]>('trash', () => api.get<FileInfo[]>('/trash'), {
    refreshInterval: 30000,
  });
}
