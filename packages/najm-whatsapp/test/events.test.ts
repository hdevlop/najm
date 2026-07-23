import 'reflect-metadata';
import { describe, test, expect, afterEach } from 'bun:test';
import { Server } from 'najm-core';
import { events, EventService } from 'najm-event';
import { WhatsAppController } from '../src/WhatsAppController';
import { createHmac } from 'crypto';

const CONFIG = {
  phoneNumberId: '1234567890',
  accessToken: 'test-token',
  verifyToken: 'my-verify-token',
  webhookSecret: 'my-webhook-secret',
  apiVersion: 'v20.0',
};

let server: Server;

afterEach(async () => {
  if (server) await server.stop();
});

function signPayload(payload: string): string {
  return 'sha256=' + createHmac('sha256', CONFIG.webhookSecret).update(payload).digest('hex');
}

function makeController(eventService: any) {
  const ctrl = new WhatsAppController();
  (ctrl as any).config = CONFIG;
  (ctrl as any).log = { info: () => {}, warn: () => {}, debug: () => {} };
  (ctrl as any).events = eventService;
  return ctrl;
}

function makeWebhookCtx(payload: string, sigHeader?: string) {
  return {
    req: {
      header: (name: string) => name === 'x-hub-signature-256' ? (sigHeader ?? signPayload(payload)) : null,
      text: async () => payload,
    },
    json: (body: any, status?: number) => ({ body, status: status ?? 200 }),
  } as any;
}

describe('WhatsApp Webhook Events', () => {
  test('POST /whatsapp/webhook emits whatsapp.message event for incoming messages', async () => {
    let receivedMessage: any = null;

    server = await new Server({ isolated: true })
      .use(events())
      .listen(5101);

    const eventService = await (server as any).container.resolve(EventService);
    eventService.on('whatsapp.message', (msg: any) => {
      receivedMessage = msg;
    });

    const ctrl = makeController(eventService);

    const payload = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: '1234567890',
              id: 'wamid.test',
              timestamp: '1234567890',
              type: 'text',
              text: { body: 'Hello from WhatsApp' },
            }],
          },
        }],
      }],
    });

    const result = await ctrl.webhook(makeWebhookCtx(payload));
    expect(result.status).toBe(200);

    expect(receivedMessage).not.toBeNull();
    expect(receivedMessage.from).toBe('1234567890');
    expect(receivedMessage.text).toBe('Hello from WhatsApp');
    expect(receivedMessage.messageId).toBe('wamid.test');
    expect(receivedMessage.type).toBe('text');
  });

  test('POST /whatsapp/webhook emits whatsapp.status event', async () => {
    let receivedStatus: any = null;

    server = await new Server({ isolated: true })
      .use(events())
      .listen(5102);

    const eventService = await (server as any).container.resolve(EventService);
    eventService.on('whatsapp.status', (s: any) => {
      receivedStatus = s;
    });

    const ctrl = makeController(eventService);

    const payload = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            statuses: [{
              id: 'wamid.status',
              recipient_id: '1234567890',
              status: 'delivered',
              timestamp: '1234567890',
            }],
          },
        }],
      }],
    });

    const result = await ctrl.webhook(makeWebhookCtx(payload));
    expect(result.status).toBe(200);
    expect(receivedStatus).not.toBeNull();
    expect(receivedStatus.status).toBe('delivered');
    expect(receivedStatus.from).toBe('1234567890');
  });

  test('GET /whatsapp/webhook verifies with correct token', () => {
    const ctrl = makeController(null);

    const ctx = {
      text: (body: string) => body,
      json: (body: any, status?: number) => ({ body, status }),
    } as any;

    const result = ctrl.verify('subscribe', 'my-verify-token', 'challenge-123', ctx);
    expect(result as any).toBe('challenge-123');
  });

  test('GET /whatsapp/webhook rejects wrong token', () => {
    const ctrl = makeController(null);

    const ctx = {
      text: (body: string) => body,
      json: (body: any, status?: number) => ({ body, status }),
    } as any;

    const result = ctrl.verify('subscribe', 'wrong-token', 'challenge-123', ctx);
    expect(result.status).toBe(403);
  });

  test('POST /whatsapp/webhook rejects invalid signature', async () => {
    server = await new Server({ isolated: true })
      .use(events())
      .listen(5103);

    const eventService = await (server as any).container.resolve(EventService);
    const ctrl = makeController(eventService);

    const payload = '{"object":"whatsapp_business_account"}';
    const result = await ctrl.webhook(makeWebhookCtx(payload, 'sha256=invalidhex'));
    expect(result.status).toBe(401);
  });
});
