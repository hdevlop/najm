import { describe, expect, test } from 'bun:test';
import { BOOTSTRAP_KEY, isShellPath, readBootstrap, routeForPath, withPreferenceChoices, type ShellBootstrap } from './support/app';
import { SHELL_PATHS } from './support/app';
import { pruneActiveShellCaches, pruneUnpinnedCaches } from './support/app';

describe('public offline shell boundaries', () => {
  test('worker document patterns and local routes have the same descendants', () => {
    for (const pattern of SHELL_PATHS) {
      if (pattern.endsWith('/*')) expect(isShellPath(pattern.slice(0, -1) + 'record')).toBe(true);
      else expect(isShellPath(pattern)).toBe(true);
    }
    expect(isShellPath('/classes/abc')).toBe(false);
    expect(isShellPath('/students/abc')).toBe(true);
  });
  test('cache reclamation keeps pinned builds and two unused generations', async () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'caches');
    const deleted: string[] = [];
    const prefix = 'najm-pwa:app-shell:';
    Object.defineProperty(globalThis, 'caches', { configurable: true, value: { keys: async () => ['rollback-target', 'old-active', 'unused-1', 'unused-2', 'unused-3', 'current'].map(value => prefix + value), delete: async (key: string) => { deleted.push(key); return true; } } });
    try {
      const storage = { length: 1, key: () => 'app.shell.pin:old-tab', getItem: () => 'old-active' } as unknown as Storage;
      await pruneUnpinnedCaches(storage, 'current', 'rollback-target');
      expect(deleted).toEqual([prefix + 'unused-1']);
    } finally { if (previous) Object.defineProperty(globalThis, 'caches', previous); else Reflect.deleteProperty(globalThis, 'caches'); }
  });
  test('startup cleanup requires the active generation and pauses for waiting/installing workers', async () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'caches');
    const deleted: string[] = [];
    const prefix = 'najm-pwa:app-shell:';
    Object.defineProperty(globalThis, 'caches', { configurable: true, value: { keys: async () => ['old', 'keep-1', 'keep-2', 'current'].map(v => prefix + v), delete: async (key: string) => { deleted.push(key); return true; } } });
    try {
      const worker = { state: 'activated', postMessage(_data: unknown, ports: MessagePort[]) {
        ports[0].postMessage({ protocol: 1, cacheId: 'app-shell', cacheVersion: 'current', ready: true });
      } } as unknown as ServiceWorker;
      const registration = { scope: 'https://app.test/', active: worker, waiting: null, installing: null } as unknown as ServiceWorkerRegistration;
      const container = { controller: worker, getRegistration: async () => registration };
      const storage = { length: 0 } as Storage;
      expect(await pruneActiveShellCaches(storage, 'older-running-tab', registration.scope, container)).toBe(false);
      Object.defineProperty(registration, 'waiting', { configurable: true, value: worker });
      expect(await pruneActiveShellCaches(storage, 'current', registration.scope, container)).toBe(false);
      Object.defineProperty(registration, 'waiting', { configurable: true, value: null });
      Object.defineProperty(registration, 'installing', { configurable: true, value: worker });
      expect(await pruneActiveShellCaches(storage, 'current', registration.scope, container)).toBe(false);
      expect(deleted).toEqual([]);
      Object.defineProperty(registration, 'installing', { configurable: true, value: null });
      expect(await pruneActiveShellCaches(storage, 'current', registration.scope, container)).toBe(true);
      expect(deleted).toEqual([prefix + 'old']);
    } finally { if (previous) Object.defineProperty(globalThis, 'caches', previous); else Reflect.deleteProperty(globalThis, 'caches'); }
  });
  test('cache reclamation rechecks a newly created version pin before deleting', async () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'caches');
    const deleted: string[] = [];
    const prefix = 'najm-pwa:app-shell:';
    let newlyPinned = false;
    Object.defineProperty(globalThis, 'caches', { configurable: true, value: { keys: async () => ['old', 'keep-1', 'keep-2'].map(v => prefix + v), delete: async (key: string) => { deleted.push(key); return true; } } });
    try {
      const storage = { get length() { return newlyPinned ? 1 : 0; }, key: () => 'app.shell.pin:new-tab', getItem: () => 'old' } as unknown as Storage;
      await pruneUnpinnedCaches(storage, 'current', undefined, () => { newlyPinned = true; return true; });
      expect(deleted).toEqual([]);
    } finally { if (previous) Object.defineProperty(globalThis, 'caches', previous); else Reflect.deleteProperty(globalThis, 'caches'); }
  });
  test('a pin whose tab no longer holds its lock is reclaimed; a held or unreadable lock keeps it', async () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'caches');
    const prefix = 'najm-pwa:app-shell:';
    const run = async (locks: Pick<LockManager, 'query' | 'request'>) => {
      const deleted: string[] = [];
      const entries = new Map([['app.shell.pin:suspended', 'suspended'], ['app.shell.pin:crashed', 'crashed']]);
      const storage = {
        get length() { return entries.size; },
        key: (index: number) => [...entries.keys()][index] ?? null,
        getItem: (key: string) => entries.get(key) ?? null,
        removeItem: (key: string) => { entries.delete(key); },
      } as unknown as Storage;
      Object.defineProperty(globalThis, 'caches', { configurable: true, value: { keys: async () => ['suspended', 'crashed', 'unused-1', 'unused-2', 'current'].map(value => prefix + value), delete: async (key: string) => { deleted.push(key); return true; } } });
      await pruneUnpinnedCaches(storage, 'current', undefined, () => true, locks);
      return { deleted, pins: [...entries.keys()] };
    };
    const lockState = (held: string[]) => ({ query: async () => ({ held: held.map(name => ({ name, mode: 'exclusive' as const })), pending: [] }), request: async () => undefined }) as unknown as Pick<LockManager, 'query' | 'request'>;
    try {
      // A suspended tab still holds its lock; a crashed one does not.
      expect(await run(lockState(['app.shell.pin:suspended']))).toEqual({ deleted: [prefix + 'crashed'], pins: ['app.shell.pin:suspended'] });
      // Unreadable lock state must not be mistaken for "no tab is open".
      const unreadable = { query: async () => { throw new Error('SecurityError'); }, request: async () => undefined } as unknown as Pick<LockManager, 'query' | 'request'>;
      expect(await run(unreadable)).toEqual({ deleted: [], pins: ['app.shell.pin:suspended', 'app.shell.pin:crashed'] });
    } finally { if (previous) Object.defineProperty(globalThis, 'caches', previous); else Reflect.deleteProperty(globalThis, 'caches'); }
  });
  test('excludes auth, API, external and framework requests', () => {
    for (const path of ['/login', '/api/students', '/_next/static/a.js', '//example.com/students', '/students?x=1']) expect(isShellPath(path)).toBe(false);
    expect(isShellPath('/students/123')).toBe(true);
    expect(routeForPath([{ href: '/students', label: 'Students' }], '/students/123')?.href).toBe('/students');
    expect(routeForPath([{ href: '/students', label: 'Students' }], '/students-private')).toBeUndefined();
  });
  test('expired, malformed and excessive grants fail closed', () => {
    const base = { version: 1, accountId: 'a', expiresAt: 2000, routes: [{ href: '/students', label: 'Students' }], ui: { preferences: {} } };
    const read = (value: unknown) => readBootstrap({ getItem: key => key === BOOTSTRAP_KEY ? JSON.stringify(value) : null }, 1000);
    expect(read(base)?.accountId).toBe('a');
    expect(read({ ...base, expiresAt: 1000 })).toBeNull();
    expect(read({ ...base, expiresAt: 1e12 })).toBeNull();
    expect(read({ ...base, routes: [{ href: '/api/auth', label: 'Auth' }] })).toBeNull();
    // The role only selects the sidebar layout; anything but text is rejected.
    expect(read({ ...base, role: 'parent' })?.role).toBe('parent');
    expect(read({ ...base, role: 7 })).toBeNull();
    expect(readBootstrap({ getItem: () => '{' })).toBeNull();
  });
});

test('a preference chosen in the shell overrides an older stored record, keeping its other values', () => {
  const stored = { version: 1, accountId: 'account', expiresAt: 1, routes: [], ui: { app: { appName: 'MyScolAI' },
    preferences: { language: 'fr', theme: 'light', timeZone: 'Africa/Casablanca' }, appearance: { designConfig: {} }, branding: {} } } as unknown as ShellBootstrap;
  const chosen = withPreferenceChoices(stored, { language: 'ar' });
  expect(chosen.ui.preferences).toEqual({ language: 'ar', theme: 'light', timeZone: 'Africa/Casablanca' });
  expect(stored.ui.preferences.language).toBe('fr');
  expect(withPreferenceChoices(stored, {})).toBe(stored);
  expect(withPreferenceChoices(null, { language: 'ar' })).toBeNull();
});
