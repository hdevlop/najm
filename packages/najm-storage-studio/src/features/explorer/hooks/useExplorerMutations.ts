import { useCallback } from 'react';
import { toast } from 'sonner';
import { useApiClient } from '../../../lib/api';
import { useStudio } from '../../../providers';

/**
 * Pure API wrappers for one bucket. No UI state — each function calls the
 * backend and optionally triggers `refresh()` to re-fetch the listing.
 */
export function useExplorerMutations(bucket: string, refresh: () => void) {
  const api = useApiClient();
  const { apiBase, getAuthHeaders } = useStudio();

  const createFolder = useCallback(async (path: string) => {
    await api.post(`/${bucket}/folders`, { path });
    refresh();
  }, [api, bucket, refresh]);

  const move = useCallback(async (from: string, to: string) => {
    if (from === to) return;
    await api.post(`/${bucket}/files/move`, { from, to });
  }, [api, bucket]);

  const copy = useCallback(async (from: string, to: string) => {
    if (from === to) return;
    await api.post(`/${bucket}/files/copy`, { from, to });
  }, [api, bucket]);

  const deleteMany = useCallback(async (paths: string[]) => {
    await api.post(`/${bucket}/files/batch-delete`, { paths });
    refresh();
  }, [api, bucket, refresh]);

  const uploadFiles = useCallback(async (files: FileList | null, prefix: string) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      const target = `${prefix ?? ''}${file.name}`;
      const res = await fetch(`${apiBase}/${bucket}/files/${target.split('/').map(encodeURIComponent).join('/')}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { ...getAuthHeaders() },
        body: file,
      });
      if (!res.ok) toast.error(`Upload failed: ${file.name}`);
    }
    refresh();
  }, [apiBase, bucket, getAuthHeaders, refresh]);

  const presign = useCallback(async (path: string): Promise<string> => {
    const { url } = await api.post<{ url: string }>(`/${bucket}/files/presign`, { path, method: 'GET', ttlSeconds: 600 });
    return url;
  }, [api, bucket]);

  return { createFolder, move, copy, deleteMany, uploadFiles, presign, refresh };
}

export type ExplorerMutations = ReturnType<typeof useExplorerMutations>;
