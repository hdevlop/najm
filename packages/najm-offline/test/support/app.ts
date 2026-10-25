/**
 * A sample app configured the way an app wires najm-offline: its namespace,
 * routes, written paths, worker cache and logo slots. The tests read through
 * these names.
 */
import { createAuthClient } from 'najm-auth/client';
import { createWriteMatcher, offlinePath, OFFLINE_DURATION_MS, OFFLINE_RENEWAL_MS, OFFLINE_SHARED_YEAR, projectionId,
  type OfflineGrant, type OfflineRoute } from '../../src/index';
import { createLocalDispatcher as createDispatcher, type LocalReadOwner } from '../../src/client/localApi';
import { openReplica, retireUnboundScopes, type OfflineReplica } from '../../src/client/replica';
import { createShellPaths, readShellBootstrap, routeForPath as findRoute, shellBootstrapKey, withPreferenceChoices,
  connectPreparationLogout as connectLogout, type ShellBootstrap as Bootstrap } from '../../src/client/bootstrap';
import { cacheShellBranding as cacheBranding, withCachedBranding as withBranding } from '../../src/client/branding';
import { isActiveShellReady as isReady } from '../../src/client/readiness';
import { createShellUpdates } from '../../src/client/updates';
export { hidePrivateQueries } from '../../src/client/queryPrivacy';
export { connectRenewalSchedule, createRenewalQueue } from '../../src/client/renewal';
export { registerShell, retryPreparation } from '../../src/client/registration';
export { OFFLINE_DURATION_MS, OFFLINE_RENEWAL_MS, OFFLINE_SHARED_YEAR, projectionId, type OfflineGrant };
export type { ReadContext } from '../../src/client/localApi';

export const NAMESPACE = 'app';
export const CACHE_ID = 'app-shell';
export const LANGUAGE_HEADER = 'X-Language';
export const YEAR_HEADER = 'X-Academic-Year';

export function offlineRoute(path: string): OfflineRoute | null {
  const normalized = offlinePath(path);
  if (!normalized) return null;
  if (normalized === '/settings/public' || normalized === '/academic-years') return { path: normalized, shared: true, capability: 'read:students' };
  if (normalized === '/classes') return { path: normalized, shared: false, capability: 'read:classes' };
  if (normalized === '/students' || /^\/students\/[A-Za-z0-9_-]+(?:\/(?:parents|enrollments))?$/.test(normalized)) {
    if (['/students/count', '/students/my-identity'].includes(normalized)) return null;
    return { path: normalized, shared: false, capability: 'read:students' };
  }
  return null;
}
export const offlineWriteAffectsReads = createWriteMatcher(['/students', '/parents', '/profiles/students', '/profiles/parents',
  '/student-enrollments', '/classes', '/sections', '/cycles', '/teachers', '/staff', '/settings', '/academic-years',
  '/academic-year-migration-issues', '/rollover', '/admin/access/users']);

export type AppReplica = OfflineReplica<Bootstrap>;
export const openAppReplica = (identity: { installationId: string; accountId: string }, factory?: IDBFactory, now = Date.now,
  selectionFence?: () => string | null) => openReplica<Bootstrap>({ namespace: NAMESPACE }, identity, factory, now, selectionFence);
export { retireUnboundScopes };
export const createLocalDispatcher = (owner: LocalReadOwner, now = Date.now) =>
  createDispatcher(owner, { route: offlineRoute, languageHeader: LANGUAGE_HEADER, yearHeader: YEAR_HEADER, now });

export const SHELL_PATHS = ['/home', '/dashboard', '/students', '/students/*', '/parents', '/parents/*', '/fees', '/classes'] as const;
export const isShellPath = createShellPaths(SHELL_PATHS);
export const BOOTSTRAP_KEY = shellBootstrapKey(NAMESPACE);
export type ShellBootstrap = Bootstrap<{ preferences: { language: string; theme?: string; timeZone?: string } } & Record<string, unknown>>;
export const readBootstrap = (storage: Pick<Storage, 'getItem'>, now = Date.now()) =>
  readShellBootstrap<ShellBootstrap>(storage, { key: BOOTSTRAP_KEY, isShellPath }, now);
export const routeForPath = (routes: ShellBootstrap['routes'], path: string) => findRoute(routes, path, isShellPath);
export { withPreferenceChoices };
export const connectPreparationLogout = (client: Parameters<typeof connectLogout>[0], storage: Pick<Storage, 'removeItem'>) =>
  connectLogout(client, storage, BOOTSTRAP_KEY);

export const SHELL_BRANDING_CACHE = 'app-offline-branding';
const branding = { cacheName: SHELL_BRANDING_CACHE, slots: ['sidebarLogoExpanded', 'sidebarLogoCollapsed'], immutable: /^\/api\/branding\/(?:factory|assets)\// };
export const cacheShellBranding = (value: Parameters<typeof cacheBranding>[1], origin?: string, storage?: Pick<CacheStorage, 'open'>, request?: typeof fetch) =>
  cacheBranding(branding, value, origin, storage, request);
export const withCachedBranding = <T extends { slots?: Readonly<Record<string, string | null>> }>(value: T, origin?: string, storage?: Pick<CacheStorage, 'open'>) =>
  withBranding(branding, value, origin, storage);
export const isActiveShellReady = (container: Pick<ServiceWorkerContainer, 'controller'>, version: string, timeoutMs?: number) =>
  isReady(container, CACHE_ID, version, timeoutMs);
export const { pruneActiveShellCaches, pruneUnpinnedCaches } = createShellUpdates({ namespace: NAMESPACE, cacheId: CACHE_ID });

/** The app's signed-in client; tests stub its state and transport. */
export function createAppAuth() {
  const client = createAuthClient({ baseURL: 'https://app.invalid/api', tabSync: false });
  return { client, api: client.api };
}
