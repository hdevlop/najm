import 'reflect-metadata';
import { describe, test, expect, mock } from 'bun:test';
import { WhatsAppService } from '../src/WhatsAppService';
import { WHATSAPP_CONFIG } from '../src/tokens';

const CONFIG = {
  phoneNumberId: '1234567890',
  accessToken: 'test-token',
  verifyToken: 'test-verify',
  webhookSecret: 'test-secret',
  apiVersion: 'v20.0',
};

function makeService(fetchFn: any) {
  const svc = new WhatsAppService();
  (svc as any).config = CONFIG;
  (svc as any).log = { info: () => {}, warn: () => {}, debug: () => {}, error: () => {} };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchFn;

  return {
    service: svc,
    restore() {
      globalThis.fetch = originalFetch;
    },
  };
}

function jsonResponse(data: any, status = 200): Promise<Response> {
  return Promise.resolve(new Response(JSON.stringify(data), { status }));
}

describe('WhatsAppService — sendText', () => {
  test('sends a short text in one request', async () => {
    const calls: any[] = [];
    const { service, restore } = makeService(async (url: string, opts: any) => {
      calls.push({ url, body: JSON.parse(opts.body) });
      return jsonResponse({ messaging_product: 'whatsapp', contacts: [], messages: [{ id: 'wamid.1' }] });
    });

    const results = await service.sendText('123456', 'hello');
    restore();

    expect(calls.length).toBe(1);
    expect(calls[0].body.text.body).toBe('hello');
    expect(results.length).toBe(1);
  });

  test('auto-chunks text over 4096 chars', async () => {
    const calls: any[] = [];
    const longText = 'a'.repeat(5000);
    const { service, restore } = makeService(async (url: string, opts: any) => {
      calls.push({ body: JSON.parse(opts.body) });
      return jsonResponse({ messaging_product: 'whatsapp', contacts: [], messages: [{ id: 'wamid.1' }] });
    });

    const results = await service.sendText('123456', longText);
    restore();

    expect(calls.length).toBe(2);
    expect(calls[0].body.text.body.length).toBeLessThanOrEqual(4096);
    const totalLen = calls.reduce((sum, c) => sum + c.body.text.body.length, 0);
    expect(totalLen).toBe(5000);
  });

  test('sends correct Authorization header', async () => {
    let headers: any;
    const { service, restore } = makeService(async (_: string, opts: any) => {
      headers = opts.headers;
      return jsonResponse({ messaging_product: 'whatsapp', contacts: [], messages: [{ id: 'wamid.1' }] });
    });

    await service.sendText('123456', 'test');
    restore();

    expect(headers['Authorization']).toBe('Bearer test-token');
    expect(headers['Content-Type']).toBe('application/json');
  });

  test('throws on API error', async () => {
    const { service, restore } = makeService(async () => {
      return new Response('Unauthorized', { status: 401 });
    });

    expect(service.sendText('123456', 'test')).rejects.toThrow('WhatsApp API error 401');
    restore();
  });
});

describe('WhatsAppService — sendTemplate', () => {
  test('sends template with parameters', async () => {
    let body: any;
    const { service, restore } = makeService(async (_: string, opts: any) => {
      body = JSON.parse(opts.body);
      return jsonResponse({ messaging_product: 'whatsapp', contacts: [], messages: [{ id: 'wamid.1' }] });
    });

    await service.sendTemplate('123456', 'auth_otp', 'en', [
      { type: 'text', text: '123456' },
    ]);
    restore();

    expect(body.type).toBe('template');
    expect(body.template.name).toBe('auth_otp');
    expect(body.template.language.code).toBe('en');
    expect(body.template.components[0].parameters[0].text).toBe('123456');
  });

  test('sends template without parameters', async () => {
    let body: any;
    const { service, restore } = makeService(async (_: string, opts: any) => {
      body = JSON.parse(opts.body);
      return jsonResponse({ messaging_product: 'whatsapp', contacts: [], messages: [{ id: 'wamid.1' }] });
    });

    await service.sendTemplate('123456', 'welcome', 'en');
    restore();

    expect(body.template.name).toBe('welcome');
    expect(body.template.components).toBeUndefined();
  });
});

describe('WhatsAppService — sendMedia', () => {
  test('sends image with URL and caption', async () => {
    let body: any;
    const { service, restore } = makeService(async (_: string, opts: any) => {
      body = JSON.parse(opts.body);
      return jsonResponse({ messaging_product: 'whatsapp', contacts: [], messages: [{ id: 'wamid.1' }] });
    });

    await service.sendMedia('123456', 'image', { url: 'https://example.com/img.png' }, 'A caption');
    restore();

    expect(body.type).toBe('image');
    expect(body.image.link).toBe('https://example.com/img.png');
    expect(body.image.caption).toBe('A caption');
  });

  test('sends document by media ID', async () => {
    let body: any;
    const { service, restore } = makeService(async (_: string, opts: any) => {
      body = JSON.parse(opts.body);
      return jsonResponse({ messaging_product: 'whatsapp', contacts: [], messages: [{ id: 'wamid.1' }] });
    });

    await service.sendMedia('123456', 'document', { id: 'media-id-123' });
    restore();

    expect(body.document.id).toBe('media-id-123');
  });
});
