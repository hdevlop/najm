/**
 * Module-level Bearer token store for standalone mode.
 *
 * Lives outside React so the fetch layer's `getAuthHeaders()` always reads the
 * current token, and so tokens can be scoped per target app (Phase 3 connections).
 * Backed by localStorage, with an in-memory mirror for SSR/first paint.
 */

const KEY_PREFIX = 'najm-rag-studio:token:';

let currentScope = 'default';
let memToken: string | null = null;
const listeners = new Set<() => void>();

function storageKey() {
  return KEY_PREFIX + currentScope;
}

function readStorage(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(storageKey());
  } catch {
    return null;
  }
}

/** Scope tokens to a target (e.g. an app's API base). Switches the active token. */
export function setTokenScope(scope: string) {
  const next = scope || 'default';
  if (next === currentScope) return;
  currentScope = next;
  memToken = readStorage();
  notify();
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
