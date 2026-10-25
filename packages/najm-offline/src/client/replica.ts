import { openSyncReplica, type SyncReplica } from 'najm-database/sync/client';
import { createOfflineAccess, type OfflineAccess, type OfflineAccessRecord, type OfflineAccessToken } from 'najm-auth/client/offline';
import { scopeKey, type SyncContext } from 'najm-database/sync/contracts';
import { OFFLINE_DURATION_MS, OFFLINE_SHARED_YEAR, offlineHash, scopeContext, type OfflineGrant } from '../index';

/** Every name an app's offline storage uses starts with its namespace. */
export type ReplicaOptions = { namespace: string; durationMs?: number };
export type OfflineAccessRow = OfflineAccessRecord & { selectionFence?: string | null };
/** What the offline shell draws for a cached account: the grant and the app's display metadata. */
export type CachedPresentation<Bootstrap = unknown> = { grant: OfflineGrant; bootstrap: Bootstrap };

/** Runs inside the replica transaction as well as the helper's higher-level checks. No writes are enrolled. */
export function permitsReplica(policy: unknown, context: SyncContext, writing: boolean, now = Date.now(), durationMs = OFFLINE_DURATION_MS) {
  const row = policy as OfflineAccessRecord | undefined;
  const grant = row?.entitlement;
  if (writing || row?.schemaVersion !== 1 || row.status !== 'available' || !grant
    || context.replicaSchemaVersion !== 1 || grant.accountId !== context.accountId
    || grant.installationId !== context.installationId || grant.installationEpoch !== context.installationEpoch
    || grant.authorizationGeneration !== context.authorizationGeneration || now < row.highestObservedLocal - 1000) return false;
  const serverNow = grant.issuedAt + Math.max(now, row.highestObservedLocal) - row.enrolledAtLocal;
  if (serverNow >= Math.min(grant.validUntil, grant.issuedAt + durationMs)) return false;
  return grant.scopes.some(scope => scope.id === scopeKey(context.scope)
    && scope.academicYear === (context.scope.kind === 'year' ? context.scope.yearLabel : OFFLINE_SHARED_YEAR));
}

/** One account database. Its reads require the access row's binding to match `selectionFence`. */
export function openReplicaDatabase(options: ReplicaOptions, identity: { installationId: string; accountId: string }, factory?: IDBFactory,
  now = Date.now, selectionFence?: () => string | null): Promise<SyncReplica> {
  return openSyncReplica({ name: `${offlineHash(options.namespace)}:${identity.installationId}:${identity.accountId}`,
    identity, hashFormat: offlineHash(options.namespace), factory, now,
    canAccess: (policy, context, writing) => permitsReplica(policy, context, writing, now(), options.durationMs)
      && (!selectionFence || (!!selectionFence() && (policy as OfflineAccessRow)?.selectionFence === selectionFence())) });
}
export type ReplicaDatabase = SyncReplica;

/**
 * One selection of a database, which several views may share. A view's
 * `selectionFence` is the only one fresh enrollment can bind, so a renewal
 * begun under an older selection cannot authorize a newer one.
 */
export interface OfflineReplica<Bootstrap = unknown> {
  replica: ReplicaDatabase;
  access: OfflineAccess;
  store: { read(): Promise<OfflineAccessRow | null>; compareAndSwap(expected: number | null, next: OfflineAccessRecord): Promise<boolean> };
  /** Enrolls a fresh grant and stores what the shell draws for it in the same commit. */
  enrollPresentation(token: OfflineAccessToken, grant: OfflineGrant, bootstrap: Bootstrap): ReturnType<OfflineAccess['enroll']>;
}
export function replicaView<Bootstrap = unknown>(options: ReplicaOptions, replica: ReplicaDatabase, now = Date.now,
  selectionFence?: () => string | null): OfflineReplica<Bootstrap> {
  const presentations = new Map<number, CachedPresentation<Bootstrap>>();
  const store = {
    async read() { return (await replica.database.get('metadata', 'access') as OfflineAccessRow | undefined) ?? null; },
    async compareAndSwap(expected: number | null, next: OfflineAccessRecord) {
      return replica.database.transaction(['metadata'], async tx => {
        const current = await tx.get('metadata', 'access') as OfflineAccessRow | undefined;
        if ((current?.revision ?? null) !== expected) return false;
        // Clock updates/locks preserve the binding. Only fresh server enrollment can bind a new selection.
        const fresh = next.status === 'available' && next.entitlement?.issuedAt !== current?.entitlement?.issuedAt;
        if (fresh && selectionFence && !selectionFence()) return false;
        await tx.put('metadata', selectionFence ? { ...next,
          selectionFence: fresh ? selectionFence() : current?.selectionFence } : next, 'access');
        const presentation = fresh && next.entitlement ? presentations.get(next.entitlement.issuedAt) : undefined;
        if (presentation) await tx.put('metadata', presentation, 'presentation');
        return true;
      }, { durability: 'strict', tags: [`${options.namespace}:access`] });
    },
  };
  const access = createOfflineAccess({ store, now, maxOfflineDurationMs: options.durationMs ?? OFFLINE_DURATION_MS });
  return { replica, access, store,
    async enrollPresentation(token: OfflineAccessToken, grant: OfflineGrant, bootstrap: Bootstrap) {
      presentations.set(grant.issuedAt, { grant, bootstrap });
      try {
        return await access.enroll(token, { ...grant, mode: 'automatic-read',
          online: { authenticated: true, accountId: grant.accountId, permissions: grant.permissions } });
      } finally { presentations.delete(grant.issuedAt); }
    },
  };
}

export async function openReplica<Bootstrap = unknown>(options: ReplicaOptions, identity: { installationId: string; accountId: string },
  factory?: IDBFactory, now = Date.now, selectionFence?: () => string | null): Promise<OfflineReplica<Bootstrap>> {
  return replicaView<Bootstrap>(options, await openReplicaDatabase(options, identity, factory, now, selectionFence), now, selectionFence);
}

/** Old scopes must be retired before fresh enrollment can bind a changed account/mutation fence. */
export async function retireUnboundScopes(storage: Pick<OfflineReplica, 'store' | 'replica'>, selectionFence: string) {
  const policy = await storage.store.read();
  if (!policy?.entitlement || policy.selectionFence === selectionFence) return false;
  const grant = policy.entitlement;
  for (const scope of grant.scopes) await storage.replica.lock(scopeContext(grant, scope));
  return true;
}
