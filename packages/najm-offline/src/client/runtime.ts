import type { QueryClient } from '@tanstack/react-query';
import type { SnapshotManifest } from 'najm-database/sync/client';
import { scopeKey, type ReplicaRecord, type SyncContext } from 'najm-database/sync/contracts';
import type { NajmAuthClient, SessionExpiredEvent } from 'najm-auth/client';
import { OFFLINE_PROTOCOL, OFFLINE_SCHEMA, OFFLINE_RENEWAL_MS, OFFLINE_SHARED_YEAR, OfflineUnavailableError, scopeContext,
  type OfflineGrant, type OfflineRouteResolver } from '../index';
import { shellBootstrapKey, type ShellBootstrap } from './bootstrap';
import { createAccountSelection, type AccountSelection } from './access';
import { createLocalDispatcher, type ReadContext } from './localApi';
import { hidePrivateQueries } from './queryPrivacy';
import { retireUnboundScopes, type CachedPresentation } from './replica';
import { connectRenewalSchedule, createRenewalQueue } from './renewal';

/** The academic year a document reads, read when a renewal starts. */
export type OfflineYearSource = { get(): string | null | undefined; subscribe(listener: () => void): () => void };
export type OfflineClientOptions = {
  /** Prefixes every storage key, database, lock and event; School's is `school`. */
  namespace: string;
  /** The signed-in client and its API transport; the shell passes a neutral client. */
  auth: { client: NajmAuthClient; api: Pick<NajmAuthClient['api'], 'get' | 'post'> };
  route: OfflineRouteResolver;
  /** A write to this path changes downloaded data (see createWriteMatcher). */
  writeAffectsReads(path: string): boolean;
  /** First query-key segments whose queries may hold a retained copy. */
  queryRoots: readonly string[];
  languageHeader: string;
  yearHeader: string;
  /** Loaded on first use, so a page can split its year store from this module. */
  year?: () => Promise<OfflineYearSource>;
  /** Where the server's grant and snapshot routes are mounted. Defaults to `/offline`. */
  apiPrefix?: string;
  durationMs?: number;
  renewalMs?: number;
  /** A burst of edits downloads one replacement this long after the last; copies stay unusable meanwhile. */
  replacementDelayMs?: number;
};

/**
 * One app's offline reads: the page and the shell share it. Every server read
 * goes through `dispatch`; a retained copy answers only during an outage (or
 * in the shell), only for the account and year it was granted, and only while
 * that grant is current.
 */
export function createOfflineClient<Bootstrap extends ShellBootstrap<any> = ShellBootstrap>(options: OfflineClientOptions) {
  const { namespace, writeAffectsReads } = options;
  const auth = options.auth;
  const prefix = options.apiPrefix ?? '/offline';
  const renewalMs = options.renewalMs ?? OFFLINE_RENEWAL_MS;
  const replacementDelay = options.replacementDelayMs ?? 3000;
  const selection: AccountSelection<Bootstrap> = createAccountSelection<Bootstrap>({ namespace, durationMs: options.durationMs });
  const { pointerValue, invalidateSelection, selectAccount, selectedReplica, cachedExpiryDelay } = selection;
  const BOOTSTRAP_KEY = shellBootstrapKey(namespace);
  const ACCESS_SIGNAL = `${namespace}.offline-access-signal.v1`;
  const POINTER = selection.pointerKey;
  const ACCESS_EVENT = `${namespace}-offline-access`;
  const yearSource = () => options.year?.() ?? Promise.resolve(null);

  /** Fences local reads: account, selection and access state. */
  let epoch = 0;
  /** Fences server responses: the signed-in account only. */
  let accountEpoch = 0;
  let shell = false;
  let queryClient: QueryClient | null = null;
  let bootstrapSource: (() => Bootstrap | null) | null = null;
  let onlineAccount: string | null = null;
  let permissionRefreshAccount: string | null = null;
  let compatibility = false;
  /** When an online document first displayed a retained copy; null when all its data came from the server. */
  let localSince: number | null = null;
  let replacement: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const broadcastAccess = () => { try { localStorage.setItem(ACCESS_SIGNAL, crypto.randomUUID()); } catch { /* Durable row remains authoritative. */ } };
  const observe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
  const publish = () => { for (const listener of listeners) listener(); if (typeof window !== 'undefined') window.dispatchEvent(new Event(ACCESS_EVENT)); };
  const accountOf = (raw: string | null) => {
    try { return (JSON.parse(raw ?? 'null')?.accountId as string | null | undefined) ?? null; } catch { return null; }
  };
  const pointerAccount = () => accountOf(pointerValue());
  const currentAccount = () => shell ? pointerAccount() : auth.client.getState().user?.id ?? onlineAccount;
  const dispatcher = createLocalDispatcher({
    capture: () => ({ accountId: currentAccount(), pointer: typeof window === 'undefined' ? null : pointerValue(), epoch, accountEpoch }),
    isCurrent: context => context.epoch === epoch && context.pointer === pointerValue()
      && (!pointerAccount() || context.accountId === pointerAccount())
      && context.accountId === currentAccount(),
    isOnlineCurrent: context => context.accountEpoch === accountEpoch && context.accountId === currentAccount(),
    served: () => { localSince ??= Date.now(); },
    storage: async context => {
      const active = await selectedReplica();
      return active?.identity.accountId === context.accountId ? active.storage : null;
    },
    lock: async () => { await lockOffline(); },
    recover: () => { void renewOffline(true); },
  }, { route: options.route, languageHeader: options.languageHeader, yearHeader: options.yearHeader });

  /**
   * Hides retained copies from mounted observers when access is lost. The shell
   * shows only retained copies. An online document hides only what it updated
   * after first displaying one; its server results stay, as they would without
   * offline access.
   */
  async function hideRetainedData(client: QueryClient, clear = false) {
    if (shell) {
      await hidePrivateQueries(client);
      if (clear) client.clear();
      return;
    }
    if (localSince === null) return;
    const since = localSince;
    localSince = null;
    await hidePrivateQueries(client, query => query.state.dataUpdatedAt >= since);
  }
  /** A different account: nothing the previous one fetched may stay visible. */
  async function hideAccountData(client: QueryClient) {
    accountEpoch++; localSince = null;
    await hidePrivateQueries(client);
    client.clear();
  }

  function captureRead(headers?: Record<string, string>) { return dispatcher.capture(headers); }
  /** The independent shell: it reads only retained copies until a handshake reaches the server. */
  function installShellTransport() { shell = true; compatibility = false; }
  function dispatch(path: string, context: ReadContext, online: () => Promise<{ data: unknown }>) {
    if (typeof window === 'undefined') return online();
    if (!bootstrapSource) return shell ? Promise.reject(new OfflineUnavailableError()) : online();
    // A retained shell permits server reads only after its compatibility/access handshake.
    // Unsupported shell routes always remain unavailable, even after a handshake.
    return dispatcher.get(path, context, online, shell, shell && !compatibility);
  }
  function isKnownOffline() { return shell && !compatibility || dispatcher.knownOutage(); }
  function isShellEntry() { return shell; }

  async function lockOffline() {
    epoch++; compatibility = false;
    try { invalidateSelection(); } catch { /* The in-memory deny still applies when persistent storage is unavailable. */ }
    const client = queryClient;
    if (client) await hideRetainedData(client);
    publish();
    const active = await selectedReplica();
    if (active) await active.storage.access.lock(await active.storage.access.capture(), 'authorization-revoked');
    broadcastAccess();
    publish();
  }

  let refusedLock: Promise<void> | null = null;
  /**
   * The server refused the session: retained copies stop answering. A lost
   * connection or rate limit keeps them readable. One lock serves every listener;
   * a sign-in redirect waits for it (`useSignInOnSessionExpired`), since leaving
   * the page can abort its IndexedDB write.
   */
  function lockRefusedSession({ reason }: SessionExpiredEvent): Promise<void> {
    if (reason !== 'refused') return Promise.resolve();
    refusedLock ??= lockOffline().catch(() => undefined).finally(() => { refusedLock = null; });
    return refusedLock;
  }

  /**
   * Before sending a write that can change downloaded data, including a save
   * whose response is lost, retained copies become unusable until a replacement
   * downloads. It never queues/replays writes; other writes leave copies as they are.
   */
  async function invalidateReads(url: string) {
    if (!writeAffectsReads(url)) return;
    epoch++;
    invalidateSelection();
    const active = await selectedReplica();
    const grant = (await active?.storage.store.read())?.entitlement;
    if (!active || !grant) return;
    for (const scope of grant.scopes) await active.storage.replica.lock(scopeContext(grant, scope));
  }
  /** After such a write succeeds, schedule one replacement for the whole burst. */
  function mutationComplete(url: string) {
    if (!writeAffectsReads(url) || typeof window === 'undefined') return;
    clearTimeout(replacement);
    replacement = setTimeout(() => { void renewOffline(true); }, replacementDelay);
  }

  async function download(context: SyncContext, headers: Record<string, string>, capturedPointer: string | null, capturedEpoch: number) {
    const active = await selectedReplica();
    if (!active) return;
    const ticket = await active.storage.replica.beginSnapshot(context);
    const manifest = await auth.api.post<SnapshotManifest>(`${prefix}/snapshots`, { headers, timeout: 60_000, body: {
      installationId: context.installationId, installationEpoch: context.installationEpoch,
      authorizationGeneration: context.authorizationGeneration, kind: context.scope.kind,
    } });
    if (capturedPointer !== pointerValue() || capturedEpoch !== epoch) return;
    // The package checks immutable context/checksums/counts at stage and activation.
    if (JSON.stringify(manifest.context) !== JSON.stringify(context) && (
      manifest.context.accountId !== context.accountId || manifest.context.installationId !== context.installationId
      || manifest.context.installationEpoch !== context.installationEpoch || scopeKey(manifest.context.scope) !== scopeKey(context.scope)
      || manifest.context.authorizationGeneration !== context.authorizationGeneration || manifest.context.replicaSchemaVersion !== 1)) throw new OfflineUnavailableError();
    for (let page = 0; page < manifest.pageChecksums.length; page++) {
      const params = new URLSearchParams({ installationId: context.installationId, installationEpoch: context.installationEpoch,
        authorizationGeneration: context.authorizationGeneration });
      const records = await auth.api.get<ReplicaRecord[]>(`${prefix}/snapshots/${manifest.generation}/pages/${page}?${params}`, { headers, timeout: 15_000 });
      if (capturedPointer !== pointerValue() || capturedEpoch !== epoch) return;
      await active.storage.replica.stageSnapshotPage(ticket, manifest, page, records);
    }
    if (capturedPointer === pointerValue() && capturedEpoch === epoch) await active.storage.replica.activateSnapshot(ticket, manifest);
  }

  const renewOffline = createRenewalQueue(async request => {
    const renewalPointer = pointerValue();
    let renewalEpoch = epoch;
    await (async () => {
      const active = await selectedReplica();
      const bootstrap = bootstrapSource?.();
      if (!active || !bootstrap || (!shell && active.identity.accountId !== onlineAccount)) return;
      const capturedPointer = pointerValue();
      let capturedEpoch = epoch;
      const token = await active.storage.access.capture();
      const previousGeneration = (await active.storage.store.read())?.entitlement?.authorizationGeneration;
      // Unsupported roles still renew Phase-0 display metadata on successful token refresh.
      // This cannot replace any real entitlement, including an expired or locked one.
      if (!shell && !previousGeneration && auth.client.getState().user?.id === bootstrap.accountId
        && capturedPointer === pointerValue() && capturedEpoch === epoch) {
        localStorage.setItem(BOOTSTRAP_KEY, JSON.stringify(bootstrap));
      }
      const language = document.documentElement.lang || bootstrap.ui.preferences.language;
      // Capture the selection at request start, before grant/network work.
      const year = (await yearSource())?.get() ?? bootstrap.academicYear;
      const headers = { [options.languageHeader]: language, ...(year ? { [options.yearHeader]: year } : {}) };
      // A newly migrated account may have an old token. Refresh once per selected account;
      // a still-unsupported role must not recursively refresh on its own tokenRefresh event.
      if (!shell && !auth.client.can('read:offline') && permissionRefreshAccount !== active.identity.accountId) {
        permissionRefreshAccount = active.identity.accountId;
        await auth.client.refresh();
      }
      if (capturedPointer !== pointerValue() || capturedEpoch !== epoch) return;
      const grant = await auth.api.post<OfflineGrant>(`${prefix}/grant`, { headers, timeout: 15_000,
        body: { installationId: active.identity.installationId, installationEpoch: active.identity.installationEpoch } });
      if (capturedPointer !== pointerValue() || capturedEpoch !== epoch || grant.accountId !== active.identity.accountId) return;
      if (grant.protocol !== OFFLINE_PROTOCOL || grant.schema !== OFFLINE_SCHEMA) { await lockOffline(); return; }
      if (await retireUnboundScopes(active.storage, active.identity.fence)) request.requireRefresh();
      const presentation: CachedPresentation<Bootstrap> = { grant, bootstrap: { ...bootstrap, accountId: grant.accountId,
        role: grant.account.role, expiresAt: grant.validUntil, academicYear: grant.activeYear } };
      const result = await active.storage.enrollPresentation(token, grant, presentation.bootstrap);
      if (!result.applied || capturedPointer !== pointerValue() || capturedEpoch !== epoch) return;
      if (previousGeneration && previousGeneration !== grant.authorizationGeneration) {
        // Fence older in-flight reads and hide retained copies as soon as changed rights are known.
        epoch++; capturedEpoch = epoch; renewalEpoch = epoch;
        if (queryClient) await hideRetainedData(queryClient, true);
      }
      localStorage.removeItem(BOOTSTRAP_KEY);
      compatibility = true;
      publish();
      broadcastAccess();
      const force = request.takeRefresh();
      for (const scope of [{ kind: 'shared' as const }, ...(year ? [{ kind: 'year' as const, yearLabel: year }] : [])]) {
        const context: SyncContext = { installationId: grant.installationId, installationEpoch: grant.installationEpoch,
          accountId: grant.accountId, authorizationGeneration: grant.authorizationGeneration, replicaSchemaVersion: 1, scope };
        const permitted = grant.scopes.some(s => s.id === scopeKey(scope) && s.academicYear === (scope.kind === 'year' ? scope.yearLabel : OFFLINE_SHARED_YEAR));
        if (!permitted) continue;
        let stale = true;
        try {
          const runtime = await active.storage.replica.capture(context);
          const records = (await active.storage.replica.read(runtime)).records;
          stale = !records.some(r => (r.value as { language?: string; downloadedAt?: number })?.language === language
            && Date.now() - ((r.value as { downloadedAt?: number })?.downloadedAt ?? 0) < renewalMs);
        } catch { /* Missing/incompatible coverage needs a complete replacement. */ }
        if (force || stale) await download(context, headers, capturedPointer, capturedEpoch);
      }
      publish();
      // Re-read queries that may hold a retained copy; an online document whose
      // data all came from the server has none to replace.
      if (shell || localSince !== null) {
        await queryClient?.invalidateQueries({ predicate: query => options.queryRoots.includes(String(query.queryKey[0])) });
      }
    })().catch(async error => {
      // Server data may change while renewal fails, and a browser need not fire
      // `online` on reconnecting: the next renewal, whatever starts it, downloads.
      request.requireRefresh();
      const status = (error as { status?: number })?.status;
      if (renewalPointer === pointerValue() && renewalEpoch === epoch && (status === 401 || status === 403 || status === 409)) {
        try {
          const active = await selectedReplica();
          if ((await active?.storage.store.read())?.entitlement) await lockOffline();
        } catch { /* Unavailable storage cannot authorize private reads. */ }
      }
      // Transient failures cannot extend access. The scheduler retries silently.
    });
  });

  /**
   * Connects a document: its query client, the bootstrap it would enroll, and
   * whether it is the independent shell. Returns the disconnect.
   */
  function connect(client: QueryClient, source: () => Bootstrap | null, shellEntry = false) {
    queryClient = client; bootstrapSource = source; shell = shellEntry;
    let stopped = false;
    let lastAccount: string | null | undefined;
    let expiry: ReturnType<typeof setTimeout> | undefined;
    let observedGeneration: string | undefined;
    // Hide once when access is lost, not again on each check while it stays lost.
    let accessLost = false;
    const loseAccess = async () => {
      if (accessLost) return;
      accessLost = true;
      epoch++; await hideRetainedData(client); publish();
    };
    const checkAccess = async () => {
      try {
        const active = await selectedReplica();
        if (!active || stopped) return;
        const state = await active.storage.access.refresh();
        if (observedGeneration && observedGeneration !== state.authorizationGeneration) accessLost = false;
        if (state.status === 'locked' || (observedGeneration && observedGeneration !== state.authorizationGeneration)) await loseAccess();
        else if (state.status === 'available') accessLost = false;
        observedGeneration = state.authorizationGeneration;
        clearTimeout(expiry);
        if (state.status === 'available') expiry = setTimeout(() => { void checkAccess(); }, Math.max(1, await cachedExpiryDelay()));
      } catch {
        if (observedGeneration) await loseAccess();
      }
    };
    const reconcile = async () => {
      const account = currentAccountFor();
      // A temporary missing user is not an explicit logout.
      if (!account || stopped) return;
      if (lastAccount !== account) {
        // The first account a document resolves fetched everything it holds.
        const switched = lastAccount !== undefined;
        lastAccount = account; onlineAccount = account;
        permissionRefreshAccount = null;
        if (switched) { epoch++; compatibility = false; await hideAccountData(client); }
        await selectAccount(account);
      }
      if (!stopped) { await renewOffline(); await checkAccess(); }
    };
    const logout = () => {
      epoch++; compatibility = false; onlineAccount = null; lastAccount = null; permissionRefreshAccount = null;
      void hideAccountData(client); publish();
      void selectAccount(null).then(publish).catch(() => undefined);
    };
    const sessionExpired = (event: SessionExpiredEvent) => { void lockRefusedSession(event); };
    const refresh = () => renewOffline().then(checkAccess);
    const reconnect = () => renewOffline(true).then(checkAccess);
    const crossTab = (event: StorageEvent) => {
      if (event.key === ACCESS_SIGNAL) { void checkAccess(); return; }
      if (event.key !== POINTER) return;
      // Another tab's edit or lock only moves the fence; reads re-check it themselves.
      if (accountOf(event.oldValue) === accountOf(event.newValue)) return;
      epoch++; compatibility = false;
      void hideAccountData(client); publish();
      // A different tab's selected account is authoritative; never select the old tab's user again.
      lastAccount = currentAccountFor();
    };
    function currentAccountFor() { return shell ? pointerAccount() : auth.client.getState().user?.id ?? null; }
    const unsubscribe = auth.client.subscribe(() => { const account = auth.client.getState().user?.id; if (account && account !== lastAccount) void reconcile().catch(() => undefined); });
    auth.client.on('logout', logout);
    auth.client.on('sessionExpired', sessionExpired);
    let unwatchYear = () => {};
    void yearSource().then(source => {
      if (stopped || !source) return;
      let year = source.get();
      unwatchYear = source.subscribe(() => {
        const next = source.get();
        // A year downloaded recently in this language is reused; another one downloads.
        if (year !== next) { year = next; void renewOffline(); }
      });
    });
    const stopRenewal = connectRenewalSchedule({ auth: auth.client, document, window, reconcile, refresh, reconnect, intervalMs: renewalMs });
    window.addEventListener('storage', crossTab);
    void navigator.storage?.persist?.().catch(() => false);
    return () => {
      stopped = true; unsubscribe(); unwatchYear(); stopRenewal(); clearTimeout(expiry);
      auth.client.off('logout', logout);
      auth.client.off('sessionExpired', sessionExpired);
      window.removeEventListener('storage', crossTab);
      if (queryClient === client) { queryClient = null; bootstrapSource = null; }
    };
  }

  return {
    namespace, selection, bootstrapKey: BOOTSTRAP_KEY, accessEvent: ACCESS_EVENT,
    connect, captureRead, dispatch, installShellTransport, isKnownOffline, isShellEntry,
    lockOffline, lockRefusedSession, invalidateReads, mutationComplete, renewOffline, observe,
  };
}
export type OfflineClient<Bootstrap extends ShellBootstrap<any> = ShellBootstrap> = ReturnType<typeof createOfflineClient<Bootstrap>>;
