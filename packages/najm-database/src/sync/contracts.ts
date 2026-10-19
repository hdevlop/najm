/** Portable synchronization primitives. This entry imports no server or browser runtime. */
export type SyncScope = { kind: 'year'; yearLabel: string } | { kind: 'shared' };
export interface SyncContext {
  installationId: string;
  installationEpoch: string;
  accountId: string;
  scope: SyncScope;
  authorizationGeneration: string;
  replicaSchemaVersion: number;
}
export interface SyncOperation<Intent = unknown> {
  installationId: string;
  installationEpoch: string;
  accountId: string;
  scope: SyncScope;
  operationId: string;
  deviceId: string;
  protocolVersion: 1;
  hashFormat: string;
  payloadHash: string;
  dependencies: readonly string[];
  createdAtClient: string;
  intent: Intent;
}
export interface ReplicaRecord<Value = unknown> {
  entity: string;
  id: string;
  revision: string;
  deleted: boolean;
  value?: Value;
}
export type SyncOutcome<Result = unknown> =
  | { state: 'acknowledged'; result: Result; records: readonly ReplicaRecord[]; mappings: Readonly<Record<string, string>> }
  | { state: 'conflict' | 'rejected' | 'blocked_dependency'; code: string; current?: unknown };
export interface OperationReceipt<Result = unknown> {
  operationId: string;
  payloadHash: string;
  outcome: SyncOutcome<Result>;
}

export class SyncError extends Error {
  constructor(public readonly code: string) { super(code); this.name = 'SyncError'; }
}

/** JSON v1: sorted UTF-16 keys, finite JSON numbers, no implicit coercion/omission. */
export function canonicalJson(value: unknown): string {
  const seen = new Set<object>();
  function encode(item: unknown): string {
    if (item === null || typeof item === 'boolean' || typeof item === 'string') return JSON.stringify(item);
    if (typeof item === 'number' && Number.isFinite(item)) return JSON.stringify(item);
    if (typeof item !== 'object' || item === null || seen.has(item) || seen.size >= 100) throw new SyncError('PAYLOAD_INVALID');
    seen.add(item);
    try {
      if (Array.isArray(item)) {
        if (Object.keys(item).length !== item.length) throw new SyncError('PAYLOAD_INVALID');
        return '[' + item.map(encode).join(',') + ']';
      }
      if (![Object.prototype, null].includes(Object.getPrototypeOf(item))) throw new SyncError('PAYLOAD_INVALID');
      if (Object.getOwnPropertySymbols(item).length) throw new SyncError('PAYLOAD_INVALID');
      const keys = Object.keys(item).sort();
      return '{' + keys.map(key => {
        const descriptor = Object.getOwnPropertyDescriptor(item, key)!;
        if (!('value' in descriptor)) throw new SyncError('PAYLOAD_INVALID');
        return JSON.stringify(key) + ':' + encode(descriptor.value);
      }).join(',') + '}';
    } finally { seen.delete(item); }
  }
  return encode(value);
}

export async function sha256(value: string): Promise<string> {
  const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function scopeKey(scope: SyncScope): string {
  if (scope?.kind === 'shared' && Object.keys(scope).length === 1) return 'shared';
  if (scope?.kind === 'year' && Object.keys(scope).length === 2 && /^\d{4}-\d{4}$/.test(scope.yearLabel)) {
    const [start, end] = scope.yearLabel.split('-').map(Number);
    if (end === start + 1) return 'year:' + scope.yearLabel;
  }
  throw new SyncError('YEAR_UNAVAILABLE');
}

export function sameContext(a: SyncContext, b: SyncContext): boolean {
  return a.installationId === b.installationId && a.installationEpoch === b.installationEpoch
    && a.accountId === b.accountId && scopeKey(a.scope) === scopeKey(b.scope)
    && a.authorizationGeneration === b.authorizationGeneration && a.replicaSchemaVersion === b.replicaSchemaVersion;
}

export function assertOperationContext(operation: SyncOperation, context: SyncContext): void {
  if (operation.installationId !== context.installationId) throw new SyncError('INSTALLATION_MISMATCH');
  if (operation.installationEpoch !== context.installationEpoch) throw new SyncError('DATASET_EPOCH_CHANGED');
  if (operation.accountId !== context.accountId) throw new SyncError('RESOURCE_FORBIDDEN');
  if (scopeKey(operation.scope) !== scopeKey(context.scope)) throw new SyncError('YEAR_UNAVAILABLE');
}

export async function sealOperation<I>(input: Omit<SyncOperation<I>, 'payloadHash'>): Promise<SyncOperation<I>> {
  // Round-trip before hashing: subsequent caller edits cannot change durable intent.
  const copy = JSON.parse(canonicalJson(input));
  const operation = { ...copy, payloadHash: await sha256(canonicalJson(copy)) } as SyncOperation<I>;
  await verifyOperation(operation, input.hashFormat);
  return operation;
}

export async function verifyOperation(operation: SyncOperation, hashFormat: string, maxBytes = 262144): Promise<void> {
  if (!operation || operation.protocolVersion !== 1) throw new SyncError('PROTOCOL_UNSUPPORTED');
  if (operation.hashFormat !== hashFormat) throw new SyncError('PROTOCOL_UNSUPPORTED');
  const fields = ['installationId', 'installationEpoch', 'accountId', 'scope', 'operationId', 'deviceId', 'protocolVersion', 'hashFormat', 'payloadHash', 'dependencies', 'createdAtClient', 'intent'];
  if (Object.keys(operation).length !== fields.length || Object.keys(operation).some(field => !fields.includes(field))) throw new SyncError('PAYLOAD_INVALID');
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operation.operationId)
    || !Array.isArray(operation.dependencies) || operation.dependencies.length > 100 || new Set(operation.dependencies).size !== operation.dependencies.length
    || operation.dependencies.includes(operation.operationId) || operation.dependencies.some(id => typeof id !== 'string' || !uuid.test(id))
    || ![operation.installationId, operation.installationEpoch, operation.accountId, operation.deviceId].every(id => typeof id === 'string' && id.length > 0 && id.length <= 200)
    || typeof operation.createdAtClient !== 'string' || !Number.isFinite(Date.parse(operation.createdAtClient))) throw new SyncError('PAYLOAD_INVALID');
  scopeKey(operation.scope);
  const json = canonicalJson(operation);
  if (new TextEncoder().encode(json).length > maxBytes) throw new SyncError('PAYLOAD_INVALID');
  const { payloadHash, ...intent } = operation;
  if (!/^[a-f0-9]{64}$/.test(payloadHash) || await sha256(canonicalJson(intent)) !== payloadHash) throw new SyncError('OPERATION_HASH_MISMATCH');
}

export function assertRecord(record: ReplicaRecord): void {
  if (!record || typeof record.entity !== 'string' || !record.entity || typeof record.id !== 'string' || !record.id
    || !/^(0|[1-9]\d*)$/.test(record.revision) || typeof record.deleted !== 'boolean'
    || (record.deleted ? record.value !== undefined : record.value === undefined)) throw new SyncError('PAYLOAD_INVALID');
  canonicalJson(record);
}
