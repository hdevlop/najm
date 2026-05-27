import 'reflect-metadata';
import { describe, test, expect, beforeEach, jest } from 'bun:test';
import { LabelService } from '../../src/services/LabelService';

// ── Mock BaileysAdapter ──────────────────────────────────────────────────

const mockAdapter = {
  addChatLabel: jest.fn().mockResolvedValue(undefined),
  removeChatLabel: jest.fn().mockResolvedValue(undefined),
  addLabel: jest.fn().mockResolvedValue(undefined),
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

const mockLabelsTable = {
  instanceId: makeCol('instance_id'),
  name: makeCol('name'),
  color: makeCol('color'),
  predefined: makeCol('predefined'),
};

// ── Mock DB ──────────────────────────────────────────────────────────────

const mockSelectResult = [{ id: '1', name: 'VIP', color: 'red' }];

function createMockDb() {
  return {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(mockSelectResult),
      }),
    }),
  };
}

// ── Helper ───────────────────────────────────────────────────────────────

function makeService() {
  const svc = new LabelService();
  (svc as any).instances = mockInstanceManager;
  (svc as any).db = createMockDb();
  (svc as any).schema = { whatsappLabels: mockLabelsTable };
  return svc;
}

const IID = 'inst-1';
const JID = '55119@s.whatsapp.net';

describe('LabelService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('addChatLabel() delegates to adapter.addChatLabel', async () => {
    const service = makeService();
    await service.addChatLabel(IID, JID, 'label-1');
    expect(mockInstanceManager.getInstance).toHaveBeenCalledWith(IID);
    expect(mockAdapter.addChatLabel).toHaveBeenCalledWith(JID, 'label-1');
  });

  test('removeChatLabel() delegates to adapter.removeChatLabel', async () => {
    const service = makeService();
    await service.removeChatLabel(IID, JID, 'label-2');
    expect(mockAdapter.removeChatLabel).toHaveBeenCalledWith(JID, 'label-2');
  });

  test('addLabel() delegates to adapter.addLabel', async () => {
    const service = makeService();
    const labels = [{ id: 'l1', name: 'Work' }];
    await service.addLabel(IID, JID, labels);
    expect(mockAdapter.addLabel).toHaveBeenCalledWith(JID, labels);
  });

  test('list() queries whatsappLabels with eq(instanceId)', async () => {
    const service = makeService();
    const result = await service.list(IID);
    expect(result).toEqual(mockSelectResult);
  });
});
