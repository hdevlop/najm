import { useMemo } from 'react';
import { useApiClient } from '../../lib/api';
import type { ListResult } from '../explorer/types';

export interface TagInfo {
  id: string;
  namespace: string;
  name: string;
  color?: string | null;
  count?: number;
}

export interface Capabilities {
  tags: boolean;
  presign: boolean;
  trash: boolean;
  buckets: boolean;
}

export function useTagApi() {
  const api = useApiClient();

  return useMemo(() => ({
    listTags: (namespace: string) =>
      api.get<TagInfo[]>(`/${namespace}/tags`),

    createTag: (namespace: string, name: string, color?: string) =>
      api.post<TagInfo>(`/${namespace}/tags`, { name, color }),

    updateTag: (namespace: string, tagId: string, data: { name?: string; color?: string | null }) =>
      api.put<TagInfo>(`/${namespace}/tags/${encodeURIComponent(tagId)}`, data),

    deleteTag: (namespace: string, tagId: string) =>
      api.delete<{ success: boolean }>(`/${namespace}/tags/${encodeURIComponent(tagId)}`),

    getFileTags: (namespace: string, path: string) =>
      api.get<TagInfo[]>(`/${namespace}/files/tags?path=${encodeURIComponent(path)}`),

    setFileTags: (namespace: string, path: string, tags: string[]) =>
      api.put<TagInfo[]>(`/${namespace}/files/tags`, { path, tags }),

    patchFileTags: (namespace: string, paths: string[], add?: string[], remove?: string[]) =>
      api.patch<{ updated: string[]; failed: string[] }>(`/${namespace}/files/tags`, { paths, add, remove }),

    listFilesByTag: (namespace: string, tag: string) =>
      api.get<ListResult>(`/${namespace}/files-by-tag?tag=${encodeURIComponent(tag)}`),

    getCapabilities: () =>
      api.get<Capabilities>('/capabilities'),
  }), [api]);
}
