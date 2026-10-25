import { OfflineUnavailableError, projectionId, OFFLINE_SHARED_YEAR, type OfflineGrant, type OfflineRouteResolver, type ReadProjection } from '../index';
import type { SyncContext } from 'najm-database/sync/contracts';
import type { OfflineReplica } from './replica';

export type ReadContext = { accountId: string | null; year?: string; language: string; pointer: string | null; epoch: number; accountEpoch?: number };
export type LocalReadOwner = {
  capture(): Omit<ReadContext, 'year' | 'language'>;
  /** A local read may still be answered: same account, selection and access state. */
  isCurrent(context: ReadContext): boolean;
  /**
   * A server response may still be delivered: same signed-in account. An edit
   * or lock changes only what retained copies may answer. Defaults to isCurrent.
   */
  isOnlineCurrent?(context: ReadContext): boolean;
  /** A retained copy answered a read. */
  served?(): void;
  storage(context: ReadContext): Promise<Pick<OfflineReplica, 'store' | 'access' | 'replica'> | null>;
  lock(): Promise<void>;
  recover(): void;
};
/** The app's offline routes and the request headers that carry a read's language and year. */
export type DispatcherOptions = {
  route: OfflineRouteResolver;
  languageHeader: string;
  yearHeader: string;
  now?: () => number;
};
export function isConnectionFailure(error: unknown) {
  return error instanceof TypeError && /^(Failed to fetch|NetworkError when attempting to fetch resource\.?|Load failed|fetch failed|Network request failed|Unable to connect.*)$/i.test(error.message);
}

/** One transport owner, shared by ordinary pages and the independent shell. */
export function createLocalDispatcher(owner: LocalReadOwner, options: DispatcherOptions) {
  const { route: offlineRoute, languageHeader, yearHeader, now = Date.now } = options;
  const onlineCurrent = (context: ReadContext) => (owner.isOnlineCurrent ?? owner.isCurrent)(context);
  let outage = false;
  let retryAt = 0;
  let backoff = 1000;
  let recovery: Promise<unknown> | null = null;
  function capture(headers: Record<string, string> = {}): ReadContext {
    return Object.freeze({ ...owner.capture(), year: headers[yearHeader], language: headers[languageHeader] ?? 'en' });
  }
  async function local(path: string, context: ReadContext) {
    try {
    const route = offlineRoute(path);
    if (!route || !context.accountId || !owner.isCurrent(context)) throw new OfflineUnavailableError();
    const storage = await owner.storage(context);
    if (!storage) throw new OfflineUnavailableError();
    const policy = await storage.store.read();
    const grant = policy?.entitlement;
    const year = route.shared ? OFFLINE_SHARED_YEAR : context.year;
    const scopeId = route.shared ? 'shared' : 'year:' + year;
    if (!grant || !year) throw new OfflineUnavailableError();
    const decision = await storage.access.authorize({ accountId: context.accountId, installationId: grant.installationId,
      installationEpoch: grant.installationEpoch, academicYear: year, scopeId, capability: route.capability });
    if (!decision.allowed) throw new OfflineUnavailableError();
    const scope: SyncContext = { installationId: grant.installationId, installationEpoch: grant.installationEpoch,
      accountId: context.accountId, authorizationGeneration: grant.authorizationGeneration, replicaSchemaVersion: 1,
      scope: route.shared ? { kind: 'shared' } : { kind: 'year', yearLabel: year } };
      const result = await storage.replica.read(await storage.replica.capture(scope));
      const projection = result.records.find(row => row.entity === 'projection' && row.id === projectionId(context.language, route.path) && !row.deleted)?.value as ReadProjection | undefined;
      if (!projection || projection.path !== route.path || projection.language !== context.language
        || !owner.isCurrent(context) || !await storage.access.isCurrent(decision.token)) throw new OfflineUnavailableError();
      owner.served?.();
      return { data: projection.body };
    } catch { throw new OfflineUnavailableError(); }
  }
  async function network<T>(run: () => Promise<T>, context: ReadContext, path: string): Promise<T> {
    try {
      const result = await run();
      if (!onlineCurrent(context)) throw new OfflineUnavailableError();
      const recovered = outage;
      outage = false; retryAt = 0; backoff = 1000;
      if (recovered) owner.recover();
      return result;
    } catch (error) {
      const status = (error as { status?: number })?.status;
      if (status) {
        const recovered = outage;
        outage = false; retryAt = 0; backoff = 1000;
        if (recovered && status !== 401 && status !== 403) owner.recover();
      }
      if (onlineCurrent(context) && (status === 401 || status === 403)) {
        // An optional capability that was never granted cannot revoke another resource's grant.
        // Keep the actual refusal; only previously authorized coverage needs locking on 403.
        let revoked = status === 401;
        if (status === 403) {
          try {
            const route = offlineRoute(path)!;
            const grant = (await (await owner.storage(context))?.store.read())?.entitlement as OfflineGrant | undefined;
            const scope = route.shared ? 'shared' : 'year:' + context.year;
            revoked = !!grant?.scopes.some(item => item.id === scope && item.capabilities.includes(route.capability));
          } catch { revoked = true; }
        }
        if (revoked && onlineCurrent(context)) { try { await owner.lock(); } catch { /* Keep the authoritative HTTP error. */ } }
      }
      // Only a fetch connection failure. Abort/timeout/HTTP errors never select outage mode.
      if (isConnectionFailure(error) && !status && onlineCurrent(context)) {
        outage = true; retryAt = now() + backoff; backoff = Math.min(backoff * 2, 30_000);
      }
      throw error;
    }
  }
  return {
    capture,
    knownOutage: () => outage,
    async get(path: string, context: ReadContext, online: () => Promise<{ data: unknown }>, shell = false, localOnly = shell) {
      const registered = !!offlineRoute(path);
      if (!registered) {
        if (shell) throw new OfflineUnavailableError();
        return online();
      }
      if (localOnly || outage) {
        // Recovery is background and deduplicated. The local read never waits for a probe/token refresh.
        if (!localOnly && now() >= retryAt && !recovery) {
          recovery = network(online, context, path).catch(() => undefined).finally(() => { recovery = null; });
        }
        return local(path, context);
      }
      try { return await network(online, context, path); }
      catch (error) {
        if (!isConnectionFailure(error) || !outage) throw error;
        return local(path, context);
      }
    },
    local,
  };
}
export type LocalDispatcher = ReturnType<typeof createLocalDispatcher>;
