import 'reflect-metadata';
import { afterEach, describe, expect, test } from 'bun:test';
import { Server } from 'najm-core';
import { ChatAgent } from '../src/agent/ChatAgent';
import { ChatController } from '../src/chat/ChatController';
import { CHATBOT_CONFIG } from '../src/tokens';

// An app may load the published ChatController without chatbot(), as School's
// year-boundary test does. 3.8.0 injected the chatbot config and failed to start.

let server: Server | undefined;
afterEach(async () => {
  await server?.stop();
  server = undefined;
});

const ctx = {
  json: (body: unknown, status = 200) => ({ body, status }),
  req: { raw: { signal: new AbortController().signal } },
} as any;

async function boot(config?: object) {
  const calls: unknown[] = [];
  server = new Server({ isolated: true, silent: true }).load({ ChatController });
  server.container.set(ChatAgent, { stream: async (input: unknown) => { calls.push(input); return { status: 200 }; } });
  if (config) server.container.set(CHATBOT_CONFIG, config);
  await server.init();
  const controller = await server.container.resolve(ChatController) as ChatController;
  return { controller, calls };
}

const user = (text: string) => ({ role: 'user', content: text });

describe('ChatController without chatbot()', () => {
  test('starts and applies the default request limits', async () => {
    const { controller, calls } = await boot();
    expect(await controller.chat({ messages: [user('hi')] }, ctx)).toEqual({ status: 200 });
    expect(calls).toHaveLength(1);
    const refused: any = await controller.chat({ messages: Array.from({ length: 201 }, () => user('x')) }, ctx);
    expect(refused.status).toBe(400);
  });

  test('uses chatRequestLimits from a registered chatbot config', async () => {
    const { controller, calls } = await boot({ chatRequestLimits: { maxMessages: 1 } });
    const refused: any = await controller.chat({ messages: [user('a'), user('b')] }, ctx);
    expect(refused.status).toBe(400);
    expect(calls).toHaveLength(0);
  });
});
