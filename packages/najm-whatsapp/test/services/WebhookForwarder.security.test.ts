import 'reflect-metadata';
import { describe, test, expect, beforeEach, afterEach, jest } from 'bun:test';
import { WebhookForwarder, assertSafeUrl, verifyWebhookSignature } from '../../src/services/WebhookForwarder';

const originalFetch = globalThis.fetch;

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

let insertedRows: any[] = [];
let fetchCalls: any[] = [];

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

beforeEach(() => {
  jest.clearAllMocks();
  insertedRows = [];
  fetchCalls = [];
  globalThis.fetch = jest.fn().mockImplementation(async (url: string, opts: any) => {
    fetchCalls.push({ url, opts });
    return new Response('', { status: 200 });
  }) as any;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('assertSafeUrl', () => {
  test('rejects literal private ipv4 (10.x)', async () => {
    const result = await assertSafeUrl('http://10.0.0.5/webhook');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('private_ip');
  });

  test('rejects loopback (127.0.0.1)', async () => {
    const result = await assertSafeUrl('http://127.0.0.1:3000/hook');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('private_ip');
  });

  test('rejects non-http(s) schemes', async () => {
    const result = await assertSafeUrl('file:///etc/passwd');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('scheme_not_allowed');
  });

  test('rejects link-local ipv6 (fe80::)', async () => {
    // The URL constructor treats fe80::1 as a hostname (no brackets needed in
    // new URL when it has a port). The test confirms the underlying private-IP
    // check rejects the literal address even before DNS resolution.
    const result = await assertSafeUrl('http://[fe80::1]/');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/private_ip|dns_private_ip|invalid_url/);
  });

  test('rejects malformed URL', async () => {
    const result = await assertSafeUrl('not-a-url');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('invalid_url');
  });

  test('respects allowedHosts allowlist', async () => {
    const result = await assertSafeUrl('https://example.com/hook', {
      allowedHosts: ['allowed.example.com'],
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('host_not_allowed');
  });

  test('allowPrivateNetworks=true short-circuits DNS check', async () => {
    const result = await assertSafeUrl('http://10.0.0.5/wh', { allowPrivateNetworks: true });
    expect(result.ok).toBe(true);
  });
});

describe('verifyWebhookSignature', () => {
  const body = '{"event":"test"}';
  const secret = 'shhh-secret';
  const { createHmac } = require('crypto') as typeof import('crypto');
  const sig = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');

  test('valid signature passes', () => {
    expect(verifyWebhookSignature(body, sig, secret)).toBe(true);
  });

  test('missing header fails', () => {
    expect(verifyWebhookSignature(body, null, secret)).toBe(false);
  });

  test('wrong prefix fails', () => {
    expect(verifyWebhookSignature(body, 'md5=abc', secret)).toBe(false);
  });

  test('tampered body fails', () => {
    expect(verifyWebhookSignature(body + 'tamper', sig, secret)).toBe(false);
  });
});

describe('WebhookForwarder — signing & protected headers', () => {
  function makeService(opts: any = {}) {
    const svc = new WebhookForwarder();
    (svc as any).config = {
      webhooks: opts.webhooks ?? [],
      webhookSigningSecret: opts.signingSecret,
      webhookSecurity: { allowPrivateNetworks: true },
    };
    (svc as any).db = createMockDb();
    (svc as any).schema = { whatsappWebhookEvents: mockWebhookEventsTable };
    (svc as any).webhooks = { listForEvent: jest.fn().mockResolvedValue([]) };
    (svc as any).log = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
    return svc;
  }

  test('attaches x-najm-signature-256 when signing secret is set', async () => {
    const service = makeService({
      webhooks: [{ url: 'https://hook.example.com' }],
      signingSecret: 'shhh',
    });
    await service.forward('message', { text: 'hi' });
    const headers = fetchCalls[0].opts.headers;
    expect(headers['X-Najm-Signature-256']).toMatch(/^sha256=[a-f0-9]{64}$/);
    expect(headers['X-Najm-Delivery-Id']).toBeTruthy();
    expect(headers['X-Najm-Timestamp']).toBeTruthy();
  });

  test('omits signature when no signing secret is configured', async () => {
    const service = makeService({
      webhooks: [{ url: 'https://hook.example.com' }],
    });
    await service.forward('message', { text: 'hi' });
    const headers = fetchCalls[0].opts.headers;
    expect(headers['X-Najm-Signature-256']).toBeUndefined();
    expect(headers['X-Najm-Delivery-Id']).toBeTruthy();
  });

  test('user headers cannot override protected headers', async () => {
    const service = makeService({
      webhooks: [{
        url: 'https://hook.example.com',
        headers: {
          'Content-Type': 'text/plain',
          'X-Najm-Signature-256': 'sha256=bogus',
          'X-Najm-Delivery-Id': 'fake-id',
          'X-Najm-Timestamp': 'fake-ts',
          'X-Custom': 'allowed',
        },
      }],
      signingSecret: 'shhh',
    });
    await service.forward('message', { text: 'hi' });
    const headers = fetchCalls[0].opts.headers;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-Najm-Signature-256']).not.toBe('sha256=bogus');
    expect(headers['X-Najm-Delivery-Id']).not.toBe('fake-id');
    expect(headers['X-Najm-Timestamp']).not.toBe('fake-ts');
    expect(headers['X-Custom']).toBe('allowed');
  });
});

describe('WebhookForwarder.deliverTest', () => {
  function makeService(opts: any = {}) {
    const svc = new WebhookForwarder();
    (svc as any).config = { webhooks: [], webhookSecurity: opts.security ?? { allowPrivateNetworks: true } };
    (svc as any).db = createMockDb();
    (svc as any).schema = { whatsappWebhookEvents: mockWebhookEventsTable };
    (svc as any).webhooks = { listForEvent: jest.fn().mockResolvedValue([]) };
    (svc as any).log = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
    return svc;
  }

  test('calls only the requested URL', async () => {
    const service = makeService();
    const result = await service.deliverTest('https://hook.example.com', 'message', { test: true });
    expect(result.status).toBe('sent');
    expect(fetchCalls.length).toBe(1);
    expect(fetchCalls[0].url).toBe('https://hook.example.com');
    const body = JSON.parse(fetchCalls[0].opts.body);
    expect(body.eventType).toBe('message');
    expect(body.payload).toEqual({ test: true });
  });

  test('returns failure for unreachable host', async () => {
    globalThis.fetch = jest.fn().mockImplementation(() => {
      throw new Error('ECONNREFUSED');
    }) as any;
    const service = makeService();
    const result = await service.deliverTest('https://hook.example.com', 'message');
    expect(result.status).toBe('failed');
  });

  test('rejects private-network URLs by default', async () => {
    const service = makeService({ security: { allowPrivateNetworks: false } });
    const result = await service.deliverTest('http://10.0.0.5/wh', 'message');
    expect(result.status).toBe('failed');
    expect(result.error).toBe('private_ip');
    expect(fetchCalls.length).toBe(0);
  });
});

describe('WebhookForwarder runtime forward() — SSRF + per-target outcome', () => {
  function makeService(opts: any = {}) {
    const svc = new WebhookForwarder();
    (svc as any).config = { webhooks: opts.webhooks ?? [], webhookSecurity: opts.security ?? { allowPrivateNetworks: true } };
    (svc as any).db = createMockDb();
    (svc as any).schema = { whatsappWebhookEvents: mockWebhookEventsTable };
    (svc as any).webhooks = { listForEvent: jest.fn().mockResolvedValue(opts.dynamic ?? []) };
    (svc as any).log = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
    return svc;
  }

  test('records per-target outcome, not a single combined status', async () => {
    const service = makeService({
      webhooks: [
        { url: 'https://hook-good.example.com' },
        { url: 'https://hook-bad.example.com' },
      ],
    });
    const callLog: string[] = [];
    globalThis.fetch = jest.fn().mockImplementation(async (url: string) => {
      callLog.push(url);
      if (url.includes('hook-bad')) return new Response('boom', { status: 500 });
      return new Response('', { status: 200 });
    }) as any;
    await service.forward('message', { text: 'hi' });
    // 5xx responses are retried once per the retry contract; 2xx is one call.
    const goodCalls = callLog.filter((u) => u.includes('hook-good')).length;
    const badCalls = callLog.filter((u) => u.includes('hook-bad')).length;
    expect(goodCalls).toBe(1);
    expect(badCalls).toBeGreaterThanOrEqual(1);
    expect(insertedRows[0].forwardStatus).toBe('partial');
    const payload = JSON.parse(insertedRows[0].payload);
    expect(payload._delivery.targets).toHaveLength(2);
    expect(payload._delivery.targets[0].status).toBe('sent');
    expect(payload._delivery.targets[1].status).toBe('failed');
  });
});
