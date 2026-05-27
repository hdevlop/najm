import { useMemo } from 'react';
import { useRagStudio } from './context';

export function useApiClient() {
  const { apiBase, getAuthHeaders } = useRagStudio();

  return useMemo(() => {
    async function handleResponse<T>(res: Response): Promise<T> {
    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      let message = res.statusText || `HTTP ${res.status}`;
      try {
        const parsed = JSON.parse(bodyText);
        if (parsed.message) message = parsed.message;
        else if (parsed.error) message = parsed.error;
      } catch {
        if (bodyText.trim()) {
          message = bodyText.trim().split('\n')[0].slice(0, 200);
        }
      }
      throw new Error(message);
    }
    return res.json();
  }

  return {
    async get<T>(path: string): Promise<T> {
      const res = await fetch(`${apiBase}${path}`, {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
      });
      return handleResponse<T>(res);
    },

    async post<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
      const res = await fetch(`${apiBase}${path}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal,
      });
      return handleResponse<T>(res);
    },

    async postForm<T>(path: string, body: FormData): Promise<T> {
      const headers = getAuthHeaders() as Record<string, string>;
      delete headers['Content-Type'];
      const res = await fetch(`${apiBase}${path}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers,
        body,
      });
      return handleResponse<T>(res);
    },

    async patch<T>(path: string, body: unknown): Promise<T> {
      const res = await fetch(`${apiBase}${path}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      return handleResponse<T>(res);
    },

    async delete<T>(path: string): Promise<T> {
      const res = await fetch(`${apiBase}${path}`, {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
      });
      return handleResponse<T>(res);
    },
  };
  }, [apiBase, getAuthHeaders]);
}

export type ApiClient = ReturnType<typeof useApiClient>;
