// ============================================================================
// FetchClient — Tiny fetch wrapper with auth interceptors
// ============================================================================
// No axios. Native fetch only. Works in browser, edge, Bun, Node 18+.

import { AuthError, type RequestOptions, type RetryConfig } from './types';

export interface FetchClientConfig {
  baseURL: string;
  credentials?: RequestCredentials;
  timeout?: number;
  getToken?: () => string | null;
  onUnauthorized?: () => Promise<string | null>;
  retry?: RetryConfig;
  defaultHeaders?: Record<string, string>;
}

function getBackoffDelay(attempt: number, config?: RetryConfig): number {
  const base = config?.baseDelay ?? 500;
  if (config?.backoff === 'linear') return base * attempt;
  return base * Math.pow(2, attempt - 1); // exponential default
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class FetchClient {
  private authenticatedRequests = new Set<AbortController>();
  private authenticatedRequestsBlocked = false;

  constructor(private config: FetchClientConfig) {}

  /** Abort requests carrying the current session before logout invalidates it. */
  abortAuthenticatedRequests(): void {
    for (const controller of this.authenticatedRequests) {
      controller.abort();
    }
    this.authenticatedRequests.clear();
  }

  /** Block new authenticated traffic and abort anything already in flight. */
  blockAuthenticatedRequests(): void {
    this.authenticatedRequestsBlocked = true;
    this.abortAuthenticatedRequests();
  }

  /** Reopen authenticated traffic after login or authoritative hydration. */
  allowAuthenticatedRequests(): void {
    this.authenticatedRequestsBlocked = false;
  }

  async get<T>(path: string, opts?: RequestOptions): Promise<T> {
    return this.request<T>('GET', path, opts);
  }

  async post<T>(path: string, opts?: RequestOptions): Promise<T> {
    return this.request<T>('POST', path, opts);
  }

  async put<T>(path: string, opts?: RequestOptions): Promise<T> {
    return this.request<T>('PUT', path, opts);
  }

  async patch<T>(path: string, opts?: RequestOptions): Promise<T> {
    return this.request<T>('PATCH', path, opts);
  }

  async delete<T>(path: string, opts?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', path, opts);
  }

  private async request<T>(method: string, path: string, opts?: RequestOptions): Promise<T> {
    return this.execute<T>(method, path, opts, 0);
  }

  private async execute<T>(
    method: string,
    path: string,
    opts: RequestOptions | undefined,
    attempt: number,
  ): Promise<T> {
    const maxRetries = this.config.retry?.maxRetries ?? 0;

    try {
      const res = await this.doFetch(method, path, opts);
      const body = await this.parseBody(res);

      if (!res.ok) {
        // 401 — try refresh (once, only for authenticated requests)
        if (res.status === 401 && !opts?._retried && !opts?.skipAuth && this.config.onUnauthorized) {
          const newToken = await this.config.onUnauthorized();
          if (newToken) {
            return this.execute<T>(method, path, { ...opts, _retried: true }, 0);
          }
        }

        // 5xx — retry with backoff
        if (res.status >= 500 && attempt < maxRetries) {
          await sleep(getBackoffDelay(attempt + 1, this.config.retry));
          return this.execute<T>(method, path, opts, attempt + 1);
        }

        const msg = (body as any)?.message ?? res.statusText;
        throw new AuthError(res.status, msg, body);
      }

      return body as T;
    } catch (err) {
      if (err instanceof AuthError) throw err;

      // Network error — retry with backoff
      if (attempt < maxRetries) {
        await sleep(getBackoffDelay(attempt + 1, this.config.retry));
        return this.execute<T>(method, path, opts, attempt + 1);
      }

      throw err;
    }
  }

  private async doFetch(method: string, path: string, opts?: RequestOptions): Promise<Response> {
    if (!opts?.skipAuth && this.authenticatedRequestsBlocked) {
      throw new Error('Authenticated requests unavailable after logout');
    }

    const url = `${this.config.baseURL}${path}`;
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      ...this.config.defaultHeaders,
      ...opts?.headers,
    };

    // Attach Bearer token
    if (!opts?.skipAuth) {
      const token = this.config.getToken?.();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    // JSON body
    let body: BodyInit | undefined;
    if (opts?.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(opts.body);
    }

    // Timeout
    const controller = new AbortController();
    const forwardedSignals: AbortSignal[] = [];
    if (opts?.signal) forwardedSignals.push(opts.signal);
    const timeout = opts?.timeout ?? this.config.timeout;
    if (timeout && typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
      forwardedSignals.push(AbortSignal.timeout(timeout));
    }

    const abort = () => controller.abort();
    for (const signal of forwardedSignals) {
      if (signal.aborted) abort();
      else signal.addEventListener('abort', abort, { once: true });
    }

    if (!opts?.skipAuth) {
      this.authenticatedRequests.add(controller);
    }

    try {
      return await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
        credentials: this.config.credentials ?? 'include',
      });
    } finally {
      this.authenticatedRequests.delete(controller);
      for (const signal of forwardedSignals) {
        signal.removeEventListener('abort', abort);
      }
    }
  }

  private async parseBody(res: Response): Promise<unknown> {
    const ct = res.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) {
      return res.json();
    }
    const text = await res.text();
    try { return JSON.parse(text); } catch { return text; }
  }
}
