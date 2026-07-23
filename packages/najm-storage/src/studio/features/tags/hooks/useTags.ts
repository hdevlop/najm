import useSWR from 'swr';
import { useTagApi, type TagInfo } from '../api';

export function useTags(namespace: string | null, enabled = true) {
  const api = useTagApi();
  const key = namespace && enabled ? `tags:${namespace}` : null;

  return useSWR<TagInfo[]>(key, () => api.listTags(namespace!));
}
