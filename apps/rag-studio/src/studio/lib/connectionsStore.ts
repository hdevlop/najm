/**
 * Connections store for the standalone studio shell.
 *
 * A connection is a target app, identified by its najm API root URL. The studio
 * derives `${apiBaseUrl}/rag-studio` and `${apiBaseUrl}/auth` from it. Persisted
 * in localStorage so the operator's list of apps survives reloads.
 */

export interface StudioConnection {
  id: string;
  name: string;
  /** The target app's najm API root, e.g. "https://crm.example.com/api". */
  apiBaseUrl: string;
}

const LIST_KEY = 'najm-rag-studio:connections';
const ACTIVE_KEY = 'najm-rag-studio:active';

const listeners = new Set<() => void>();

// Cached snapshots so useSyncExternalStore's getSnapshot returns stable references
// (returning a fresh array/value each call triggers React's infinite-loop guard).
let cachedList: StudioConnection[] | null = null;
let cachedActive: string | null | undefined = undefined;

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {
    /* ignore */
  }
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Normalize a user-entered URL to a clean API root (no trailing slash). */
export function normalizeApiBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function setList(next: StudioConnection[]) {
  cachedList = next;
  write(LIST_KEY, next);
  notify();
}

export function listConnections(): StudioConnection[] {
  if (cachedList === null) cachedList = read<StudioConnection[]>(LIST_KEY, []);
  return cachedList;
}

export function getActiveId(): string | null {
  if (cachedActive === undefined) cachedActive = read<string | null>(ACTIVE_KEY, null);
  return cachedActive;
}

export function setActiveId(id: string | null) {
  cachedActive = id;
  write(ACTIVE_KEY, id);
  notify();
}

export function addConnection(input: { name: string; apiBaseUrl: string }): StudioConnection {
  const conn: StudioConnection = {
    id: newId(),
    name: input.name.trim() || input.apiBaseUrl,
    apiBaseUrl: normalizeApiBaseUrl(input.apiBaseUrl),
  };
  setList([...listConnections(), conn]);
  return conn;
}

export function updateConnection(id: string, patch: Partial<Omit<StudioConnection, 'id'>>) {
  setList(
    listConnections().map((c) =>
      c.id === id
        ? {
            ...c,
            ...patch,
            apiBaseUrl: patch.apiBaseUrl ? normalizeApiBaseUrl(patch.apiBaseUrl) : c.apiBaseUrl,
          }
        : c,
    ),
  );
}

export function removeConnection(id: string) {
  setList(listConnections().filter((c) => c.id !== id));
  if (getActiveId() === id) setActiveId(null);
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  listeners.forEach((l) => l());
}
