import { openDatabase } from 'fast-idb/db';
import type { OfflineInstallation } from '../index';
import { openReplicaDatabase, replicaView, type CachedPresentation, type OfflineReplica, type ReplicaDatabase, type ReplicaOptions } from './replica';

export type Installation = OfflineInstallation & { accountId: string | null; fence: string };
export type ActiveReplica<Bootstrap = unknown> = { identity: Installation; storage: OfflineReplica<Bootstrap> };

/** The localStorage key naming which account's database this installation reads. */
export function accountPointerKey(namespace: string) { return `${namespace}.offline-account.v1`; }

/**
 * Which account database this installation reads, and one shared connection
 * to it. The pointer only chooses a database; its transactional access row
 * alone authorizes records.
 */
export function createAccountSelection<Bootstrap = unknown>(options: ReplicaOptions) {
  const POINTER = accountPointerKey(options.namespace);
  let deniedPointer: string | null = null;
  const pointerValue = () => { try { const value = localStorage.getItem(POINTER); return value === deniedPointer ? null : value; } catch { return null; } };
  const parsePointer = (raw: string | null) => { try { return raw ? JSON.parse(raw) as Installation : null; } catch { return null; } };
  const selectedFence = () => parsePointer(pointerValue())?.fence ?? null;
  /** The selected account's current fence, while the pointer still selects this database. */
  const databaseFence = (identity: Installation) => () => {
    const selected = parsePointer(pointerValue());
    return selected?.installationId === identity.installationId && selected.installationEpoch === identity.installationEpoch
      && selected.accountId === identity.accountId ? selected.fence : null;
  };

  /** A deny fence survives reopening even when IndexedDB coverage invalidation fails. It grants nothing. */
  function invalidateSelection() {
    const raw = pointerValue();
    if (!raw) return;
    const identity = JSON.parse(raw) as Installation;
    if (!identity.accountId) return;
    deniedPointer = raw;
    localStorage.setItem(POINTER, JSON.stringify({ ...identity, fence: crypto.randomUUID() }));
  }

  async function readRegistry(): Promise<OfflineInstallation> {
    const registry = await openDatabase<{ metadata: OfflineInstallation }>({ name: `${options.namespace}-offline-installation-v1`, version: 1,
      stores: { metadata: {} } });
    try {
      return await registry.transaction(['metadata'], async tx => {
        const stored = await tx.get('metadata', 'identity');
        if (stored) return stored;
        const created = { installationId: crypto.randomUUID(), installationEpoch: crypto.randomUUID() };
        await tx.put('metadata', created, 'identity');
        return created;
      }, { durability: 'strict' });
    } finally { registry.close(); }
  }
  // The installation never changes while a document is open, so it is read once;
  // a pointer naming another one re-reads it (another tab may have recreated it).
  let registry: Promise<OfflineInstallation> | null = null;
  const registered = (fresh = false) => {
    if (fresh || !registry) registry = readRegistry().catch(error => { registry = null; throw error; });
    return registry;
  };

  async function installation(): Promise<Installation> {
    const matches = (identity: OfflineInstallation, selected: Installation | null): selected is Installation =>
      !!selected && selected.installationId === identity.installationId && selected.installationEpoch === identity.installationEpoch;
    let identity = await registered();
    let selected = parsePointer(pointerValue());
    if (matches(identity, selected)) return selected;
    identity = await registered(true);
    selected = parsePointer(pointerValue());
    if (matches(identity, selected)) return selected;
    const next = { ...identity, accountId: null, fence: crypto.randomUUID() };
    localStorage.setItem(POINTER, JSON.stringify(next));
    return next;
  }

  /*
   * One connection per account database, shared by every selection of it, and
   * one view per selection. A fence change (an edit, a lock) only makes a new
   * view, so a download still using the old view keeps its connection; only an
   * account switch or logout closes it.
   */
  let database: { key: string; opened: Promise<ReplicaDatabase> } | null = null;
  let selection: { key: string; active: Promise<ActiveReplica<Bootstrap>> } | null = null;
  const databaseKey = (identity: Installation) => JSON.stringify([identity.installationId, identity.installationEpoch, identity.accountId]);
  function releaseDatabase() {
    const released = database;
    database = null; selection = null;
    void released?.opened.then(replica => replica.close()).catch(() => undefined);
    return released;
  }

  async function selectAccount(accountId: string | null) {
    let identity = parsePointer(pointerValue());
    if (!identity?.installationId || !identity.installationEpoch || !identity.fence) identity = await installation();
    if (identity.accountId === accountId) return identity;
    // Invalidate callbacks synchronously before awaiting a lock in another database.
    const next = { ...identity, accountId, fence: crypto.randomUUID() };
    localStorage.setItem(POINTER, JSON.stringify(next));
    const previousKey = databaseKey(identity);
    const retained = database?.key === previousKey ? database : null;
    if (retained) database = null;
    selection = null;
    if (identity.accountId) {
      const opened = retained ? await retained.opened.catch(() => null) : null;
      const replica = opened ?? await openReplicaDatabase(options, { installationId: identity.installationId, accountId: identity.accountId },
        undefined, Date.now, selectedFence);
      try {
        const previous = replicaView<Bootstrap>(options, replica, Date.now, selectedFence);
        await previous.access.lock(await previous.access.capture(), accountId ? 'account-switch' : 'logout');
      } finally { replica.close(); }
    }
    // A connection to any other account database is never reused.
    if (database && database.key !== databaseKey(next)) releaseDatabase();
    return next;
  }

  async function selectedReplica(): Promise<ActiveReplica<Bootstrap> | null> {
    const identity = await installation();
    if (!identity.accountId) return null;
    const key = JSON.stringify(identity);
    // No await from here on: concurrent callers share one view and one connection.
    if (selection?.key === key) return selection.active;
    const dbKey = databaseKey(identity);
    if (database?.key !== dbKey) {
      releaseDatabase();
      const opened = openReplicaDatabase(options, { installationId: identity.installationId, accountId: identity.accountId },
        undefined, Date.now, databaseFence(identity));
      const entry = { key: dbKey, opened };
      database = entry;
      opened.catch(() => { if (database === entry) { database = null; selection = null; } });
    }
    const active = database!.opened.then(replica => ({ identity,
      storage: replicaView<Bootstrap>(options, replica, Date.now, () => pointerValue() === key ? identity.fence : null) }));
    const entry = { key, active };
    selection = entry;
    active.catch(() => { if (selection === entry) selection = null; });
    return active;
  }

  /** No grant was ever enrolled here: the shell may show display-only metadata. */
  async function canUseLegacyDisplay() {
    try {
      const active = await selectedReplica();
      return !active || !(await active.storage.store.read())?.entitlement;
    } catch { return false; }
  }
  async function cachedExpiryDelay() {
    const active = await selectedReplica();
    const policy = await active?.storage.store.read();
    return policy?.entitlement ? Math.max(0, policy.enrolledAtLocal + policy.entitlement.validUntil - policy.entitlement.issuedAt - Date.now()) : 0;
  }
  async function readCachedPresentation(): Promise<CachedPresentation<Bootstrap> | null> {
    try {
      const before = pointerValue();
      const active = await selectedReplica();
      if (!active || (await active.storage.access.refresh()).status !== 'available') return null;
      const presentation = await active.storage.replica.database.get('metadata', 'presentation') as CachedPresentation<Bootstrap> | undefined;
      const policy = await active.storage.store.read();
      if (!presentation || !policy?.entitlement || policy.selectionFence !== active.identity.fence || presentation.grant.accountId !== active.identity.accountId
        || presentation.grant.authorizationGeneration !== policy.entitlement.authorizationGeneration
        || presentation.grant.issuedAt !== policy.entitlement.issuedAt || pointerValue() !== before) return null;
      return presentation;
    } catch { return null; }
  }
  /** Rewrites the cached account's display metadata, such as a preference chosen offline. */
  async function updatePresentation(accountId: string, update: (bootstrap: Bootstrap) => Bootstrap) {
    const active = await selectedReplica();
    if (!active) return;
    await active.storage.replica.database.transaction(['metadata'], async tx => {
      const current = await tx.get('metadata', 'presentation') as CachedPresentation<Bootstrap> | undefined;
      if (!current || current.grant.accountId !== accountId) return;
      await tx.put('metadata', { ...current, bootstrap: update(current.bootstrap) }, 'presentation');
    });
  }

  return { pointerKey: POINTER, pointerValue, invalidateSelection, installation, selectAccount, selectedReplica,
    canUseLegacyDisplay, cachedExpiryDelay, readCachedPresentation, updatePresentation };
}
export type AccountSelection<Bootstrap = unknown> = ReturnType<typeof createAccountSelection<Bootstrap>>;
