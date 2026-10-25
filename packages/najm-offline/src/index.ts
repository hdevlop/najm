import type { SyncContext } from 'najm-database/sync/contracts';

/**
 * Najm's read-only offline protocol, shared by the server, the page and the
 * offline shell. Never contains credentials or command outcomes. This entry
 * has no runtime dependency, so a browser bundle and a server both import it.
 */
export const OFFLINE_PROTOCOL = 1;
export const OFFLINE_SCHEMA = 1;
/** How long one grant lets a device read without reaching the server. */
export const OFFLINE_DURATION_MS = 8 * 60 * 60 * 1000;
/** How often an open page renews its grant and downloads stale coverage. */
export const OFFLINE_RENEWAL_MS = 15 * 60 * 1000;
/** The academic year a shared scope (settings, the year list) is filed under. */
export const OFFLINE_SHARED_YEAR = 'shared';

/** The replica hash format: one per app, so two apps on one origin never share a database. */
export function offlineHash(namespace: string) { return `${namespace}-read-v1`; }
/** An installation turns offline use off with `<SWITCH>=off`, read at request time. */
export function offlineEnabled(value: string | undefined) { return value?.trim().toLowerCase() !== 'off'; }

export type OfflineInstallation = { installationId: string; installationEpoch: string };
export type OfflineGrantScope = { id: string; academicYear: string; capabilities: string[] };
export type OfflineGrant = OfflineInstallation & {
  protocol: 1;
  schema: 1;
  accountId: string;
  authorizationGeneration: string;
  issuedAt: number;
  validUntil: number;
  scopes: OfflineGrantScope[];
  account: { id: string; name: string | null; role: string; email: string | null; image: string | null };
  permissions: string[];
  activeYear: string;
};
/** One recorded API response: what a GET of `path` answered in `language`. */
export type ReadProjection = {
  path: string;
  language: string;
  downloadedAt: number;
  body: unknown;
};

/** A GET an app answers offline: shared scopes hold year-independent reads. */
export type OfflineRoute = { path: string; shared: boolean; capability: string };
export type OfflineRouteResolver = (path: string) => OfflineRoute | null;

/**
 * The path an app's route table matches, or null for an external URL, a query
 * (including dated lists), a fragment or an encoded separator. No query family
 * is implied by an exact projection.
 */
export function offlinePath(path: string): string | null {
  if (!path.startsWith('/') || path.startsWith('//') || /[?#%\\]/.test(path)) return null;
  return path.replace(/\/$/, '') || '/';
}

/**
 * Write routes whose tables the app's projections read. A write there makes
 * retained copies unusable until a replacement downloads; any other write is
 * reflected by the next scheduled replacement, at most OFFLINE_RENEWAL_MS later.
 */
export function createWriteMatcher(prefixes: readonly string[]) {
  return (path: string) => prefixes.some(prefix => path === prefix || path.startsWith(prefix + '/') || path.startsWith(prefix + '?'));
}

export function projectionId(language: string, path: string) { return JSON.stringify([language, path]); }

/** The replica context one granted scope is stored under. */
export function scopeContext(grant: Pick<OfflineGrant, 'installationId' | 'installationEpoch' | 'accountId' | 'authorizationGeneration'>,
  scope: Pick<OfflineGrantScope, 'id' | 'academicYear'>): SyncContext {
  return { installationId: grant.installationId, installationEpoch: grant.installationEpoch,
    accountId: grant.accountId, authorizationGeneration: grant.authorizationGeneration, replicaSchemaVersion: OFFLINE_SCHEMA,
    scope: scope.id === 'shared' ? { kind: 'shared' } : { kind: 'year', yearLabel: scope.academicYear } };
}

export class OfflineUnavailableError extends Error {
  readonly code = 'OFFLINE_DATA_UNAVAILABLE';
  constructor() { super('This data has not been downloaded or offline access is unavailable.'); }
}
