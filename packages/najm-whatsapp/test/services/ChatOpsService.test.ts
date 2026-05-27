import 'reflect-metadata';
import { describe, test, expect, beforeEach, jest } from 'bun:test';
import { ChatOpsService } from '../../src/services/ChatOpsService';

// ── Mock BaileysAdapter ──────────────────────────────────────────────────

const mockAdapter = {
  archiveChat: jest.fn().mockResolvedValue(undefined),
  pinChat: jest.fn().mockResolvedValue(undefined),
  muteChat: jest.fn().mockResolvedValue(undefined),
  deleteChat: jest.fn().mockResolvedValue(undefined),
  markRead: jest.fn().mockResolvedValue(undefined),
  readMessages: jest.fn().mockResolvedValue(undefined),
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

const mockStoredMessages = [
  { jid: '55119@s.whatsapp.net', waMessageId: 'wa-1', fromMe: false, timestamp: '1704067200' },
  { jid: '55119@s.whatsapp.net', waMessageId: 'wa-2', fromMe: true, timestamp: '1704163600' },
];

const mockMessageStore = {
  getMessages: jest.fn().mockResolvedValue(mockStoredMessages),
};

// ── Helper ───────────────────────────────────────────────────────────────

function makeService() {
  const svc = new ChatOpsService();
  (svc as any).instances = mockInstanceManager;
  (svc as any).store = mockMessageStore;
  return svc;
}

const IID = 'inst-1';
const JID = '55119@s.whatsapp.net';

describe('ChatOpsService', () => {
  let service: ChatOpsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = makeService();
  });

  // ── archiveChat ─────────────────────────────────────────────────────────

  describe('archiveChat', () => {
    test('fetches lastMessages and delegates to adapter.archiveChat', async () => {
      await service.archiveChat(IID, JID, true);

      expect(mockMessageStore.getMessages).toHaveBeenCalledWith(IID, JID, 10);
      expect(mockAdapter.archiveChat).toHaveBeenCalledWith(JID, true, [
        { key: { remoteJid: JID, id: 'wa-1', fromMe: false }, messageTimestamp: 1704067200 },
        { key: { remoteJid: JID, id: 'wa-2', fromMe: true }, messageTimestamp: 1704163600 },
      ]);
    });

    test('passes archive=false for unarchive', async () => {
      await service.archiveChat(IID, JID, false);
      expect(mockAdapter.archiveChat).toHaveBeenCalledWith(JID, false, expect.any(Array));
    });
  });

  // ── pinChat ─────────────────────────────────────────────────────────────

  describe('pinChat', () => {
    test('delegates to adapter.pinChat with exactly 2 args — no lastMessages', async () => {
      await service.pinChat(IID, JID, true);

      expect(mockMessageStore.getMessages).not.toHaveBeenCalled();
      expect(mockAdapter.pinChat).toHaveBeenCalledWith(JID, true);
      expect(mockAdapter.pinChat.mock.calls[0].length).toBe(2);
    });

    test('passes pin=false for unpin', async () => {
      await service.pinChat(IID, JID, false);
      expect(mockAdapter.pinChat).toHaveBeenCalledWith(JID, false);
    });
  });

  // ── muteChat ────────────────────────────────────────────────────────────

  describe('muteChat', () => {
    test('delegates to adapter.muteChat with duration', async () => {
      await service.muteChat(IID, JID, 86400);
      expect(mockAdapter.muteChat).toHaveBeenCalledWith(JID, 86400);
    });

    test('passes null duration for unmute', async () => {
      await service.muteChat(IID, JID, null);
      expect(mockAdapter.muteChat).toHaveBeenCalledWith(JID, null);
    });
  });

  // ── deleteChat ──────────────────────────────────────────────────────────

  describe('deleteChat', () => {
    test('fetches lastMessages and delegates to adapter.deleteChat', async () => {
      await service.deleteChat(IID, JID);

      expect(mockMessageStore.getMessages).toHaveBeenCalledWith(IID, JID, 10);
      expect(mockAdapter.deleteChat).toHaveBeenCalledWith(JID, expect.any(Array));
    });
  });

  // ── markRead ────────────────────────────────────────────────────────────

  describe('markRead', () => {
    test('fetches lastMessages and delegates to adapter.markRead', async () => {
      await service.markRead(IID, JID);

      expect(mockMessageStore.getMessages).toHaveBeenCalledWith(IID, JID, 10);
      expect(mockAdapter.markRead).toHaveBeenCalledWith(JID, expect.any(Array));
    });
  });

  // ── readMessages ────────────────────────────────────────────────────────

  describe('readMessages', () => {
    test('delegates exact keys to adapter.readMessages', async () => {
      const keys = [
        { remoteJid: JID, id: 'wa-1', fromMe: false },
        { remoteJid: JID, id: 'wa-2', fromMe: true },
      ];

      await service.readMessages(IID, keys);

      expect(mockAdapter.readMessages).toHaveBeenCalledWith(keys);
    });
  });

  // ── getLastMessages shape ──────────────────────────────────────────────

  describe('lastMessages shape', () => {
    test('maps stored messages to { key, messageTimestamp } objects', async () => {
      await service.archiveChat(IID, JID, true);

      const lastMessages = mockAdapter.archiveChat.mock.calls[0][2];
      expect(lastMessages).toHaveLength(2);
      expect(lastMessages[0]).toEqual({
        key: { remoteJid: JID, id: 'wa-1', fromMe: false },
        messageTimestamp: 1704067200,
      });
      expect(lastMessages[1]).toEqual({
        key: { remoteJid: JID, id: 'wa-2', fromMe: true },
        messageTimestamp: 1704163600,
      });
    });

    test('parses string timestamps to integers', async () => {
      await service.archiveChat(IID, JID, true);

      const lastMessages = mockAdapter.archiveChat.mock.calls[0][2];
      expect(typeof lastMessages[0].messageTimestamp).toBe('number');
      expect(typeof lastMessages[1].messageTimestamp).toBe('number');
    });

    test('parses ISO timestamps to Unix seconds', async () => {
      mockMessageStore.getMessages.mockResolvedValueOnce([
        {
          jid: JID,
          waMessageId: 'iso-1',
          fromMe: false,
          timestamp: '2025-01-01T00:00:00.000Z',
        },
      ]);

      await service.archiveChat(IID, JID, true);

      const lastMessages = mockAdapter.archiveChat.mock.calls[0][2];
      expect(lastMessages[0].messageTimestamp).toBe(1735689600);
    });
  });
});
