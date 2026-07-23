import 'reflect-metadata';
import { describe, test, expect, beforeEach, afterEach, jest } from 'bun:test';
import { InstanceManager } from '../../src/engine/InstanceManager';
import { setBaileysLoaderForTest, resetBaileysLoaderForTest } from '../../src/engine/BaileysRuntime';

// ── Mock BaileysInstance ──────────────────────────────────────────────────

const mockInstance = {
  id: '',
  status: 'disconnected' as any,
  phone: undefined as any,
  profileName: undefined as any,
  qrCode: undefined as any,
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn(),
  logout: jest.fn().mockResolvedValue(undefined),
  getAdapter: jest.fn(),
  onEvent: jest.fn().mockReturnValue(() => {}),
};

let instancesCreated: string[] = [];
const originalBaileysInstance = jest.fn().mockImplementation((id: string, _sessionStore: any) => {
  instancesCreated.push(id);
  return { ...mockInstance, id };
});

const mockBaileysModule = {
  default: jest.fn(),
  makeWASocket: jest.fn(),
  initAuthCreds: jest.fn().mockReturnValue({}),
  BufferJSON: { replacer: (_k: string, v: any) => v, reviver: (_k: string, v: any) => v },
  makeCacheableSignalKeyStore: jest.fn().mockImplementation((s: any) => s),
  proto: { Message: { AppStateSyncKeyData: { fromObject: (v: any) => v } } },
  Browsers: { ubuntu: (name: string) => ['Ubuntu', name, ''] },
  DisconnectReason: { loggedOut: 401 },
  useMultiFileAuthState: jest.fn().mockResolvedValue({ state: { creds: {}, keys: {} }, saveCreds: jest.fn() }),
};

setBaileysLoaderForTest(async () => mockBaileysModule);

(jest as any).mock('../../src/engine/BaileysInstance', () => ({
  BaileysInstance: originalBaileysInstance,
}));

import type { InstanceInfo } from '../../src/engine/InstanceManager';
import type { SessionStore } from '../../src/engine/SessionStore';

describe('InstanceManager', () => {
  let manager: InstanceManager;
  let sessionStore: SessionStore;
  let repository: any;
  let repositoryRows: Map<string, any>;

  beforeEach(() => {
    instancesCreated = [];
    jest.clearAllMocks();
    sessionStore = {
      loadAuthState: jest.fn(),
      deleteSession: jest.fn(),
      setDb: jest.fn(),
    } as any;
    repositoryRows = new Map();
    repository = {
      list: jest.fn().mockImplementation(() => Promise.resolve(Array.from(repositoryRows.values()))),
      findById: jest.fn().mockImplementation((id: string) => Promise.resolve(repositoryRows.get(id) ?? null)),
      create: jest.fn().mockImplementation(({ id, name, autoConnect }: any) => {
        const now = new Date().toISOString();
        const row = {
          id,
          name,
          status: 'disconnected',
          phone: null,
          profileName: null,
          connectedAt: null,
          lastSeenAt: null,
          autoConnect: autoConnect ?? false,
          lastError: null,
          createdAt: now,
          updatedAt: now,
        };
        repositoryRows.set(id, row);
        return Promise.resolve(row);
      }),
      updateState: jest.fn().mockImplementation((id: string, patch: any) => {
        const existing = repositoryRows.get(id);
        if (!existing) return Promise.resolve();
        Object.assign(existing, patch, { updatedAt: new Date().toISOString() });
        return Promise.resolve();
      }),
      delete: jest.fn().mockImplementation((id: string) => {
        repositoryRows.delete(id);
        return Promise.resolve();
      }),
    };
    manager = new InstanceManager();
    (manager as any).sessionStore = sessionStore;
    (manager as any).repository = repository;
    (manager as any).events = { emit: jest.fn(), emitAsync: jest.fn().mockResolvedValue(undefined) };
    (manager as any).log = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
  });

  afterEach(() => {
    resetBaileysLoaderForTest();
  });

  // ── create() ─────────────────────────────────────────────────────────────

  test('create() stores metadata and creates a BaileysInstance', async () => {
    const info = await manager.create('inst-1', 'My Instance');

    expect(info.id).toBe('inst-1');
    expect(info.name).toBe('My Instance');
    expect(info.status).toBe('disconnected');
    expect(info.createdAt).toBeTruthy();
    expect(originalBaileysInstance).toHaveBeenCalledWith('inst-1', sessionStore);
  });

  test('create() registers connection_update listener on the instance', async () => {
    await manager.create('inst-2', 'Second Instance');
    expect(mockInstance.onEvent).toHaveBeenCalledWith('connection_update', expect.any(Function));
  });

  test('create() stores the instance internally', async () => {
    await manager.create('inst-3', 'Third Instance');
    const retrieved = manager.getInstance('inst-3');
    expect(retrieved).toBeTruthy();
    expect(retrieved.id).toBe('inst-3');
  });

  test('create() throws if ID already exists', async () => {
    await manager.create('inst-dupe', 'First');
    await expect(manager.create('inst-dupe', 'Second')).rejects.toThrow(
      'Instance inst-dupe already exists',
    );
  });

  test('create() returns InstanceInfo with correct createdAt', async () => {
    const before = new Date().toISOString();
    const info = await manager.create('inst-time', 'Time Test');
    const after = new Date().toISOString();
    expect(info.createdAt >= before).toBe(true);
    expect(info.createdAt <= after).toBe(true);
  });

  // ── connect() ───────────────────────────────────────────────────────────

  test('connect() delegates to instance.connect()', async () => {
    await manager.create('inst-connect', 'Connect Test');
    await manager.connect('inst-connect');
    expect(mockInstance.connect).toHaveBeenCalled();
  });

  test('connect() throws if instance not found', async () => {
    await expect(manager.connect('nonexistent')).rejects.toThrow(
      'Instance nonexistent not found',
    );
  });

  // ── getInstance() ───────────────────────────────────────────────────────

  test('getInstance() returns the correct BaileysInstance', async () => {
    await manager.create('inst-get', 'Get Test');
    const inst = manager.getInstance('inst-get');
    expect(inst.id).toBe('inst-get');
  });

  test('getInstance() throws if instance not found', () => {
    expect(() => manager.getInstance('nonexistent')).toThrow(
      'Instance nonexistent not found',
    );
  });

  // ── getInfo() ───────────────────────────────────────────────────────────

  test('getInfo() returns InstanceInfo for existing instance', async () => {
    await manager.create('inst-info', 'Info Test');
    const info = manager.getInfo('inst-info');
    expect(info).toBeTruthy();
    expect(info!.id).toBe('inst-info');
    expect(info!.name).toBe('Info Test');
    expect(info!.status).toBe('disconnected');
  });

  test('getInfo() returns undefined for missing instance', () => {
    expect(manager.getInfo('nonexistent')).toBeUndefined();
  });

  // ── list() ───────────────────────────────────────────────────────────────

  test('list() returns all InstanceInfo objects', async () => {
    await manager.create('inst-list-1', 'List 1');
    await manager.create('inst-list-2', 'List 2');
    const all = manager.list();
    expect(all.length).toBe(2);
    expect(all.find((i) => i.id === 'inst-list-1')).toBeTruthy();
    expect(all.find((i) => i.id === 'inst-list-2')).toBeTruthy();
  });

  test('list() returns empty array when no instances exist', () => {
    expect(manager.list()).toEqual([]);
  });

  // ── disconnect() ───────────────────────────────────────────────────────

  test('disconnect() calls instance.disconnect()', async () => {
    await manager.create('inst-disc', 'Disconnect Test');
    await manager.disconnect('inst-disc');
    expect(mockInstance.disconnect).toHaveBeenCalled();
  });

  test('disconnect() updates metadata status to disconnected', async () => {
    await manager.create('inst-disc-status', 'Status Test');
    await manager.disconnect('inst-disc-status');
    const info = manager.getInfo('inst-disc-status');
    expect(info!.status).toBe('disconnected');
  });

  test('disconnect() throws if instance not found', async () => {
    await expect(manager.disconnect('nonexistent')).rejects.toThrow(
      'Instance nonexistent not found',
    );
  });

  // ── delete() ─────────────────────────────────────────────────────────────

  test('delete() disconnects a disconnected instance', async () => {
    await manager.create('inst-del', 'Delete Test');
    await manager.delete('inst-del');
    expect(mockInstance.disconnect).toHaveBeenCalled();
    expect(mockInstance.logout).not.toHaveBeenCalled();
  });

  test('delete() removes instance from the instances map', async () => {
    await manager.create('inst-del-map', 'Delete Map Test');
    await manager.delete('inst-del-map');
    expect(() => manager.getInstance('inst-del-map')).toThrow();
  });

  test('delete() removes metadata from the metadata map', async () => {
    await manager.create('inst-del-meta', 'Delete Meta Test');
    await manager.delete('inst-del-meta');
    expect(manager.getInfo('inst-del-meta')).toBeUndefined();
  });

  test('delete() does not throw when deleting non-existent instance', async () => {
    await expect(manager.delete('nonexistent')).resolves.toBeUndefined();
  });

  // ── connection_update metadata sync ──────────────────────────────────────

  test('connection_update event syncs status, phone, profileName to metadata', async () => {
    await manager.create('inst-sync', 'Sync Test');
    const info = manager.getInfo('inst-sync')!;

    // Simulate the connection_update event being fired
    const handler = mockInstance.onEvent.mock.calls.find(([evt]) => evt === 'connection_update')[1];
    handler({ status: 'connected', phone: '551199988776', profileName: 'Test User' });

    expect(info.status).toBe('connected');
    expect(info.phone).toBe('551199988776');
    expect(info.profileName).toBe('Test User');
    expect(info.connectedAt).toBeTruthy();
  });

  test('qr event updates qrCode in metadata', async () => {
    await manager.create('inst-qr', 'QR Test');
    const info = manager.getInfo('inst-qr')!;

    const handler = mockInstance.onEvent.mock.calls.find(([evt]) => evt === 'qr')[1];
    handler({ qr: 'test-qr-abc123' });

    expect(info.qrCode).toBe('test-qr-abc123');
  });
});
