import assert from 'node:assert/strict';
import { SyncError, sealOperation } from '../../dist/sync/contracts.mjs';
import { applyOperation } from '../../dist/sync/server.mjs';
import { syncRows } from '../../dist/sync/pg.mjs';
import { synchronizeReplica } from '../../dist/sync/client.mjs';

// Exercise the shipped entry graph. Source-module tests alone cannot detect
// duplicated error constructors introduced by independent entry bundling.
const operation = await sealOperation({ installationId: 'surface-installation', installationEpoch: 'surface-epoch',
  accountId: 'surface-account', scope: { kind: 'year', yearLabel: '2026-2027' }, operationId: crypto.randomUUID(),
  deviceId: 'surface-device', protocolVersion: 1, hashFormat: 'surface-v1-sha256', dependencies: [],
  createdAtClient: new Date().toISOString(), intent: { command: 'surface' } });
await assert.rejects(applyOperation({ operation: { ...operation, payloadHash: 'f'.repeat(64) }, hashFormat: operation.hashFormat,
  store: { transaction: async () => assert.fail('Invalid hash reached the store') },
  authorize: async () => assert.fail('Invalid hash reached authorization'), apply: async () => assert.fail('Invalid hash reached the adapter'),
}), error => error instanceof SyncError && error.code === 'OPERATION_HASH_MISMATCH');
assert.throws(() => syncRows(null), error => error instanceof SyncError && error.code === 'DATABASE_RESULT_UNSUPPORTED');
assert.equal(globalThis.navigator?.locks, undefined, 'This surface proof runs without browser coordination');
await assert.rejects(synchronizeReplica({ replica: {} as any, captured: {} as any }),
  error => error instanceof SyncError && error.code === 'COORDINATION_UNAVAILABLE');
console.log('Built server, PostgreSQL and client errors share the public SyncError class: PASS');
