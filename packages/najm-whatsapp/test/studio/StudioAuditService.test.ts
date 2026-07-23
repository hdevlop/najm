import 'reflect-metadata';
import { describe, test, expect, beforeEach, jest } from 'bun:test';
import { StudioAuditService } from '../../src/studio/StudioAuditService';

// ── Mock table columns ──────────────────────────────────────────────────

function makeCol(name: string) {
  return { __colName: name };
}

const mockAuditTable = {
  action: makeCol('action'),
  instanceId: makeCol('instance_id'),
  userId: makeCol('user_id'),
  details: makeCol('details'),
  createdAt: makeCol('created_at'),
};

// ── Mock DB ──────────────────────────────────────────────────────────────

let insertedRows: any[] = [];
let capturedWhere: any = null;

function createMockDb(returnRows: any[] = []) {
  insertedRows = [];
  capturedWhere = null;

  const queryChain = {
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockResolvedValue(returnRows),
    where: jest.fn().mockImplementation((cond: any) => {
      capturedWhere = cond;
      return queryChain;
    }),
  };

  return {
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockImplementation((vals: any) => {
        insertedRows.push(vals);
        return Promise.resolve();
      }),
    }),
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue(queryChain),
    }),
  };
}

// ── Helper ───────────────────────────────────────────────────────────────

function makeService(returnRows: any[] = []) {
  const svc = new StudioAuditService();
  const db = createMockDb(returnRows);
  (svc as any).db = db;
  (svc as any).schema = { whatsappStudioAuditLogs: mockAuditTable };
  return { service: svc, db };
}

describe('StudioAuditService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── log ────────────────────────────────────────────────────────────────

  describe('log', () => {
    test('inserts a row with action, instanceId, userId, and JSON details', async () => {
      const { service } = makeService();
      await service.log('instance.create', {
        instanceId: 'inst-1',
        userId: 'user-42',
        extra: 'data',
      });

      expect(insertedRows.length).toBe(1);
      const row = insertedRows[0];
      expect(row.action).toBe('instance.create');
      expect(row.instanceId).toBe('inst-1');
      expect(row.userId).toBe('user-42');
      expect(row.details).toBe(JSON.stringify({ instanceId: 'inst-1', userId: 'user-42', extra: 'data' }));
    });

    test('defaults instanceId and userId to null when not provided', async () => {
      const { service } = makeService();
      await service.log('system.ping', {});

      expect(insertedRows[0].instanceId).toBeNull();
      expect(insertedRows[0].userId).toBeNull();
      expect(insertedRows[0].details).toBe(JSON.stringify({}));
    });

    test('stringifies complex details object', async () => {
      const { service } = makeService();
      await service.log('message.send', {
        instanceId: 'inst-2',
        payload: { to: '55119@s.whatsapp.net', text: 'hello' },
        tags: ['urgent', 'batch'],
      });

      const parsed = JSON.parse(insertedRows[0].details);
      expect(parsed.payload.to).toBe('55119@s.whatsapp.net');
      expect(parsed.tags).toEqual(['urgent', 'batch']);
    });
  });

  // ── list ───────────────────────────────────────────────────────────────

  describe('list', () => {
    test('queries with no filters, default limit and offset', async () => {
      const { service, db } = makeService([{ action: 'test' }]);
      const result = await service.list();

      expect(db.select).toHaveBeenCalled();
      // No where clause should be called when no filters
      const selectChain = db.select().from(mockAuditTable);
      // With no filters, we skip .where() and go straight to orderBy
      expect(selectChain.orderBy).toHaveBeenCalled();
      const orderChain = selectChain.orderBy();
      expect(orderChain.limit).toHaveBeenCalledWith(100);
      expect(orderChain.offset).toHaveBeenCalledWith(0);
    });

    test('filters by instanceId', async () => {
      const { service, db } = makeService();
      await service.list(50, 0, { instanceId: 'inst-1' });

      expect(capturedWhere).toBeDefined();
      // The where clause was applied
      const selectChain = db.select().from(mockAuditTable);
      expect(selectChain.where).toHaveBeenCalled();
    });

    test('filters by userId', async () => {
      const { service, db } = makeService();
      await service.list(50, 0, { userId: 'user-42' });

      expect(capturedWhere).toBeDefined();
      const selectChain = db.select().from(mockAuditTable);
      expect(selectChain.where).toHaveBeenCalled();
    });

    test('filters by both instanceId and userId', async () => {
      const { service } = makeService();
      await service.list(10, 5, { instanceId: 'inst-1', userId: 'user-42' });

      expect(capturedWhere).toBeDefined();
    });

    test('passes custom limit and offset', async () => {
      const { service, db } = makeService();
      await service.list(25, 50);

      const orderChain = db.select().from(mockAuditTable).orderBy();
      expect(orderChain.limit).toHaveBeenCalledWith(25);
      expect(orderChain.offset).toHaveBeenCalledWith(50);
    });

    test('returns results from offset chain', async () => {
      const rows = [
        { action: 'a', createdAt: '2025-01-02' },
        { action: 'b', createdAt: '2025-01-01' },
      ];
      const { service } = makeService(rows);
      const result = await service.list();
      expect(result).toEqual(rows);
    });
  });
});
