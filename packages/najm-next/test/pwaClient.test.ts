import { expect, test } from 'bun:test';
import { connectNajmPwaClient } from '../src/pwaClient';

function fixture(scope = 'https://school.example/app/') {
  const messages: string[] = [];
  const worker = { postMessage(data: any, ports: MessagePort[]) {
    messages.push(data.type);
    ports[0].postMessage({ protocol: 1, cacheId: 'school', cacheVersion: 'v2', ready: true, activated: true });
    ports[0].close();
  } };
  const container = Object.assign(new EventTarget(), {
    getRegistration: async (_scope: string) => ({ scope, waiting: worker }),
  });
  // The original wrapper intentionally never acquires a waiting worker.
  const client = connectNajmPwaClient({ registration: { scope: 'https://school.example/app/', waiting: null } as any,
    container: container as any, cacheId: 'school', cacheVersion: 'v1', canActivate: () => false });
  return { client, container, messages };
}

test('resolves the live registration after a failed installation and retry', async () => {
  const { client, messages } = fixture();
  expect(await client.getUpdate()).toEqual({ cacheVersion: 'v2', ready: true });
  expect(await client.activateUpdate()).toEqual({ activated: true });
  expect(messages).toEqual(['NAJM_PWA_STATUS', 'NAJM_PWA_STATUS', 'NAJM_PWA_ACTIVATE']);
  client.dispose();
});

test('does not activate a parent-scope registration after unregister', async () => {
  const { client, messages } = fixture('https://school.example/');
  expect(await client.getUpdate()).toBeNull();
  expect(await client.activateUpdate()).toEqual({ activated: false, reason: 'no-waiting-worker' });
  expect(messages).toEqual([]);
  client.dispose();
});

test('disposed clients detach their consent listener and reject further worker requests', async () => {
  const { client, container } = fixture();
  const channel = new MessageChannel();
  const answer = new Promise(resolve => { channel.port1.onmessage = event => { channel.port1.close(); resolve(event.data); }; });
  container.dispatchEvent(new MessageEvent('message', { data: { type: 'NAJM_PWA_CAN_ACTIVATE', protocol: 1, cacheId: 'school' }, ports: [channel.port2] }));
  expect(await answer).toEqual({ protocol: 1, ready: false, cacheVersion: 'v1' });
  channel.port2.close();
  client.dispose();
  await expect(client.getUpdate()).rejects.toThrow('disposed');
});
