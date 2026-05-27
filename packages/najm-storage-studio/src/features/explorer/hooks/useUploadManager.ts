import { useCallback, useMemo, useRef, useState } from 'react';
import type { NUploaderItem } from 'najm-ui';
import { useStudio } from '../../../providers';

let counter = 0;
const nextId = () => `up_${Date.now()}_${++counter}`;

export interface UploadManager {
  items: NUploaderItem[];
  addFiles: (files: File[]) => void;
  cancel: (id: string) => void;
  remove: (id: string) => void;
  clearCompleted: () => void;
  clear: () => void;
}

export function useUploadManager(
  bucket: string,
  prefix: string,
  refresh: () => void,
): UploadManager {
  const { apiBase, getAuthHeaders } = useStudio();
  const [items, setItems] = useState<NUploaderItem[]>([]);
  const xhrs = useRef<Map<string, XMLHttpRequest>>(new Map());

  const update = useCallback((id: string, patch: Partial<NUploaderItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const upload = useCallback((id: string, file: File) => {
    const target = `${prefix ?? ''}${file.name}`;
    const encoded = target.split('/').filter(Boolean).map(encodeURIComponent).join('/');
    const url = `${apiBase}/${bucket}/files/${encoded}`;

    const xhr = new XMLHttpRequest();
    xhrs.current.set(id, xhr);

    xhr.open('POST', url, true);
    xhr.withCredentials = true;
    const headers = getAuthHeaders();
    for (const [k, v] of Object.entries(headers)) {
      if (typeof v === 'string') xhr.setRequestHeader(k, v);
    }

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        update(id, { progress: (e.loaded / e.total) * 100 });
      }
    };

    xhr.onload = () => {
      xhrs.current.delete(id);
      if (xhr.status >= 200 && xhr.status < 300) {
        update(id, { status: 'done', progress: 100 });
        refresh();
      } else {
        update(id, { status: 'error', error: `Upload failed (${xhr.status})` });
      }
    };

    xhr.onerror = () => {
      xhrs.current.delete(id);
      update(id, { status: 'error', error: 'Network error' });
    };

    xhr.onabort = () => {
      xhrs.current.delete(id);
    };

    xhr.send(file);
  }, [apiBase, bucket, getAuthHeaders, prefix, refresh, update]);

  const addFiles = useCallback((files: File[]) => {
    const newItems: NUploaderItem[] = files.map((f) => ({
      id: nextId(),
      name: f.name,
      size: f.size,
      mimeType: f.type,
      progress: 0,
      status: 'uploading',
    }));
    setItems((prev) => [...prev, ...newItems]);
    newItems.forEach((it, i) => upload(it.id, files[i]));
  }, [upload]);

  const cancel = useCallback((id: string) => {
    xhrs.current.get(id)?.abort();
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setItems((prev) => prev.filter((it) => it.status !== 'done'));
  }, []);

  const clear = useCallback(() => {
    setItems([]);
  }, []);

  return useMemo(
    () => ({ items, addFiles, cancel, remove, clearCompleted, clear }),
    [items, addFiles, cancel, remove, clearCompleted, clear],
  );
}
