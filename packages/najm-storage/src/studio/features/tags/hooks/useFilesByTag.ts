import useSWR from 'swr';
import { useTagApi } from '../api';
import type { ListResult } from '../../explorer/types';

export function useFilesByTag(namespace: string | null, tag: string) {
  const api = useTagApi();
  const key = namespace && tag ? `filesByTag:${namespace}:${tag}` : null;

  return useSWR<ListResult>(key, () => api.listFilesByTag(namespace!, tag));
}
