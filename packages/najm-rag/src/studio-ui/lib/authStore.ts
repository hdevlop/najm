/**
 * Module-level Bearer token store for standalone mode.
 *
 * Lives outside React so the fetch layer's `getAuthHeaders()` always reads the
 * current token. Backed by localStorage, with an in-memory mirror for
 * SSR/first paint.
 */

const STORAGE_KEY = 'najm-rag-studio:token';

let memToken: string | null = null;
const listeners = new Set<() => void>();

function storageKey() {
  return STORAGE_KEY;
}

function readStorage(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(storageKey());
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  if (memToken !== null) return memToken;
  memToken = readStorage();
  return memToken;
}

export function setToken(token: string) {
  memToken = token;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(storageKey(), token);
    } catch {
      /* ignore */
    }
  }
  notify();
}

export function clearToken() {
  memToken = null;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(storageKey());
    } catch {
      /* ignore */
    }
  }
  notify();
}

/** Auth headers for the fetch layer — always reflects the current token. */
export function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  listeners.forEach((l) => l());
}
