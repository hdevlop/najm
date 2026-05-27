import useSWR from 'swr';
import { useApiClient } from '../../../lib/api';
import type { ListResult } from '../types';

export function useObjects(namespace: string | null, prefix = '') {
  const api = useApiClient();
  const key = namespace ? `objects:${namespace}:${prefix}` : null;

  return useSWR<ListResult>(key, () => {
    const qs = new URLSearchParams();
    if (prefix) qs.set('prefix', prefix);
    qs.set('delimiter', '/');
    return api.get<ListResult>(`/${namespace}/files?${qs}`);
  }, {
    keepPreviousData: true,
    revalidateIfStale: true,
    revalidateOnFocus: false,
  });
}
