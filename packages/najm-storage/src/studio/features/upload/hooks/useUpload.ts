import { useState, useCallback, useRef } from 'react';
import { useStorageApi } from '../../../providers';
import type { UploadTask } from '../types';

export { type UploadTask } from '../types';

const MAX_CONCURRENT = 3;

export function useUpload(namespace: string) {
  const { apiBase, getAuthHeaders } = useStorageApi();
  const [queue, setQueue] = useState<UploadTask[]>([]);
  const activeCount = useRef(0);
  const abortRefs = useRef<Map<string, XMLHttpRequest>>(new Map());

  const updateTask = useCallback((id: string, patch: Partial<UploadTask>) => {
    setQueue((q) => q.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const uploadOne = useCallback(async (task: UploadTask, ns: string) => {
    const url = `${apiBase}/${ns}/files/${task.file.name}`;
    const xhr = new XMLHttpRequest();

    abortRefs.current.set(task.id, xhr);
    updateTask(task.id, { status: 'uploading' });

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        updateTask(task.id, { progress: Math.round((e.loaded / e.total) * 100) });
      }
    });

    return new Promise<void>((resolve, reject) => {
      xhr.addEventListener('load', () => {
        abortRefs.current.delete(task.id);
        if (xhr.status >= 200 && xhr.status < 300) {
          updateTask(task.id, { status: 'done', progress: 100 });
          resolve();
        } else {
          updateTask(task.id, { status: 'error', error: `HTTP ${xhr.status}` });
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      });
      xhr.addEventListener('error', () => {
        abortRefs.current.delete(task.id);
        updateTask(task.id, { status: 'error', error: 'Network error' });
        reject(new Error('Network error'));
      });
      xhr.addEventListener('abort', () => {
        abortRefs.current.delete(task.id);
        updateTask(task.id, { status: 'error', error: 'Cancelled' });
        reject(new Error('Cancelled'));
      });

      xhr.open('POST', url);
      const headers = getAuthHeaders();
      for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
      xhr.send(task.file);
    });
  }, [apiBase, getAuthHeaders, updateTask]);

  const drainQueue = useCallback((ns: string) => {
    setQueue((currentQueue) => {
      // Fill all available slots in one synchronous pass.
      // State must change (new array with updated items) for React to re-render.
      const updating = new Set<string>();
      let changed = false;
      const next = currentQueue.map((t) => {
        if (t.status === 'queued' && activeCount.current < MAX_CONCURRENT) {
          updating.add(t.id);
          activeCount.current++;
          changed = true;
          return { ...t, status: 'uploading' as const };
        }
        return t;
      });
      if (!changed) return currentQueue;

      // Capture IDs before the setTimeout fires (possibly cleared by another drainQueue call).
      const starting = [...updating];
      setTimeout(() => {
        for (const id of starting) {
          const task = next.find((t) => t.id === id);
          if (!task || task.status !== 'uploading') continue;
          uploadOne(task, ns).catch(() => {/* error already set */}).finally(() => {
            activeCount.current--;
            drainQueue(ns);
          });
        }
      }, 0);

      return next;
    });
  }, [uploadOne]);

  const addFiles = useCallback((files: FileList | null, ns: string) => {
    if (!files?.length) return;
    const newTasks: UploadTask[] = Array.from(files).map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file: f,
      progress: 0,
      status: 'queued' as const,
    }));
    setQueue((q) => [...q, ...newTasks]);
    // drainQueue captures ns at call-time via the ns parameter, not closure
    setTimeout(() => drainQueue(ns), 0);
  }, [drainQueue]);

  const removeTask = useCallback((id: string) => {
    const xhr = abortRefs.current.get(id);
    if (xhr) xhr.abort();
    setQueue((q) => q.filter((t) => t.id !== id));
  }, []);

  const clearDone = useCallback(() => {
    setQueue((q) => q.filter((t) => t.status !== 'done'));
  }, []);

  return { queue, addFiles, removeTask, clearDone };
}
