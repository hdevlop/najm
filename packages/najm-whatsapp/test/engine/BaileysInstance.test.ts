import 'reflect-metadata';
import { describe, test, expect, beforeEach, afterEach, jest } from 'bun:test';
import type { SessionStore } from '../../src/engine/SessionStore';
import { setBaileysLoaderForTest, resetBaileysLoaderForTest } from '../../src/engine/BaileysRuntime';

// ── Shared mock event emitter ────────────────────────────────────────────────

const mockEv = {
  _handlers: {} as Record<string, any[]>,
  on(event: string, handler: any) {
    if (!this._handlers[event]) this._handlers[event] = [];
    this._handlers[event].push(handler);
    return this;
  },
  off(event: string, handler: any) {
    if (!this._handlers[event]) return this;
    this._handlers[event] = this._handlers[event].filter((h) => h !== handler);
    return this;
  },
  emit(event: string, ...args: any[]) {
    if (!this._handlers[event]) return;
    for (const h of this._handlers[event]) h(...args);
  },
};

const mockSocket = {
  ev: mockEv,
  user: { id: '551199988776@s.whatsapp.net', name: 'Test User' },
  end: jest.fn(),
  logout: jest.fn().mockResolvedValue(undefined),
};

const mockMakeWASocket = jest.fn().mockImplementation(() => {
  mockEv._handlers = {};
  return mockSocket;
});

// ── Module under test ─────────────────────────────────────────────────────────

const mockBaileys = {
  default: mockMakeWASocket,
  makeWASocket: mockMakeWASocket,
  Browsers: { ubuntu: (name: string) => ['Ubuntu', name, ''] },
  DisconnectReason: { loggedOut: 401 },
  fetchLatestBaileysVersion: jest.fn().mockResolvedValue({ version: [2, 3000, 1019707846], isLatest: true }),
  useMultiFileAuthState: jest.fn().mockResolvedValue({
    state: { creds: {}, keys: {} },
    saveCreds: jest.fn().mockResolvedValue(undefined),
  }),
  initAuthCreds: jest.fn().mockReturnValue({}),
  BufferJSON: { replacer: (_k: string, v: any) => v, reviver: (_k: string, v: any) => v },
  makeCacheableSignalKeyStore: jest.fn().mockImplementation((s: any) => s),
  proto: { Message: { AppStateSyncKeyData: { fromObject: (v: any) => v } } },
};

setBaileysLoaderForTest(async () => mockBaileys);

import { BaileysInstance } from '../../src/engine/BaileysInstance';
import { BaileysAdapter } from '../../src/engine/BaileysAdapter';
import { SessionStore as RealSessionStore } from '../../src/engine/SessionStore';

describe('BaileysInstance', () => {
  let instance: BaileysInstance;
  let sessionStore: RealSessionStore;

  beforeEach(() => {
    mockEv._handlers = {};
    jest.clearAllMocks();
    sessionStore = Object.assign(new RealSessionStore(), {
      config: { sessions: { driver: 'file', path: './test-sessions' } },
    } as any);
    instance = new BaileysInstance('test-instance-1', sessionStore);
  });

  afterEach(async () => {
    try { await sessionStore.deleteSession('test-instance-1'); } catch {}
    resetBaileysLoaderForTest();
    setBaileysLoaderForTest(async () => mockBaileys);
  });

  // ── connect() loads auth state and creates socket ─────────────────────

  test('connect() calls sessionStore.loadAuthState with the instance id', async () => {
    const loadSpy = jest.spyOn(sessionStore, 'loadAuthState');
    await instance.connect();
    expect(loadSpy).toHaveBeenCalledWith('test-instance-1');
  });

  test('connect() calls makeWASocket with auth state and logger', async () => {
    await instance.connect();
    expect(mockMakeWASocket).toHaveBeenCalled();
    const callArgs = mockMakeWASocket.mock.calls[0][0];
    expect(callArgs.auth).toBeTruthy();
    expect(callArgs.logger).toBeTruthy();
    expect(callArgs.version).toEqual([2, 3000, 1019707846]);
    expect(callArgs.browser).toEqual(['Ubuntu', 'Najm WhatsApp Studio', '']);
    expect(callArgs.printQRInTerminal).toBe(false);
  });

  // ── creds.update listener ───────────────────────────────────────────────

  test('creds.update listener is registered with saveCreds', async () => {
    let capturedSaveCreds: any;
    const origOn = mockEv.on.bind(mockEv);
    mockEv.on = function (event: string, handler: any) {
      if (event === 'creds.update') capturedSaveCreds = handler;
      return origOn(event, handler);
    };

    await instance.connect();

    expect(capturedSaveCreds).toBeTruthy();
    expect(typeof capturedSaveCreds).toBe('function');
  });

  // ── BaileysAdapter wrapping ─────────────────────────────────────────────

  test('connect() wraps socket in BaileysAdapter', async () => {
    await instance.connect();
    const adapter = instance.getAdapter();
    expect(adapter).toBeInstanceOf(BaileysAdapter);
  });

  // ── connection.update transitions ────────────────────────────────────

  test('qr code is captured and emitted on qr event', async () => {
    await instance.connect();
    let qrPayload: any;
    instance.onEvent('qr', (data) => { qrPayload = data; });

    mockEv.emit('connection.update', { qr: 'test-qr-123', connection: 'waiting' });

    expect(instance.qrCode).toBe('test-qr-123');
    expect(qrPayload).toBeTruthy();
    expect(qrPayload.qr).toBe('test-qr-123');
    expect(qrPayload.instanceId).toBe('test-instance-1');
  });

  test('connection.update transitions to connected on open', async () => {
    await instance.connect();
    let updatePayload: any;
    instance.onEvent('connection_update', (data) => { updatePayload = data; });

    mockEv.emit('connection.update', { connection: 'open' });

    expect(instance.status).toBe('connected');
    expect(instance.phone).toBe('551199988776@s.whatsapp.net');
    expect(updatePayload.status).toBe('connected');
    expect(updatePayload.instanceId).toBe('test-instance-1');
  });

  test('connection.update transitions to disconnected on non-logout close', async () => {
    await instance.connect();
    let updatePayload: any;
    instance.onEvent('connection_update', (data) => { updatePayload = data; });

    const { Boom } = await import('@hapi/boom');
    const disconnectError = new Boom('Session expired', { statusCode: 515 });

    mockEv.emit('connection.update', {
      connection: 'close',
      lastDisconnect: { error: disconnectError },
    });

    expect(instance.status).toBe('disconnected');
    expect(updatePayload.status).toBe('disconnected');
    expect(updatePayload.instanceId).toBe('test-instance-1');
  });

  test('status starts as connecting after connect() is called', async () => {
    // Race: status should flip to 'connecting' immediately
    const connectPromise = instance.connect();
    expect(instance.status).toBe('connecting');
    await connectPromise;
  });

  // ── message events ─────────────────────────────────────────────────────

  test('messages.upsert emits normalized message events with instanceId', async () => {
    await instance.connect();
    let msgPayload: any;
    instance.onEvent('message', (data) => { msgPayload = data; });

    mockEv.emit('messages.upsert', {
      type: 'notify',
      messages: [{
        key: { remoteJid: '551188887766@s.whatsapp.net', fromMe: false },
        message: { conversation: 'Hello there!' },
        messageTimestamp: 1234567890,
      }],
    });

    expect(msgPayload).toBeTruthy();
    expect(msgPayload.instanceId).toBe('test-instance-1');
    expect(msgPayload.from).toBe('551188887766@s.whatsapp.net');
    expect(msgPayload.fromMe).toBe(false);
    expect(msgPayload.text).toBe('Hello there!');
    expect(msgPayload.timestamp).toBe(1234567890);
    expect(msgPayload.type).toBe('notify');
    expect(msgPayload.raw).toBeTruthy();
  });

  test('extended text messages are extracted correctly', async () => {
    await instance.connect();
    let msgPayload: any;
    instance.onEvent('message', (data) => { msgPayload = data; });

    mockEv.emit('messages.upsert', {
      type: 'notify',
      messages: [{
        key: { remoteJid: '551188887766@s.whatsapp.net', fromMe: true },
        message: { extendedTextMessage: { text: 'Extended reply' } },
        messageTimestamp: 9876543210,
      }],
    });

    expect(msgPayload.text).toBe('Extended reply');
  });

  // ── group / presence events ─────────────────────────────────────────────

  test('groups.update emits group events with instanceId', async () => {
    await instance.connect();
    let groupPayload: any;
    instance.onEvent('group', (data) => { groupPayload = data; });

    mockEv.emit('groups.update', [{ id: 'group-123', subject: 'My Group' }]);

    expect(groupPayload).toBeTruthy();
    expect(groupPayload.instanceId).toBe('test-instance-1');
    expect(groupPayload.id).toBe('group-123');
  });

  test('presence.update emits presence events with instanceId', async () => {
    await instance.connect();
    let presencePayload: any;
    instance.onEvent('presence', (data) => { presencePayload = data; });

    mockEv.emit('presence.update', { id: '551188887766@s.whatsapp.net' });

    expect(presencePayload).toBeTruthy();
    expect(presencePayload.instanceId).toBe('test-instance-1');
  });

  // ── disconnect() ────────────────────────────────────────────────────────

  test('disconnect() calls socket.end()', async () => {
    await instance.connect();
    instance.disconnect();
    expect(mockSocket.end).toHaveBeenCalled();
  });

  test('disconnect() sets status to disconnected', async () => {
    await instance.connect();
    instance.disconnect();
    expect(instance.status).toBe('disconnected');
  });

  // ── logout() ────────────────────────────────────────────────────────────

  test('logout() calls socket.logout() and sessionStore.deleteSession()', async () => {
    const deleteSpy = jest.spyOn(sessionStore, 'deleteSession');
    await instance.connect();
    await instance.logout();
    expect(mockSocket.logout).toHaveBeenCalled();
    expect(deleteSpy).toHaveBeenCalledWith('test-instance-1');
  });

  test('logout() sets status to disconnected', async () => {
    await instance.connect();
    await instance.logout();
    expect(instance.status).toBe('disconnected');
  });

  // ── getAdapter() ────────────────────────────────────────────────────────

  test('getAdapter() returns BaileysAdapter', async () => {
    await instance.connect();
    expect(instance.getAdapter()).toBeInstanceOf(BaileysAdapter);
  });

  test('getAdapter() throws if not connected', () => {
    expect(() => instance.getAdapter()).toThrow(
      'Instance not connected. Call connect() first.',
    );
  });

  // ── onEvent() / wildcard ────────────────────────────────────────────────

  test('onEvent() returns unsubscribe function', async () => {
    await instance.connect();
    let count = 0;
    const handler = () => { count++; };
    const unsubscribe = instance.onEvent('connection_update', handler);

    mockEv.emit('connection.update', { connection: 'open' });
    expect(count).toBe(1);

    unsubscribe();
    mockEv.emit('connection.update', { connection: 'open' });
    expect(count).toBe(1);
  });

  test('wildcard * event receives event name and payload with instanceId', async () => {
    await instance.connect();
    let wildcardPayload: any;
    instance.onEvent('*', (data) => { wildcardPayload = data; });

    mockEv.emit('connection.update', { connection: 'open' });

    expect(wildcardPayload).toBeTruthy();
    expect(wildcardPayload.event).toBe('connection_update');
    expect(wildcardPayload.instanceId).toBe('test-instance-1');
    expect(wildcardPayload.status).toBe('connected');
  });
});
