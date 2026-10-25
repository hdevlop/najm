import { expect, test } from 'bun:test';
import { isActiveShellReady } from './support/app';

function containerWithStatus(status: unknown, changeController = false) {
  const container = { controller: { state: 'activated', postMessage(_message: unknown, ports: MessagePort[]) {
    if (changeController) container.controller = null as never;
    ports[0].postMessage(status);
  } } };
  return container as unknown as Pick<ServiceWorkerContainer, 'controller'>;
}
const complete = { protocol: 1, cacheId: 'app-shell', cacheVersion: 'current', ready: true };

test('offline readiness requires the controlling worker to confirm this complete generation', async () => {
  expect(await isActiveShellReady(containerWithStatus(complete), 'current')).toBe(true);
  // A newer downloaded cache cannot make an older active worker ready.
  expect(await isActiveShellReady(containerWithStatus({ ...complete, cacheVersion: 'old' }), 'current')).toBe(false);
  expect(await isActiveShellReady(containerWithStatus({ ...complete, ready: false }), 'current')).toBe(false);
  expect(await isActiveShellReady(containerWithStatus({ ...complete, cacheId: 'other' }), 'current')).toBe(false);
  expect(await isActiveShellReady(containerWithStatus({ ...complete, protocol: 2 }), 'current')).toBe(false);
  expect(await isActiveShellReady(containerWithStatus(complete, true), 'current')).toBe(false);
});

test('uncontrolled pages and legacy workers cannot announce offline readiness', async () => {
  expect(await isActiveShellReady({ controller: null }, 'current')).toBe(false);
  const legacy = { controller: { state: 'activated', postMessage() {} } } as unknown as Pick<ServiceWorkerContainer, 'controller'>;
  expect(await isActiveShellReady(legacy, 'current', 5)).toBe(false);
});

test('silent, slow and replaced controllers stay unready; timeout never authorizes activation', async () => {
  const silent = { controller: { state: 'activated', postMessage() {} } } as unknown as Pick<ServiceWorkerContainer, 'controller'>;
  expect(await isActiveShellReady(silent, 'current', 5)).toBe(false);
  const installing = { controller: { state: 'activating', postMessage() {} } } as unknown as Pick<ServiceWorkerContainer, 'controller'>;
  expect(await isActiveShellReady(installing, 'current', 5)).toBe(false);
  // A controller replaced while waiting is not evidence about the new one.
  const replaced = { controller: { state: 'activated', postMessage() { replaced.controller = null as never; } } };
  expect(await isActiveShellReady(replaced as unknown as Pick<ServiceWorkerContainer, 'controller'>, 'current', 5)).toBe(false);
  const unreachable = { controller: { state: 'activated', postMessage() { throw new Error('DataCloneError'); } } } as unknown as Pick<ServiceWorkerContainer, 'controller'>;
  expect(await isActiveShellReady(unreachable, 'current', 5)).toBe(false);
});
