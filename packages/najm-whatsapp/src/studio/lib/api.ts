import { useStudio } from './context';
import type { ApiClient, StudioConfig } from '../providers/types';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly path: string,
    public readonly method: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiClientOptions {
  onUnauthorized?: () => void;
}

async function parseBody(res: Response): Promise<unknown> {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

export function createApiClient(
  config: StudioConfig,
  options: ApiClientOptions = {},
): ApiClient {
  const request = async (method: string, path: string, body?: any) => {
    const headers = await config.getAuthHeaders();
    const res = await fetch(`${config.apiBase}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const parsed = await parseBody(res);

    if (res.status === 401 || res.status === 403) {
      options.onUnauthorized?.();
      // Return a rejected promise so callers can catch, but include a clear signal
      const detail =
        parsed && typeof parsed === 'object' && 'message' in (parsed as any)
          ? String((parsed as any).message)
          : typeof parsed === 'string' && parsed
            ? parsed
            : 'Unauthorized';
      return Promise.reject(
        new ApiError(`${method} ${path} — ${detail}`, res.status, path, method, parsed),
      );
    }

    if (!res.ok) {
      const detail =
        parsed && typeof parsed === 'object' && 'message' in (parsed as any)
          ? String((parsed as any).message)
          : typeof parsed === 'string' && parsed
            ? parsed
            : res.statusText || `HTTP ${res.status}`;
      throw new ApiError(`${method} ${path} — ${detail}`, res.status, path, method, parsed);
    }

    return parsed;
  };

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    patch: (path, body) => request('PATCH', path, body),
    del: (path) => request('DELETE', path),
  };
}

export function useApiClient(): ApiClient {
  const { client } = useStudio();
  return client;
}
