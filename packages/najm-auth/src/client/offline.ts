import { matchPermission } from './permissions';

/** Cached-device policy only. These records are never server authentication. */
export interface OfflineScope {
  id: string;
  academicYear: string;
  capabilities: readonly string[];
}

export interface OfflineEntitlement {
  accountId: string;
  installationId: string;
  installationEpoch: string;
  authorizationGeneration: string;
  /** Time from the authenticated server response, in Unix milliseconds. */
  issuedAt: number;
  validUntil: number;
  scopes: readonly OfflineScope[];
}

export type OfflineLockReason = 'logout' | 'account-switch' | 'account-disabled'
  | 'authorization-revoked' | 'installation-mismatch' | 'dataset-incompatible'
  | 'expired' | 'clock-rollback' | 'user-request';

export interface OfflineAccessRecord {
  schemaVersion: 1;
  revision: number;
  /** Changes at every enrollment/lock; clock observations retain the fence. */
  fence: string;
  status: 'available' | 'locked';
  reason?: OfflineLockReason;
  entitlement: OfflineEntitlement | null;
  enrolledAtLocal: number;
  highestObservedLocal: number;
}

export interface OfflineAccessStore {
  read(): Promise<OfflineAccessRecord | null>;
  /** Compare and write in ONE transaction across all tabs/workers. */
  compareAndSwap(expectedRevision: number | null, next: OfflineAccessRecord): Promise<boolean>;
}

export interface OfflineAccessToken {
  readonly fence: string | null;
  readonly accountId: string | null;
  /** The request's local start time; enrollment cannot renew a delayed grant. */
  readonly capturedAt: number;
}

export interface OfflineAccessSnapshot {
  status: 'empty' | 'available' | 'locked';
  reason?: OfflineLockReason | 'not-loaded' | 'storage-unavailable';
  accountId?: string;
  installationId?: string;
  installationEpoch?: string;
  authorizationGeneration?: string;
  validUntil?: number;
}

export type OfflineEnrollment = OfflineEntitlement & {
  /** Supplied ONLY after successful online authentication/authorization. */
  online: { authenticated: true; accountId: string; permissions: readonly string[] };
} & (
  /** Existing explicit enrollment contract for offline commands. */
  | { consent: true; mode?: 'explicit' }
  /** Automatic read-only caching after ordinary online sign-in. */
  | { mode: 'automatic-read'; consent?: never }
);

export interface OfflineAccessRequest {
  accountId: string;
  installationId: string;
  installationEpoch: string;
  scopeId: string;
  academicYear: string;
  capability: string;
}

export type OfflineAccessDecision =
  | { allowed: true; token: OfflineAccessToken }
  | { allowed: false; reason: OfflineLockReason | 'not-enrolled' | 'account-mismatch' | 'scope-not-enrolled' | 'capability-not-enrolled' };

export interface OfflineAccessOptions {
  store: OfflineAccessStore;
  now?: () => number;
  /** Default: seven days. The server policy may choose a shorter window. */
  maxOfflineDurationMs?: number;
  /** Default: 1000 ms. Backward jumps beyond this fail closed. */
  clockRollbackToleranceMs?: number;
}

export interface OfflineAccess {
  getSnapshot(): OfflineAccessSnapshot;
  subscribe(listener: () => void): () => void;
  /** Call after a cross-tab invalidation signal and before rendering cached data. */
  refresh(): Promise<OfflineAccessSnapshot>;
  /** Capture BEFORE an online request; logout/switch invalidates its callback. */
  capture(): Promise<OfflineAccessToken>;
  enroll(token: OfflineAccessToken, input: OfflineEnrollment): Promise<{ applied: boolean; snapshot: OfflineAccessSnapshot }>;
  lock(token: OfflineAccessToken, reason: OfflineLockReason): Promise<{ applied: boolean; snapshot: OfflineAccessSnapshot }>;
  authorize(request: OfflineAccessRequest): Promise<OfflineAccessDecision>;
  isCurrent(token: OfflineAccessToken): Promise<boolean>;
}

const reasons: readonly OfflineLockReason[] = [
  'logout', 'account-switch', 'account-disabled', 'authorization-revoked',
  'installation-mismatch', 'dataset-incompatible', 'expired', 'clock-rollback', 'user-request',
];
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const time = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const clone = <T>(value: T): T => structuredClone(value);

function validEntitlement(value: OfflineEntitlement): boolean {
  if (!value || !nonempty(value.accountId) || !nonempty(value.installationId)
    || !nonempty(value.installationEpoch) || !nonempty(value.authorizationGeneration)
    || !time(value.issuedAt) || !time(value.validUntil) || value.validUntil <= value.issuedAt
    || !Array.isArray(value.scopes) || value.scopes.length === 0) return false;
  const scopes = new Set<string>();
  for (const scope of value.scopes) {
    if (!scope || !nonempty(scope.id) || !nonempty(scope.academicYear)
      || scopes.has(scope.id) || !Array.isArray(scope.capabilities) || scope.capabilities.length === 0
      || !scope.capabilities.every(nonempty) || new Set(scope.capabilities).size !== scope.capabilities.length) return false;
    scopes.add(scope.id);
  }
  return true;
}

function validRecord(record: OfflineAccessRecord): boolean {
  return !!record && record.schemaVersion === 1 && Number.isSafeInteger(record.revision) && record.revision >= 1
    && nonempty(record.fence) && time(record.enrolledAtLocal) && time(record.highestObservedLocal)
    && record.highestObservedLocal >= record.enrolledAtLocal
    && (record.entitlement === null || validEntitlement(record.entitlement))
    && ((record.status === 'available' && record.entitlement !== null && record.reason === undefined)
      || (record.status === 'locked' && reasons.includes(record.reason!)));
}

/**
 * One installation's cached-account gate. It owns no credentials, queries, queue,
 * or storage deletion. Server authentication and per-command guards remain authoritative.
 */
export function createOfflineAccess(options: OfflineAccessOptions): OfflineAccess {
  const { store } = options;
  const now = options.now ?? Date.now;
  const maxDuration = options.maxOfflineDurationMs ?? 7 * 24 * 60 * 60 * 1000;
  const tolerance = options.clockRollbackToleranceMs ?? 1000;
  if (!store || typeof store.read !== 'function' || typeof store.compareAndSwap !== 'function') {
    throw new TypeError('Offline access requires a transactional compare-and-swap store');
  }
  if (!time(maxDuration) || maxDuration === 0 || !time(tolerance)) throw new TypeError('Invalid offline clock policy');

  let snapshot: OfflineAccessSnapshot = { status: 'locked', reason: 'not-loaded' };
  const listeners = new Set<() => void>();
  function publish(record: OfflineAccessRecord | null) {
    const e = record?.entitlement;
    const next: OfflineAccessSnapshot = record ? {
      status: record.status, ...(record.reason ? { reason: record.reason } : {}),
      ...(e ? { accountId: e.accountId, installationId: e.installationId, installationEpoch: e.installationEpoch,
        authorizationGeneration: e.authorizationGeneration, validUntil: e.validUntil } : {}),
    } : { status: 'empty' };
    if (JSON.stringify(snapshot) !== JSON.stringify(next)) {
      snapshot = Object.freeze(next);
      for (const listener of listeners) listener();
    }
  }
  function unavailable() {
    snapshot = Object.freeze({ status: 'locked', reason: 'storage-unavailable' });
    for (const listener of listeners) listener();
  }
  const tokenOf = (record: OfflineAccessRecord | null): OfflineAccessToken => Object.freeze({
    fence: record?.fence ?? null, accountId: record?.entitlement?.accountId ?? null, capturedAt: observedTime(),
  });
  const matches = (record: OfflineAccessRecord | null, token: OfflineAccessToken) => !!token
    && token.fence === (record?.fence ?? null) && token.accountId === (record?.entitlement?.accountId ?? null);
  function fence() {
    try { return globalThis.crypto.randomUUID(); }
    catch (error) { unavailable(); throw error; }
  }
  function observedTime(): number {
    const value = now();
    if (!time(value)) { unavailable(); throw new TypeError('Offline clock must return Unix milliseconds'); }
    return value;
  }
  async function read(): Promise<OfflineAccessRecord | null> {
    try {
      const record = await store.read();
      if (record !== null && !validRecord(record)) throw new Error('Invalid or unsupported offline access record; explicit recovery is required');
      return clone(record);
    } catch (error) { unavailable(); throw error; }
  }
  async function write(record: OfflineAccessRecord | null, next: OfflineAccessRecord): Promise<boolean> {
    try { return await store.compareAndSwap(record?.revision ?? null, clone(next)); }
    catch (error) { unavailable(); throw error; }
  }
  function locked(record: OfflineAccessRecord | null, reason: OfflineLockReason, at: number): OfflineAccessRecord {
    return {
      schemaVersion: 1, revision: (record?.revision ?? 0) + 1, fence: fence(), status: 'locked', reason,
      entitlement: record?.entitlement ?? null, enrolledAtLocal: record?.enrolledAtLocal ?? at,
      highestObservedLocal: Math.max(record?.highestObservedLocal ?? at, at),
    };
  }
  /** Persist high-water time before granting access, including on cold reopen. */
  async function current(): Promise<OfflineAccessRecord | null> {
    for (let attempt = 0; attempt < 32; attempt++) {
      const record = await read();
      if (!record || record.status === 'locked') { publish(record); return record; }
      const at = observedTime();
      let next: OfflineAccessRecord;
      if (at < record.highestObservedLocal - tolerance) next = locked(record, 'clock-rollback', at);
      else if (record.entitlement!.issuedAt + Math.max(at, record.highestObservedLocal) - record.enrolledAtLocal
        >= Math.min(record.entitlement!.validUntil, record.entitlement!.issuedAt + maxDuration)) {
        next = locked(record, 'expired', at);
      } else if (at > record.highestObservedLocal) next = { ...record, revision: record.revision + 1, highestObservedLocal: at };
      else { publish(record); return record; }
      if (await write(record, next)) { publish(next); return next; }
    }
    unavailable();
    throw new Error('Offline access store contention; retry after coordinating tabs/workers');
  }
  async function lock(token: OfflineAccessToken, reason: OfflineLockReason) {
    if (!reasons.includes(reason)) throw new TypeError('Invalid offline lock reason');
    for (let attempt = 0; attempt < 32; attempt++) {
      const record = await current();
      if (!matches(record, token)) return { applied: false, snapshot };
      const next = locked(record, reason, observedTime());
      if (await write(record, next)) { publish(next); return { applied: true, snapshot }; }
    }
    unavailable(); throw new Error('Offline lock contention');
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async refresh() { await current(); return snapshot; },
    async capture() { return tokenOf(await current()); },
    async enroll(token, input) {
      const automaticRead = input.mode === 'automatic-read';
      const explicit = (input.mode === undefined || input.mode === 'explicit') && input.consent === true;
      const permissions = Array.isArray(input.online?.permissions) ? [...input.online.permissions] : [];
      if (!validEntitlement(input) || (!explicit && !automaticRead) || (automaticRead && input.consent !== undefined)
        || input.online?.authenticated !== true
        || input.online.accountId !== input.accountId || !Array.isArray(input.online.permissions)
        || !matchPermission(permissions, automaticRead ? 'read:offline' : 'use:offline')
        || input.scopes.some(scope => scope.capabilities.some(capability =>
          (automaticRead && !/^read:[^\s:]+$/.test(capability)) || !matchPermission(permissions, capability)))
        || input.validUntil - input.issuedAt > maxDuration) {
        throw new TypeError('Offline enrollment requires an authorized explicit or automatic-read mode, scope capabilities and a bounded valid policy');
      }
      for (let attempt = 0; attempt < 32; attempt++) {
        const record = await current();
        if (!matches(record, token)) return { applied: false, snapshot };
        // Switching accounts first requires an explicit lock. Nothing deletes A's queue.
        if (record?.status === 'available' && record.entitlement!.accountId !== input.accountId) {
          throw new Error('Lock the previous account before enrolling another account');
        }
        if (automaticRead && record?.status === 'available' && record.entitlement?.scopes.some(scope =>
          scope.capabilities.some(capability => !/^read:[^\s:]+$/.test(capability)))) {
          throw new Error('Automatic reading cannot replace an enrolled offline command policy');
        }
        if (record?.entitlement?.accountId === input.accountId
          && record.entitlement.installationId === input.installationId
          && record.entitlement.installationEpoch === input.installationEpoch
          && input.issuedAt <= record.entitlement.issuedAt) {
          return { applied: false, snapshot };
        }
        const at = observedTime();
        if (!time(token.capturedAt) || token.capturedAt > at + tolerance
          || input.issuedAt + Math.max(0, at - token.capturedAt) >= input.validUntil) {
          throw new Error('Offline enrollment response expired or its request clock moved backward');
        }
        // An auth response may contain credentials: persist only the policy allowlist.
        const entitlement: OfflineEntitlement = {
          accountId: input.accountId, installationId: input.installationId, installationEpoch: input.installationEpoch,
          authorizationGeneration: input.authorizationGeneration, issuedAt: input.issuedAt, validUntil: input.validUntil,
          scopes: input.scopes.map(scope => ({ id: scope.id, academicYear: scope.academicYear, capabilities: [...scope.capabilities] })),
        };
        const next: OfflineAccessRecord = {
          schemaVersion: 1, revision: (record?.revision ?? 0) + 1, fence: fence(), status: 'available',
          entitlement, enrolledAtLocal: Math.min(token.capturedAt, at), highestObservedLocal: at,
        };
        if (await write(record, next)) { publish(next); return { applied: true, snapshot }; }
      }
      unavailable(); throw new Error('Offline enrollment contention');
    },
    lock,
    async authorize(request) {
      const record = await current();
      if (!record) return { allowed: false, reason: 'not-enrolled' };
      if (record.status === 'locked') return { allowed: false, reason: record.reason! };
      const entitlement = record.entitlement!;
      if (entitlement.accountId !== request.accountId) return { allowed: false, reason: 'account-mismatch' };
      if (entitlement.installationId !== request.installationId || entitlement.installationEpoch !== request.installationEpoch) {
        await lock(tokenOf(record), 'installation-mismatch');
        return { allowed: false, reason: 'installation-mismatch' };
      }
      const scope = entitlement.scopes.find(item => item.id === request.scopeId && item.academicYear === request.academicYear);
      if (!scope) return { allowed: false, reason: 'scope-not-enrolled' };
      if (!scope.capabilities.includes(request.capability)) return { allowed: false, reason: 'capability-not-enrolled' };
      return { allowed: true, token: tokenOf(record) };
    },
    async isCurrent(token) {
      const record = await current();
      return record?.status === 'available' && matches(record, token);
    },
  };
}
