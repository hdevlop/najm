import 'reflect-metadata';
import { describe, test, expect, beforeEach, afterEach, jest } from 'bun:test';
import { AiResponderService } from '../../src/services/AiResponderService';
import { WA_SCHEMA } from '../../src/tokens';
import { AI_DEFAULT_LIMITS } from '../../src/dto/ai-config.dto';

interface ConfigRow {
  instanceId: string;
  enabled: boolean;
  provider?: string;
  model?: string;
  systemPrompt?: string;
  temperature?: string;
  limits?: string | null;
  updatedAt?: string;
}

function makeCol(name: string) {
  return { __colName: name };
}

const mockAiColumns = {
  instanceId: makeCol('instance_id'),
  enabled: makeCol('enabled'),
  provider: makeCol('provider'),
  model: makeCol('model'),
  systemPrompt: makeCol('system_prompt'),
  temperature: makeCol('temperature'),
  limits: makeCol('limits'),
  updatedAt: makeCol('updated_at'),
};

function createMockDb() {
  const rows: ConfigRow[] = [];
  return {
    rows,
    select: jest.fn().mockReturnValue({
      from: () => ({
        where: () => ({
          limit: (n: number) => Promise.resolve(rows.slice(0, n)),
        }),
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
        where: (cond: any) => {
          const idx = rows.findIndex((r) => r.instanceId === 'inst-6');
          if (idx >= 0) Object.assign(rows[idx], patch);
          return Promise.resolve();
        },
      }),
    }),
  };
}

function createMockCache() {
  const counters = new Map<string, { count: number; expiresAt: number }>();
  return {
    counters,
    incr: jest.fn().mockImplementation(async (key: string, ttlMs: number) => {
      const now = Date.now();
      const existing = counters.get(key);
      if (existing && existing.expiresAt <= now) counters.delete(key);
      const current = counters.get(key);
      const count = (current?.count ?? 0) + 1;
      counters.set(key, { count, expiresAt: now + (ttlMs ?? 60_000) });
      return { count, resetAt: now + (ttlMs ?? 60_000) };
    }),
  };
}

function makeService() {
  const svc = new AiResponderService();
  (svc as any).db = createMockDb();
  (svc as any).schema = { whatsappAiConfigs: mockAiColumns };
  (svc as any).cache = createMockCache();
  (svc as any).log = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
  (svc as any).messages = { sendText: jest.fn().mockResolvedValue(undefined) };
  return svc;
}

describe('AiResponderService', () => {
  let service: AiResponderService;
  let originalKey: string | undefined;

  beforeEach(() => {
    service = makeService();
    originalKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'sk-test-key-1234567890';
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  });

  test('returns false when AI is disabled', async () => {
    await service.upsertConfig({ instanceId: 'inst-1', enabled: false });
    const result = await service.respond('inst-1', 'hello', 'jid-1');
    expect(result).toBe(false);
  });

  test('returns false when no API key is configured', async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    await service.upsertConfig({ instanceId: 'inst-2', enabled: true, provider: 'openai' });
    const result = await service.respond('inst-2', 'hello', 'jid-1');
    expect(result).toBe(false);
  });

  test('throttles after requestsPerMinute is exceeded', async () => {
    await service.upsertConfig({
      instanceId: 'inst-3',
      enabled: true,
      provider: 'openai',
      limits: { ...AI_DEFAULT_LIMITS, requestsPerMinute: 2 },
    });
    // First two should pass through to provider (which fails harmlessly), third is throttled.
    await service.respond('inst-3', 'a', 'jid');
    await service.respond('inst-3', 'b', 'jid');
    const result = await service.respond('inst-3', 'c', 'jid');
    expect(result).toBe(false);
  });

  test('throttles after requestsPerDay is exceeded', async () => {
    await service.upsertConfig({
      instanceId: 'inst-4',
      enabled: true,
      provider: 'openai',
      limits: { ...AI_DEFAULT_LIMITS, requestsPerMinute: 1000, requestsPerDay: 1 },
    });
    await service.respond('inst-4', 'a', 'jid');
    const result = await service.respond('inst-4', 'b', 'jid');
    expect(result).toBe(false);
  });

  test('truncates input to maxInputChars before provider call', async () => {
    await service.upsertConfig({
      instanceId: 'inst-5',
      enabled: true,
      provider: 'openai',
      limits: { ...AI_DEFAULT_LIMITS, maxInputChars: 4 },
    });
    // Use a fetch stub to capture the body the service would send.
    const originalFetch = globalThis.fetch;
    let capturedBody = '';
    globalThis.fetch = jest.fn().mockImplementation(async (_url: string, init: any) => {
      capturedBody = init?.body ?? '';
      return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 });
    }) as any;
    try {
      const result = await service.respond('inst-5', 'abcdefgh', 'jid');
      const parsed = JSON.parse(capturedBody);
      expect(parsed.messages[1].content).toBe('abcd');
      expect(result).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('caches AI config per instance and invalidates on update', async () => {
    await service.upsertConfig({ instanceId: 'inst-6', enabled: false });
    const first = await service.getHydratedConfig('inst-6');
    expect(first?.enabled).toBe(false);
    await service.upsertConfig({ instanceId: 'inst-6', enabled: true });
    const second = await service.getHydratedConfig('inst-6');
    expect(second?.enabled).toBe(true);
  });
});
