/** A page of the offline shell: where it is and what the sidebar calls it. */
export type ShellRoute = { href: string; label: string };
/**
 * Display metadata the offline shell starts from: who was signed in, which
 * pages they could open and how the app looked. Never an authenticated
 * session or record access grant. `ui` is the app's own snapshot.
 */
export type ShellBootstrap<Ui extends { preferences: { language: string } } = { preferences: { language: string } }> = {
  version: 1;
  accountId: string;
  role?: string;
  expiresAt: number;
  routes: ShellRoute[];
  ui: Ui;
  academicYear?: string;
};
/** How long a prepared bootstrap stays usable without a grant. */
export const SHELL_PREPARATION_DURATION_MS = 8 * 60 * 60 * 1000;
export function shellBootstrapKey(namespace: string) { return `${namespace}.offline-shell.v1`; }

/**
 * The shell's public document allowlist, shared by the worker and the local
 * dispatcher. A pattern ending in `/*` admits every path below it.
 */
export function createShellPaths(patterns: readonly string[]) {
  return (path: string): boolean => {
    if (!path.startsWith('/') || path.startsWith('//') || /[?#\\]/.test(path)) return false;
    return patterns.some(pattern => pattern.endsWith('/*') ? path.startsWith(pattern.slice(0, -1)) : path === pattern);
  };
}

export function readShellBootstrap<B extends ShellBootstrap<any> = ShellBootstrap>(storage: Pick<Storage, 'getItem'>,
  options: { key: string; isShellPath(path: string): boolean; maxAgeMs?: number }, now = Date.now()): B | null {
  try {
    const value = JSON.parse(storage.getItem(options.key) ?? 'null') as B | null;
    if (!value || value.version !== 1 || typeof value.accountId !== 'string' || !value.accountId
      || (value.role !== undefined && typeof value.role !== 'string')
      || !Number.isFinite(value.expiresAt) || value.expiresAt <= now || value.expiresAt > now + (options.maxAgeMs ?? SHELL_PREPARATION_DURATION_MS)
      || !value.ui?.preferences || !Array.isArray(value.routes)
      || !value.routes.every(route => options.isShellPath(route.href) && typeof route.label === 'string')) return null;
    return value;
  } catch { return null; }
}

/** Preferences chosen in an open shell override a record read before or after the choice. */
export function withPreferenceChoices<T extends ShellBootstrap<any> | null>(bootstrap: T,
  choices: Partial<NonNullable<T>['ui']['preferences']>): T {
  if (!bootstrap || !Object.keys(choices).length) return bootstrap;
  return { ...bootstrap, ui: { ...bootstrap.ui, preferences: { ...bootstrap.ui.preferences, ...choices } } };
}

export function routeForPath(routes: ShellRoute[], path: string, isShellPath: (path: string) => boolean): ShellRoute | undefined {
  if (!isShellPath(path)) return undefined;
  return routes.find(route => path === route.href)
    ?? routes.filter(route => path.startsWith(route.href + '/')).sort((a, b) => b.href.length - a.href.length)[0];
}

/** A failed refresh is not an explicit user logout: only a logout clears the prepared bootstrap. */
export function connectPreparationLogout(client: { on(event: 'logout', listener: () => void): unknown; off(event: 'logout', listener: () => void): unknown },
  storage: Pick<Storage, 'removeItem'>, key: string) {
  const clear = () => { try { storage.removeItem(key); } catch { /* Storage already unavailable. */ } };
  client.on('logout', clear);
  return () => { client.off('logout', clear); };
}
