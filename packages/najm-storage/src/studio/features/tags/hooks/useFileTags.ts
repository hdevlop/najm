import { useCallback } from 'react';
import useSWR from 'swr';
import { useTagApi, type TagInfo } from '../api';

export function useFileTags(namespace: string, filePath: string | null) {
  const api = useTagApi();
  const key = filePath ? `fileTags:${namespace}:${filePath}` : null;

  const { data, mutate, isLoading } = useSWR<TagInfo[]>(key, () =>
    api.getFileTags(namespace, filePath!),
  );

  const setTags = useCallback(async (tags: string[]) => {
    const result = await api.setFileTags(namespace, filePath!, tags);
    await mutate();
    return result;
  }, [api, namespace, filePath, mutate]);

  return { tags: data ?? [], setTags, isLoading };
}
