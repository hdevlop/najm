import 'reflect-metadata';
import { describe, test, expect, beforeEach, afterEach, jest } from 'bun:test';
import { WebhookForwarder } from '../../src/services/WebhookForwarder';

// ── Mock Drizzle table columns ───────────────────────────────────────────

function makeCol(name: string) {
  return { __colName: name };
}

const mockWebhookEventsTable = {
  instanceId: makeCol('instance_id'),
  eventType: makeCol('event_type'),
  payload: makeCol('payload'),
  forwardStatus: makeCol('forward_status'),
  createdAt: makeCol('created_at'),
};

// ── Mock DB ──────────────────────────────────────────────────────────────

let insertedRows: any[] = [];

function createMockDb() {
  insertedRows = [];
  return {
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockImplementation((vals: any) => {
        insertedRows.push(vals);
        return Promise.resolve();
      }),
    }),
  };
}

// ── Mock fetch ───────────────────────────────────────────────────────────

let fetchCalls: any[] = [];
const originalFetch = globalThis.fetch;

function mockFetch() {
  fetchCalls = [];
  globalThis.fetch = jest.fn().mockImplementation(async (url: string, opts: any) => {
    fetchCalls.push({ url, opts });
    return new Response('', { status: 200 });
  }) as any;
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

// ── Helper ───────────────────────────────────────────────────────────────

function makeService(webhooks: any[] = []) {
  const svc = new WebhookForwarder();
  (svc as any).config = { webhooks };
  (svc as any).db = createMockDb();
  (svc as any).schema = { whatsappWebhookEvents: mockWebhookEventsTable };
  (svc as any).webhooks = { listForEvent: jest.fn().mockResolvedValue([]) };
  return svc;
}

describe('WebhookForwarder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch();
  });

  afterEach(() => {
    restoreFetch();
  });

  test('sends POST to all configured webhooks', async () => {
    const service = makeService([
      { url: 'https://hook1.example.com' },
      { url: 'https://hook2.example.com' },
    ]);

    await service.forward('message', { text: 'Hello' }, 'inst-1');

    expect(fetchCalls.length).toBe(2);
    expect(fetchCalls[0].url).toBe('https://hook1.example.com');
    expect(fetchCalls[1].url).toBe('https://hook2.example.com');
  });

  test('sends correct JSON body with eventType, instanceId, payload, timestamp', async () => {
    const service = makeService([
      { url: 'https://hook.example.com' },
    ]);

    await service.forward('message', { text: 'Hi' }, 'inst-1');

    const body = JSON.parse(fetchCalls[0].opts.body);
    expect(body.eventType).toBe('message');
    expect(body.instanceId).toBe('inst-1');
    expect(body.payload).toEqual({ text: 'Hi' });
    expect(body.timestamp).toBeTruthy();
  });

  test('filters webhooks by events list', async () => {
    const service = makeService([
      { url: 'https://hook-messages.com', events: ['message'] },
      { url: 'https://hook-status.com', events: ['status'] },
    ]);

    await service.forward('message', { text: 'Hi' });

    expect(fetchCalls.length).toBe(1);
    expect(fetchCalls[0].url).toBe('https://hook-messages.com');
  });

  test('forwards to webhook with no events filter (receives all)', async () => {
    const service = makeService([
      { url: 'https://hook-all.com' },
      { url: 'https://hook-filtered.com', events: ['status'] },
    ]);

    await service.forward('message', {});

    expect(fetchCalls.length).toBe(1);
    expect(fetchCalls[0].url).toBe('https://hook-all.com');
  });

  test('merges custom headers with Content-Type', async () => {
    const service = makeService([
      { url: 'https://hook.example.com', headers: { 'X-Custom': 'abc', 'Authorization': 'Bearer token123' } },
    ]);

    await service.forward('message', {});

    const headers = fetchCalls[0].opts.headers;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-Custom']).toBe('abc');
    expect(headers['Authorization']).toBe('Bearer token123');
  });

  test('persists event to DB with correct shape', async () => {
    const service = makeService([]);

    await service.forward('message', { text: 'Hello' }, 'inst-1');

    expect(insertedRows.length).toBe(1);
    const row = insertedRows[0];
    expect(row.instanceId).toBe('inst-1');
    expect(row.eventType).toBe('message');
    expect(row.payload).toBe(JSON.stringify({ text: 'Hello' }));
    expect(row.forwardStatus).toBe('sent');
    expect(row.createdAt).toBeTruthy();
  });

  test('persists even when no webhooks are configured', async () => {
    const service = makeService([]);

    await service.forward('status', { status: 'delivered' });

    expect(fetchCalls.length).toBe(0);
    expect(insertedRows.length).toBe(1);
  });

  test('persists with null instanceId when not provided', async () => {
    const service = makeService([]);

    await service.forward('message', {});

    expect(insertedRows[0].instanceId).toBeNull();
  });

  test('silently handles fetch errors and still persists', async () => {
    globalThis.fetch = jest.fn().mockImplementation(() => {
      throw new Error('Network error');
    }) as any;

    const service = makeService([
      { url: 'https://failing.example.com' },
    ]);

    await service.forward('message', { text: 'test' }, 'inst-1');

    expect(insertedRows.length).toBe(1);
    expect(insertedRows[0].forwardStatus).toBe('failed');
  });
});
