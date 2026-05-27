import 'reflect-metadata';
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { SessionStore } from '../../src/engine/SessionStore';

function createMockDb() {
  const tables: Record<string, any[]> = {};

  const sessionsTable = { id: 'id', instanceId: 'instanceId', creds: 'creds', createdAt: 'createdAt', updatedAt: 'updatedAt' };
  const keysTable = { id: 'id', instanceId: 'instanceId', keyType: 'keyType', keyId: 'keyId', value: 'value' };

  function runQuery(tableKey: string): any[] {
    return tables[tableKey] ?? [];
  }

  const mockDb = {
    select: () => ({
      from: (t: any) => {
        const tableKey = t.instanceId;
        // where() returns a thenable — await select().from().where() resolves to the rows
        const queryObj: any = {
          then: (resolve: (val: any[]) => void, _reject: any) => {
            resolve(tables[tableKey] ?? []);
          },
          where: (_cond: any) => queryObj,
          limit: (n: number) => Promise.resolve(tables[tableKey] ?? []),
        };
        return queryObj;
      },
    }),
    insert: (t: any) => ({
      values: (v: any) => ({
        onConflictDoUpdate: ({ target: _target, set: _set }: any) => {
          const tableKey = t.instanceId;
          const existingIdx = tables[tableKey]?.findIndex((r: any) => r.instanceId === v.instanceId);
          if (existingIdx !== undefined && existingIdx >= 0) {
            tables[tableKey][existingIdx] = { ...tables[tableKey][existingIdx], ...v };
          } else {
            tables[tableKey] = [...(tables[tableKey] ?? []), v];
          }
          return {};
        },
      }),
    }),
    delete: (t: any) => ({
      where: (_cond: any) => {
        const tableKey = t.instanceId;
        tables[tableKey] = [];
        return {};
      },
    }),
  };

  const schema = {
    whatsappSessions: sessionsTable,
    whatsappSessionKeys: keysTable,
  };

  return { db: mockDb, schema, tables };
}

describe('SessionStore DB Driver', () => {
  let store: SessionStore;
  let mock: ReturnType<typeof createMockDb>;
  let mockDb: ReturnType<typeof createMockDb>['db'];
  let schema: ReturnType<typeof createMockDb>['schema'];
  let tables: Record<string, any[]>;

  beforeEach(() => {
    mock = createMockDb();
    mockDb = mock.db;
    schema = mock.schema;
    tables = mock.tables;
    store = Object.assign(new SessionStore(), {
      db: mockDb,
      schema,
      config: { sessions: { driver: 'db' } },
    } as any);
  });

  afterEach(() => {
    for (const key of Object.keys(tables)) {
      tables[key] = [];
    }
  });

  // --- get() returns decoded values ---

  test('get returns decoded values for stored keys', async () => {
    const instanceId = 'test-instance-1';
    const keyRecord = {
      id: 'key-1',
      instanceId,
      keyType: 'prekey',
      keyId: 'prekey-1',
      value: JSON.stringify({ key: 'value1' }),
    };
    (tables as any)[schema.whatsappSessionKeys.instanceId] = [keyRecord];

    const { state } = await store.loadAuthState(instanceId);
    const result = await state.keys.get('pre-key', ['prekey-1']);

    expect(result['prekey-1']).toBeTruthy();
    expect((result['prekey-1'] as any).key).toBe('value1');
  });

  // --- set() inserts and updates ---

  test('set inserts new keys', async () => {
    const instanceId = 'test-instance-2';

    const { state } = await store.loadAuthState(instanceId);

    await state.keys.set({
      'pre-key': {
        'prekey-99': { key: 'new-value' } as any,
      },
    });

    const rows = (tables as any)[schema.whatsappSessionKeys.instanceId] as any[];
    expect(rows.length).toBeGreaterThan(0);
    const inserted = rows.find((r: any) => r.keyId === 'prekey-99');
    expect(inserted).toBeTruthy();
    expect(inserted.value).toContain('new-value');
  });

  test('set updates existing keys (upsert)', async () => {
    const instanceId = 'test-instance-3';
    const existingRecord = {
      id: 'key-existing',
      instanceId,
      keyType: 'prekey',
      keyId: 'prekey-1',
      value: JSON.stringify({ key: 'old-value' }),
    };
    (tables as any)[schema.whatsappSessionKeys.instanceId] = [existingRecord];

    const { state } = await store.loadAuthState(instanceId);

    await state.keys.set({
      'pre-key': {
        'prekey-1': { key: 'updated-value' } as any,
      },
    });

    const rows = (tables as any)[schema.whatsappSessionKeys.instanceId] as any[];
    const updated = rows.find((r: any) => r.keyId === 'prekey-1');
    expect(updated).toBeTruthy();
    expect(updated.value).toContain('updated-value');
  });

  // --- set() with falsy value deletes the row ---

  test('set with falsy value deletes the key row', async () => {
    const instanceId = 'test-instance-4';
    const existingRecord = {
      id: 'key-to-delete',
      instanceId,
      keyType: 'prekey',
      keyId: 'prekey-deleteme',
      value: JSON.stringify({ key: 'to-be-deleted' }),
    };
    (tables as any)[schema.whatsappSessionKeys.instanceId] = [existingRecord];

    const { state } = await store.loadAuthState(instanceId);

    await state.keys.set({
      'pre-key': {
        'prekey-deleteme': null as any,
      },
    });

    const rows = (tables as any)[schema.whatsappSessionKeys.instanceId] as any[];
    const deleted = rows.find((r: any) => r.keyId === 'prekey-deleteme');
    expect(deleted).toBeUndefined();
  });

  // --- app-state-sync-key reconstruction ---
  // Note: AppStateSyncKeyData.fromObject base64-decodes keyData (string→Buffer) and
  // converts fingerprint array (number[]) to Uint8Array.
  test('app-state-sync-key values are reconstructed with proto.Message.AppStateSyncKeyData.fromObject', async () => {
    const instanceId = 'test-instance-5';
    const syncKeyData = {
      keyData: 'YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eQ==', // base64 string — fromObject decodes to Buffer
      fingerprint: [1, 2, 3, 4, 5, 6, 7, 8],          // array of bytes → Uint8Array after fromObject
      timestamp: 1234567890,
    };
    const keyRecord = {
      id: 'sync-key-1',
      instanceId,
      keyType: 'app-state-sync-key',
      keyId: 'sync-key-id-1',
      value: JSON.stringify(syncKeyData),
    };
    (tables as any)[schema.whatsappSessionKeys.instanceId] = [keyRecord];

    const { state } = await store.loadAuthState(instanceId);
    const result = await state.keys.get('app-state-sync-key', ['sync-key-id-1']);

    expect(result['sync-key-id-1']).toBeTruthy();
    const reconstructed = result['sync-key-id-1'] as any;
    // keyData is decoded from base64 to a Buffer
    expect(Buffer.isBuffer(reconstructed.keyData)).toBe(true);
    expect(reconstructed.keyData.toString('base64')).toBe(syncKeyData.keyData);
    // fingerprint is converted to AppStateSyncKeyFingerprint proto instance
    expect(reconstructed.fingerprint).toBeTruthy();
    expect((reconstructed.timestamp as any).toNumber()).toBe(syncKeyData.timestamp);
  });

  // --- saveCreds inserts on first call, updates on second ---

  test('saveCreds inserts creds on first call', async () => {
    const instanceId = 'test-instance-6';
    const { state, saveCreds } = await store.loadAuthState(instanceId);

    (state.creds as any).me = { id: 'test-user' };
    await saveCreds();

    const rows = (tables as any)[schema.whatsappSessions.instanceId] as any[];
    expect(rows.length).toBe(1);
    expect(rows[0].instanceId).toBe(instanceId);
    expect(rows[0].creds).toContain('test-user');
  });

  test('saveCreds updates creds on second call', async () => {
    const instanceId = 'test-instance-7';

    const { state: s1, saveCreds: sc1 } = await store.loadAuthState(instanceId);
    (s1.creds as any).me = { id: 'user-1' };
    await sc1();

    const { state: s2, saveCreds: sc2 } = await store.loadAuthState(instanceId);
    (s2.creds as any).me = { id: 'user-2' };
    await sc2();

    const rows = (tables as any)[schema.whatsappSessions.instanceId] as any[];
    expect(rows.length).toBe(1);
    expect(rows[0].creds).toContain('user-2');
  });

  // --- clear() removes all keys for the instance ---

  test('clear removes all keys for the instance', async () => {
    const instanceId = 'test-instance-8';
    const existingKeys = [
      { id: 'k1', instanceId, keyType: 'prekey', keyId: 'k1', value: JSON.stringify({ a: 1 }) },
      { id: 'k2', instanceId, keyType: 'prekey', keyId: 'k2', value: JSON.stringify({ a: 2 }) },
      { id: 'k3', instanceId, keyType: 'app-state-sync-key', keyId: 'k3', value: JSON.stringify({ b: 1 }) },
    ];
    (tables as any)[schema.whatsappSessionKeys.instanceId] = [...existingKeys];

    const { state } = await store.loadAuthState(instanceId);
    await state.keys.clear();

    const rows = (tables as any)[schema.whatsappSessionKeys.instanceId] as any[];
    expect(rows.length).toBe(0);
  });

  // --- deleteSession removes both creds and keys ---

  test('deleteSession removes both creds and keys from DB', async () => {
    const instanceId = 'test-instance-9';
    (tables as any)[schema.whatsappSessions.instanceId] = [
      { id: 's1', instanceId, creds: JSON.stringify({}), createdAt: new Date().toISOString() },
    ];
    (tables as any)[schema.whatsappSessionKeys.instanceId] = [
      { id: 'k1', instanceId, keyType: 'prekey', keyId: 'k1', value: JSON.stringify({}) },
      { id: 'k2', instanceId, keyType: 'prekey', keyId: 'k2', value: JSON.stringify({}) },
    ];

    await store.deleteSession(instanceId);

    const sessionRows = (tables as any)[schema.whatsappSessions.instanceId] as any[];
    const keyRows = (tables as any)[schema.whatsappSessionKeys.instanceId] as any[];
    expect(sessionRows.length).toBe(0);
    expect(keyRows.length).toBe(0);
  });
});