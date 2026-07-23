import 'reflect-metadata';
import { describe, test, expect, beforeEach, jest } from 'bun:test';
import { MessageService } from '../../src/engine/MessageService';
import { MessageStoreService } from '../../src/engine/MessageStoreService';

// ── Mock BaileysAdapter ──────────────────────────────────────────────────

const mockAdapter = {
  sendText: jest.fn().mockResolvedValue({ key: { id: 'msg-1' } }),
  sendImage: jest.fn().mockResolvedValue({ key: { id: 'msg-2' } }),
  sendLocation: jest.fn().mockResolvedValue({ key: { id: 'msg-3' } }),
  readMessages: jest.fn().mockResolvedValue(undefined),
  fetchMessageHistory: jest.fn().mockResolvedValue('req-id-abc'),
};

// ── Mock BaileysInstance ─────────────────────────────────────────────────

const mockInstance = {
  getAdapter: jest.fn().mockReturnValue(mockAdapter),
};

// ── Mock InstanceManager ─────────────────────────────────────────────────

const mockInstanceManager = {
  getInstance: jest.fn().mockReturnValue(mockInstance),
};

// ── Mock MessageStoreService ─────────────────────────────────────────────

const mockMessageStore = {
  getOldestMessage: jest.fn().mockResolvedValue(null),
};

// ── Helper: create MessageService with injected mocks ────────────────────

function makeService() {
  const svc = new MessageService();
  (svc as any).instances = mockInstanceManager;
  (svc as any).messageStore = mockMessageStore;
  return svc;
}

describe('MessageService', () => {
  let service: MessageService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = makeService();
  });

  // ── sendText ────────────────────────────────────────────────────────────

  describe('sendText', () => {
    test('delegates to adapter.sendText with correct args', async () => {
      const result = await service.sendText('inst-1', '55119@s.whatsapp.net', 'Hello');

      expect(mockInstanceManager.getInstance).toHaveBeenCalledWith('inst-1');
      expect(mockInstance.getAdapter).toHaveBeenCalled();
      expect(mockAdapter.sendText).toHaveBeenCalledWith(
        '55119@s.whatsapp.net',
        'Hello',
        undefined,
      );
      expect(result as any).toEqual({ key: { id: 'msg-1' } });
    });

    test('passes options through', async () => {
      const opts = { quoted: { key: { id: 'quoted-1' } } };
      await service.sendText('inst-1', 'jid', 'text', opts);

      expect(mockAdapter.sendText).toHaveBeenCalledWith('jid', 'text', opts);
    });
  });

  // ── sendImage ───────────────────────────────────────────────────────────

  describe('sendImage', () => {
    test('delegates to adapter.sendImage with url object and caption', async () => {
      const result = await service.sendImage(
        'inst-1',
        '55119@s.whatsapp.net',
        'https://example.com/img.png',
        'A caption',
      );

      expect(mockAdapter.sendImage).toHaveBeenCalledWith(
        '55119@s.whatsapp.net',
        { url: 'https://example.com/img.png' },
        'A caption',
      );
      expect(result as any).toEqual({ key: { id: 'msg-2' } });
    });

    test('works without caption', async () => {
      await service.sendImage('inst-1', 'jid', 'https://example.com/img.png');

      expect(mockAdapter.sendImage).toHaveBeenCalledWith(
        'jid',
        { url: 'https://example.com/img.png' },
        undefined,
      );
    });
  });

  // ── sendLocation ────────────────────────────────────────────────────────

  describe('sendLocation', () => {
    test('delegates to adapter.sendLocation with all args', async () => {
      const result = await service.sendLocation(
        'inst-1',
        '55119@s.whatsapp.net',
        -23.55,
        -46.63,
        'My Place',
        'Rua XYZ, 123',
      );

      expect(mockAdapter.sendLocation).toHaveBeenCalledWith(
        '55119@s.whatsapp.net',
        -23.55,
        -46.63,
        'My Place',
        'Rua XYZ, 123',
      );
      expect(result as any).toEqual({ key: { id: 'msg-3' } });
    });

    test('works without optional name and address', async () => {
      await service.sendLocation('inst-1', 'jid', 10.0, 20.0);

      expect(mockAdapter.sendLocation).toHaveBeenCalledWith('jid', 10.0, 20.0, undefined, undefined);
    });
  });

  // ── readMessages ────────────────────────────────────────────────────────

  describe('readMessages', () => {
    test('delegates to adapter.readMessages with WAMessageKey[]', async () => {
      const keys = [
        { remoteJid: '55119@s.whatsapp.net', id: 'msg-1', fromMe: false },
      ];

      await service.readMessages('inst-1', keys);

      expect(mockAdapter.readMessages).toHaveBeenCalledWith(keys);
    });
  });

  // ── requestHistory ──────────────────────────────────────────────────────

  describe('requestHistory', () => {
    test('returns null requestId when no oldest message exists', async () => {
      mockMessageStore.getOldestMessage.mockResolvedValueOnce(null);

      const result = await service.requestHistory('inst-1', 'jid', 20);

      expect(result).toEqual({
        requestId: null,
        message: 'No messages found to use as cursor',
      });
      expect(mockAdapter.fetchMessageHistory).not.toHaveBeenCalled();
    });

    test('returns null requestId when oldest message has no waMessageId', async () => {
      mockMessageStore.getOldestMessage.mockResolvedValueOnce({
        id: 'db-1',
        instanceId: 'inst-1',
        jid: 'jid',
        fromMe: false,
        waMessageId: null,
        timestamp: '2025-01-01T00:00:00.000Z',
      });

      const result = await service.requestHistory('inst-1', 'jid', 20);

      expect(result).toEqual({
        requestId: null,
        message: 'Oldest message has no waMessageId',
      });
      expect(mockAdapter.fetchMessageHistory).not.toHaveBeenCalled();
    });

    test('calls fetchMessageHistory with oldest cursor and returns requestId', async () => {
      mockMessageStore.getOldestMessage.mockResolvedValueOnce({
        id: 'db-1',
        instanceId: 'inst-1',
        jid: '55119@s.whatsapp.net',
        fromMe: false,
        waMessageId: 'wa-msg-old-1',
        timestamp: '2025-01-01T00:00:00.000Z',
      });

      const result = await service.requestHistory('inst-1', '55119@s.whatsapp.net', 50);

      expect(mockAdapter.fetchMessageHistory).toHaveBeenCalledWith(
        50,
        { remoteJid: '55119@s.whatsapp.net', id: 'wa-msg-old-1', fromMe: false },
        Math.floor(new Date('2025-01-01T00:00:00.000Z').getTime() / 1000),
      );
      expect(result).toEqual({
        requestId: 'req-id-abc',
        message: 'History fetch initiated',
      });
    });

    test('handles numeric timestamp from oldest message', async () => {
      mockMessageStore.getOldestMessage.mockResolvedValueOnce({
        id: 'db-2',
        instanceId: 'inst-1',
        jid: 'jid',
        fromMe: true,
        waMessageId: 'wa-msg-2',
        timestamp: 1735689600,
      });

      const result = await service.requestHistory('inst-1', 'jid', 10);

      expect(mockAdapter.fetchMessageHistory).toHaveBeenCalledWith(
        10,
        { remoteJid: 'jid', id: 'wa-msg-2', fromMe: true },
        1735689600,
      );
      expect(result.requestId).toBe('req-id-abc');
    });
  });
});
