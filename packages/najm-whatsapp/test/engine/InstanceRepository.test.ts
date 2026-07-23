import 'reflect-metadata';
import { describe, test, expect, beforeEach, jest } from 'bun:test';
import { InstanceRepository } from '../../src/engine/InstanceRepository';
import { WA_SCHEMA } from '../../src/tokens';

function makeCol(name: string) {
  return { __colName: name };
}

const mockInstanceColumns = {
  id: makeCol('id'),
  name: makeCol('name'),
  status: makeCol('status'),
  phone: makeCol('phone'),
  profileName: makeCol('profile_name'),
  connectedAt: makeCol('connected_at'),
  lastSeenAt: makeCol('last_seen_at'),
  autoConnect: makeCol('auto_connect'),
  lastError: makeCol('last_error'),
  createdAt: makeCol('created_at'),
  updatedAt: makeCol('updated_at'),
};

function createMockDb() {
  const rows: any[] = [];
  return {
    rows,
    select: jest.fn().mockReturnValue({
      from: () => ({
        where: (cond: any) => ({
          limit: (n: number) => Promise.resolve(rows.slice(0, n)),
        }),
        orderBy: (col: any) => Promise.resolve([...rows]),
      }),
    }),
    insert: jest.fn().mockReturnValue({
      values: (v: any) => {
        rows.push(v);
        return Promise.resolve();
      },
    }),
    update: jest.fn().mockReturnValue({
      set: (patch: any) => ({
        where: (cond: any) => Promise.resolve(),
      }),
    }),
    delete: jest.fn().mockReturnValue({
      where: (cond: any) => {
        rows.length = 0;
        return Promise.resolve();
      },
    }),
  };
}

describe('InstanceRepository', () => {
  let repository: InstanceRepository;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDb();
    repository = new InstanceRepository();
    (repository as any).db = mockDb;
    (repository as any).schema = { whatsappInstances: mockInstanceColumns };
  });

  test('create() persists exactly one row with defaults', async () => {
    const row = await repository.create({ id: 'inst-1', name: 'My Instance' });
    expect(row.id).toBe('inst-1');
    expect(row.name).toBe('My Instance');
    expect(row.status).toBe('disconnected');
    expect(row.autoConnect).toBe(false);
    expect(mockDb.rows.length).toBe(1);
  });

  test('create() honors explicit autoConnect', async () => {
    const row = await repository.create({ id: 'inst-2', name: 'Auto', autoConnect: true });
    expect(row.autoConnect).toBe(true);
  });

  test('updateState() writes a partial patch', async () => {
    await repository.create({ id: 'inst-3', name: 'Patch' });
    await repository.updateState('inst-3', { status: 'connected', lastError: null });
    expect(mockDb.update).toHaveBeenCalled();
  });

  test('updateState() is a no-op when only updatedAt would change', async () => {
    await repository.create({ id: 'inst-4', name: 'Empty Patch' });
    mockDb.update.mockClear();
    await repository.updateState('inst-4', {});
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  test('delete() removes the row', async () => {
    await repository.create({ id: 'inst-5', name: 'Del' });
    expect(mockDb.rows.length).toBe(1);
    await repository.delete('inst-5');
    expect(mockDb.rows.length).toBe(0);
  });

  test('list() returns empty array when schema is missing', async () => {
    (repository as any).schema = {};
    expect(await repository.list()).toEqual([]);
  });
});
