import { describe, test, expect } from 'bun:test';
import { AiSettingsService } from '../src/ai-settings/AiSettingsService';
import { AiSettingsRepository } from '../src/ai-settings/AiSettingsRepository';
import type { EncryptionService } from 'najm-auth';

function buildRepoMock() {
  const state = {
    rows: [] as any[],
    getCalls: 0,
    decryptCalls: 0,
  };
  const repo: any = {
    get: async () => {
      state.getCalls++;
      return state.rows[0] ?? null;
    },
    decryptApiKey: (row: any) => {
      state.decryptCalls++;
      if (!row) return null;
      return { ...row, apiKey: 'decrypted', providerKeys: { openai: 'decrypted' }, providerModels: { openai: row.model ?? 'llama3.1' }, providerModelOptions: {} };
    },
    setEncryption: () => undefined,
  };
  return { repo, state };
}

function buildServiceMock(repo: any) {
  const encryption = { decrypt: (s: string) => s, encrypt: (s: string) => s } as unknown as EncryptionService;
  const service = new AiSettingsService(repo as any, encryption);
  return service;
}

describe('Phase 2 (C2) — single-flight AI settings cache', () => {
  test('multiple concurrent cold getInternal() calls produce a single repo.get() and decrypt', async () => {
    const { repo, state } = buildRepoMock();
    state.rows = [{ id: '1', provider: 'openai', model: 'gpt-4o', apiKeyEncrypted: 'enc' }];
    const service = buildServiceMock(repo);

    const [a, b, c] = await Promise.all([
      service.getInternal(),
      service.getInternal(),
      service.getInternal(),
    ]);

    expect(a).not.toBeNull();
    expect(b).toBe(a);
    expect(c).toBe(a);
    expect(state.getCalls).toBe(1);
    expect(state.decryptCalls).toBe(1);
  });

  test('calls within TTL reuse the exact cached result', async () => {
    const { repo, state } = buildRepoMock();
    state.rows = [{ id: '1', provider: 'openai', model: 'gpt-4o', apiKeyEncrypted: 'enc' }];
    const service = buildServiceMock(repo);

    const first = await service.getInternal();
    const second = await service.getInternal();
    const third = await service.getInternal();

    expect(first).toBe(second);
    expect(second).toBe(third);
    expect(state.getCalls).toBe(1);
    expect(state.decryptCalls).toBe(1);
  });

  test('expiry causes a single new shared load', async () => {
    const { repo, state } = buildRepoMock();
    state.rows = [{ id: '1', provider: 'openai', model: 'gpt-4o', apiKeyEncrypted: 'enc' }];
    const service = buildServiceMock(repo);
    (service as any).cacheTtlMs = 20;

    await service.getInternal();
    expect(state.getCalls).toBe(1);

    await new Promise((r) => setTimeout(r, 30));

    const [a, b] = await Promise.all([service.getInternal(), service.getInternal()]);
    expect(a).toBe(b);
    expect(state.getCalls).toBe(2);
  });

  test('successful upsert() invalidates the internal cache', async () => {
    const { repo, state } = buildRepoMock();
    state.rows = [{ id: '1', provider: 'openai', model: 'gpt-4o', apiKeyEncrypted: 'enc' }];
    const service = buildServiceMock(repo);
    (repo as any).update = async (id: string, data: any) => {
      const updated = { ...state.rows[0], ...data, id };
      state.rows[0] = updated;
      return updated;
    };
    (repo as any).toPublic = (row: any) => row;
    (repo as any).readProviderKeys = () => ({});
    (repo as any).readProviderModels = () => ({});
    (repo as any).readProviderModelOptions = () => ({});
    (repo as any).serializeProviderModels = (_: any, provider: string) => 'gpt-4o';
    (repo as any).encryptProviderKeys = () => 'enc';

    await service.getInternal();
    const callsBefore = state.getCalls;
    expect(callsBefore).toBe(1);

    await service.upsert({ provider: 'openai', model: 'gpt-4o' } as any);

    const after = await service.getInternal();
    expect(state.getCalls).toBeGreaterThan(callsBefore);
    expect(after).not.toBeNull();
  });

  test('successful update() invalidates the internal cache', async () => {
    const { repo, state } = buildRepoMock();
    state.rows = [{ id: '1', provider: 'openai', model: 'gpt-4o', apiKeyEncrypted: 'enc' }];
    const service = buildServiceMock(repo);
    (repo as any).update = async (id: string, data: any) => {
      const updated = { ...state.rows[0], ...data, id };
      state.rows[0] = updated;
      return updated;
    };
    (repo as any).toPublic = (row: any) => row;
    (repo as any).readProviderKeys = () => ({});
    (repo as any).readProviderModels = () => ({});
    (repo as any).readProviderModelOptions = () => ({});
    (repo as any).serializeProviderModels = (_: any, provider: string) => 'gpt-4o';
    (repo as any).encryptProviderKeys = () => 'enc';

    await service.getInternal();
    const callsBefore = state.getCalls;
    expect(callsBefore).toBe(1);

    await service.update({ model: 'gpt-4o-mini' } as any);

    const after = await service.getInternal();
    expect(state.getCalls).toBeGreaterThan(callsBefore);
    expect(after).not.toBeNull();
  });

  test('a slow pre-update load cannot overwrite the cache with stale settings', async () => {
    const { repo, state } = buildRepoMock();
    state.rows = [{ id: '1', provider: 'openai', model: 'gpt-4o', apiKeyEncrypted: 'enc' }];
    const service = buildServiceMock(repo);

    let resolveFirstLoad: (value: any) => void = () => undefined;
    let getCount = 0;
    (repo as any).get = () => {
      getCount++;
      if (getCount === 1) {
        return Promise.resolve(state.rows[0]);
      }
      return new Promise<any>((resolve) => { resolveFirstLoad = resolve; });
    };
    (repo as any).update = async (id: string, data: any) => {
      const updated = { ...state.rows[0], ...data, id };
      state.rows[0] = updated;
      return updated;
    };
    (repo as any).toPublic = (row: any) => row;
    (repo as any).readProviderKeys = () => ({});
    (repo as any).readProviderModels = () => ({});
    (repo as any).readProviderModelOptions = () => ({});
    (repo as any).serializeProviderModels = (_: any, provider: string) => 'gpt-4o';
    (repo as any).encryptProviderKeys = () => 'enc';

    await service.getInternal();
    (service as any).internalCache = null;

    const pendingRead = service.getInternal();

    (service as any).invalidateInternalCache();

    resolveFirstLoad({ id: '1', provider: 'openai', model: 'gpt-stale', apiKeyEncrypted: 'enc' });
    await pendingRead;

    (repo as any).get = async () => {
      state.getCalls++;
      return state.rows[0];
    };

    const fresh = await service.getInternal();
    expect((fresh as any).model).toBe('gpt-4o');
  });

  test('failed write does not discard a valid cache entry', async () => {
    const { repo, state } = buildRepoMock();
    state.rows = [{ id: '1', provider: 'openai', model: 'gpt-4o', apiKeyEncrypted: 'enc' }];
    const service = buildServiceMock(repo);
    (repo as any).update = async () => {
      throw new Error('db write failed');
    };
    (repo as any).readProviderKeys = () => ({});
    (repo as any).readProviderModels = () => ({});
    (repo as any).readProviderModelOptions = () => ({});
    (repo as any).serializeProviderModels = (_: any, provider: string) => 'gpt-4o';

    const first = await service.getInternal();
    expect(first).not.toBeNull();
    const callsAfterFirst = state.getCalls;
    expect(callsAfterFirst).toBe(1);

    await expect(service.update({ model: 'gpt-4o-mini' } as any)).rejects.toThrow('db write failed');
    const callsAfterFailedUpdate = state.getCalls;

    const cached = await service.getInternal();
    expect(cached).toBe(first);
    expect(state.getCalls).toBe(callsAfterFailedUpdate);
  });

  test('cached null is returned inside TTL without a new load', async () => {
    const { repo, state } = buildRepoMock();
    state.rows = [];
    const service = buildServiceMock(repo);

    const a = await service.getInternal();
    const b = await service.getInternal();
    const c = await service.getInternal();

    expect(a).toBeNull();
    expect(b).toBeNull();
    expect(c).toBeNull();
    expect(state.getCalls).toBe(1);
  });
});
