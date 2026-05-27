import 'reflect-metadata';
import { describe, test, expect, beforeEach, jest } from 'bun:test';
import { ContactService } from '../../src/services/ContactService';

// ── Mock BaileysAdapter ──────────────────────────────────────────────────

const mockAdapter = {
  addOrEditContact: jest.fn().mockResolvedValue(undefined),
};

// ── Mock BaileysInstance ─────────────────────────────────────────────────

const mockInstance = {
  getAdapter: jest.fn().mockReturnValue(mockAdapter),
};

// ── Mock InstanceManager ─────────────────────────────────────────────────

const mockInstanceManager = {
  getInstance: jest.fn().mockReturnValue(mockInstance),
};

// ── Mock Drizzle table columns ───────────────────────────────────────────

function makeCol(name: string) {
  return { __colName: name };
}

const mockContactsTable = {
  instanceId: makeCol('instance_id'),
  jid: makeCol('jid'),
  phone: makeCol('phone'),
  name: makeCol('name'),
  pushName: makeCol('push_name'),
  profilePictureUrl: makeCol('profile_picture_url'),
  isBusiness: makeCol('is_business'),
  labels: makeCol('labels'),
  lastMessageAt: makeCol('last_message_at'),
};

// ── Mock DB ──────────────────────────────────────────────────────────────

let insertedRows: any[] = [];
let conflictUpdates: any[] = [];

function createMockDb() {
  insertedRows = [];
  conflictUpdates = [];

  const queryChain = {
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockResolvedValue([]),
  };

  return {
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockImplementation((vals: any) => {
        insertedRows.push(vals);
        return {
          onConflictDoUpdate: jest.fn().mockImplementation((opts: any) => {
            conflictUpdates.push(opts);
            return Promise.resolve();
          }),
        };
      }),
    }),
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue(queryChain),
      }),
    }),
  };
}

// ── Helper ───────────────────────────────────────────────────────────────

function makeService() {
  const svc = new ContactService();
  (svc as any).instances = mockInstanceManager;
  const db = createMockDb();
  (svc as any).db = db;
  (svc as any).schema = { whatsappContacts: mockContactsTable };
  return { service: svc, db };
}

describe('ContactService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── addOrEdit ───────────────────────────────────────────────────────────

  describe('addOrEdit', () => {
    test('delegates to adapter.addOrEditContact with jid and contact', async () => {
      const { service } = makeService();
      const contact = { fullName: 'John', phone: '55119' };
      await service.addOrEdit('inst-1', '55119@s.whatsapp.net', contact);

      expect(mockInstanceManager.getInstance).toHaveBeenCalledWith('inst-1');
      expect(mockAdapter.addOrEditContact).toHaveBeenCalledWith('55119@s.whatsapp.net', contact);
    });
  });

  // ── list ────────────────────────────────────────────────────────────────

  describe('list', () => {
    test('queries whatsappContacts with eq(instanceId), limit, offset', async () => {
      const { service, db } = makeService();
      await service.list('inst-1', 20, 5);

      expect(db.select).toHaveBeenCalled();
      expect(db.select().from(mockContactsTable).where).toHaveBeenCalled();
      const chain = db.select().from(mockContactsTable).where(jest.fn());
      // The query chain's limit and offset were called
      expect(db.select().from(mockContactsTable).where().limit).toHaveBeenCalledWith(20);
      expect(db.select().from(mockContactsTable).where().offset).toHaveBeenCalledWith(5);
    });

    test('uses default limit=50 and offset=0', async () => {
      const { service, db } = makeService();
      await service.list('inst-1');

      expect(db.select().from(mockContactsTable).where().limit).toHaveBeenCalledWith(50);
      expect(db.select().from(mockContactsTable).where().offset).toHaveBeenCalledWith(0);
    });
  });

  // ── sync ────────────────────────────────────────────────────────────────

  describe('sync', () => {
    test('inserts contacts with correct field mapping', async () => {
      const { service } = makeService();
      await service.sync('inst-1', [
        {
          jid: '55119@s.whatsapp.net',
          phone: '55119',
          name: 'John',
          pushName: 'Johnny',
          profilePictureUrl: 'https://pic.url',
          isBusiness: true,
          labels: ['work', 'vip'],
          lastMessageAt: '2025-01-01T00:00:00.000Z',
        },
      ]);

      expect(insertedRows.length).toBe(1);
      const row = insertedRows[0];
      expect(row.instanceId).toBe('inst-1');
      expect(row.jid).toBe('55119@s.whatsapp.net');
      expect(row.phone).toBe('55119');
      expect(row.name).toBe('John');
      expect(row.pushName).toBe('Johnny');
      expect(row.profilePictureUrl).toBe('https://pic.url');
      expect(row.isBusiness).toBe(true);
      expect(row.labels).toBe(JSON.stringify(['work', 'vip']));
      expect(row.lastMessageAt).toBe('2025-01-01T00:00:00.000Z');
      expect(row.id).toBeTruthy();
    });

    test('JSON-stringifies labels', async () => {
      const { service } = makeService();
      await service.sync('inst-1', [
        { jid: 'jid-a', labels: { tag: 'important' } },
      ]);

      expect(insertedRows[0].labels).toBe(JSON.stringify({ tag: 'important' }));
    });

    test('leaves labels undefined when not provided', async () => {
      const { service } = makeService();
      await service.sync('inst-1', [
        { jid: 'jid-b', name: 'Alice' },
      ]);

      expect(insertedRows[0].labels).toBeUndefined();
    });

    test('uses onConflictDoUpdate targeting (instanceId, jid)', async () => {
      const { service } = makeService();
      await service.sync('inst-1', [
        {
          jid: 'jid-c',
          name: 'Bob',
          pushName: 'Bobby',
          profilePictureUrl: 'https://new.pic',
          lastMessageAt: '2025-06-01T00:00:00.000Z',
        },
      ]);

      expect(conflictUpdates.length).toBe(1);
      const opts = conflictUpdates[0];
      expect(opts.target).toEqual([mockContactsTable.instanceId, mockContactsTable.jid]);
      expect(opts.set).toEqual({
        phone: undefined,
        name: 'Bob',
        pushName: 'Bobby',
        profilePictureUrl: 'https://new.pic',
        isBusiness: undefined,
        labels: undefined,
        lastMessageAt: '2025-06-01T00:00:00.000Z',
      });
    });

    test('inserts multiple contacts in order', async () => {
      const { service } = makeService();
      await service.sync('inst-1', [
        { jid: 'jid-1', name: 'A' },
        { jid: 'jid-2', name: 'B' },
        { jid: 'jid-3', name: 'C' },
      ]);

      expect(insertedRows.length).toBe(3);
      expect(insertedRows[0].jid).toBe('jid-1');
      expect(insertedRows[1].jid).toBe('jid-2');
      expect(insertedRows[2].jid).toBe('jid-3');
    });
  });
});
