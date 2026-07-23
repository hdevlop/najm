import 'reflect-metadata';
import { describe, test, expect } from 'bun:test';
import { createHmac } from 'crypto';
import { WhatsAppController } from '../src/WhatsAppController';
import { WHATSAPP_CONFIG } from '../src/tokens';

const SECRET = 'test-webhook-secret';
const VERIFY_TOKEN = 'test-verify-token';

function makeController() {
  const ctrl = new WhatsAppController();
  (ctrl as any).config = {
    phoneNumberId: '123',
    accessToken: 'test',
    verifyToken: VERIFY_TOKEN,
    webhookSecret: SECRET,
    apiVersion: 'v20.0',
  };
  (ctrl as any).log = { info: () => {}, warn: () => {}, debug: () => {} };
  (ctrl as any).events = { emit: () => {} };
  return ctrl;
}

function makeCtx(headers: Record<string, string> = {}) {
  return {
    req: {
      header: (name: string) => headers[name] ?? null,
      text: async () => '',
    },
    text: (body: string) => body,
    json: (body: any, status?: number) => ({ body, status }),
  } as any;
}

function signPayload(payload: string): string {
  return 'sha256=' + createHmac('sha256', SECRET).update(payload).digest('hex');
}

describe('WhatsApp Webhook Signature Verification', () => {
  test('valid signature passes', () => {
    const ctrl = makeController();
    const payload = '{"object":"whatsapp_business_account"}';
    const ctx = makeCtx({ 'x-hub-signature-256': signPayload(payload) });

    const result = ctrl.verifySignature(ctx, payload);
    expect(result).toBe(true);
  });

  test('missing signature header rejects', () => {
    const ctrl = makeController();
    const ctx = makeCtx();
    const result = ctrl.verifySignature(ctx, '{}');
    expect(result).toBe(false);
  });

  test('wrong prefix rejects', () => {
    const ctrl = makeController();
    const ctx = makeCtx({ 'x-hub-signature-256': 'sha1=abc' });
    const result = ctrl.verifySignature(ctx, '{}');
    expect(result).toBe(false);
  });

  test('tampered payload rejects', () => {
    const ctrl = makeController();
    const payload = '{"object":"whatsapp_business_account"}';
    const ctx = makeCtx({ 'x-hub-signature-256': signPayload(payload) });

    const result = ctrl.verifySignature(ctx, payload + 'tampered');
    expect(result).toBe(false);
  });

  test('wrong secret rejects', () => {
    const ctrl = makeController();
    const payload = '{"object":"whatsapp_business_account"}';
    const wrongSig = 'sha256=' + createHmac('sha256', 'wrong-secret').update(payload).digest('hex');
    const ctx = makeCtx({ 'x-hub-signature-256': wrongSig });

    const result = ctrl.verifySignature(ctx, payload);
    expect(result).toBe(false);
  });
});
