import { expect, test } from 'bun:test';
import { registerShell, retryPreparation } from './support/app';

test('registration waits for the new install even when ready already resolves to a legacy worker', async () => {
  const worker = Object.assign(new EventTarget(), { state: 'installing' });
  const registration = { installing: worker } as unknown as ServiceWorkerRegistration;
  const calls: unknown[] = [];
  const container = { ready: Promise.resolve(registration), register: async (...args: unknown[]) => { calls.push(args); return registration; } };
  let settled = false;
  const pending = registerShell(container).then(value => { settled = true; return value; });
  await Promise.resolve(); await Promise.resolve();
  expect(settled).toBe(false);
  worker.state = 'installed'; worker.dispatchEvent(new Event('statechange'));
  expect(await pending).toBe(registration);
  expect(calls).toEqual([['/sw.js', { scope: '/', updateViaCache: 'none' }]]);
});

test('silent preparation retries transient failures sequentially and stops after success', async () => {
  let attempts = 0;
  let active = 0;
  await retryPreparation(async () => {
    expect(++active).toBe(1);
    active--;
    if (++attempts < 3) throw new Error('Temporary outage');
  }, new AbortController().signal, [1, 2]);
  expect(attempts).toBe(3);
});

test('reconnect wakes retry backoff and abort prevents all later attempts', async () => {
  const abort = new AbortController();
  const wake = new EventTarget();
  let attempts = 0;
  const pending = retryPreparation(async () => { attempts++; throw new Error('Unavailable'); }, abort.signal, [60000], wake);
  await new Promise(resolve => setTimeout(resolve, 1));
  expect(attempts).toBe(1);
  wake.dispatchEvent(new Event('online'));
  await new Promise(resolve => setTimeout(resolve, 1));
  expect(attempts).toBe(2);
  abort.abort();
  await pending;
  wake.dispatchEvent(new Event('online'));
  expect(attempts).toBe(2);
});

test('a permanent failure exhausts three attempts even across reconnects', async () => {
  const wake = new EventTarget();
  let attempts = 0;
  expect(await retryPreparation(async () => {
    attempts++;
    setTimeout(() => wake.dispatchEvent(new Event('online')), 0);
    throw new Error('Missing immutable shell asset');
  }, new AbortController().signal, [1], wake)).toBe(false);
  wake.dispatchEvent(new Event('online'));
  expect(attempts).toBe(3);
});

test('an existing registration is checked for a changed worker, and its install is awaited', async () => {
  const worker = Object.assign(new EventTarget(), { state: 'installing' });
  let updates = 0;
  const state: { installing: unknown; waiting: null; update(): Promise<void> } = { installing: null, waiting: null,
    update: async () => { updates++; state.installing = worker; } };
  const registration = state as unknown as ServiceWorkerRegistration;
  const container = { ready: Promise.resolve(registration), register: async () => registration };
  let settled = false;
  const pending = registerShell(container).then(value => { settled = true; return value; });
  await new Promise(resolve => setTimeout(resolve, 5));
  expect(updates).toBe(1);
  expect(settled).toBe(false);
  worker.state = 'installed'; worker.dispatchEvent(new Event('statechange'));
  expect(await pending).toBe(registration);
  // No change, or a failed check: the current worker stays, without another check.
  const unchanged = { installing: null, waiting: null, update: async () => { updates++; throw new TypeError('offline'); } } as unknown as ServiceWorkerRegistration;
  expect(await registerShell({ ready: Promise.resolve(unchanged), register: async () => unchanged })).toBe(unchanged);
  expect(updates).toBe(2);
});

test('failed installation is reported instead of accepting an older active worker', async () => {
  const worker = Object.assign(new EventTarget(), { state: 'redundant' });
  const registration = { installing: worker } as unknown as ServiceWorkerRegistration;
  await expect(registerShell({ ready: Promise.resolve(registration), register: async () => registration })).rejects.toThrow('installation failed');
});

test('a slow live installation stays one pending attempt beyond the watchdog', async () => {
  const worker = Object.assign(new EventTarget(), { state: 'installing' });
  const registration = { installing: worker } as unknown as ServiceWorkerRegistration;
  let calls = 0;
  const container = { ready: Promise.resolve(registration), register: async () => { calls++; return registration; } };
  let settled = false;
  const pending = retryPreparation(async () => { await registerShell(container, 5); }, new AbortController().signal, [1])
    .then(result => { settled = true; return result; });
  await new Promise(resolve => setTimeout(resolve, 30));
  expect(settled).toBe(false);
  expect(calls).toBe(1);
  worker.state = 'installed'; worker.dispatchEvent(new Event('statechange'));
  expect(await pending).toBe(true);
  expect(calls).toBe(1);
});

test('unmount aborts an ongoing install wait without starting another attempt', async () => {
  const worker = Object.assign(new EventTarget(), { state: 'installing' });
  const registration = { installing: worker } as unknown as ServiceWorkerRegistration;
  const abort = new AbortController();
  let calls = 0;
  const pending = retryPreparation(async () => {
    calls++; await registerShell({ ready: Promise.resolve(registration), register: async () => registration }, 5, abort.signal);
  }, abort.signal, [1]);
  await new Promise(resolve => setTimeout(resolve, 10));
  abort.abort();
  await pending;
  expect(calls).toBe(1);
});

test('registration errors and stalled preparation are surfaced', async () => {
  const registration = { update: async () => {} } as unknown as ServiceWorkerRegistration;
  await expect(registerShell({ ready: Promise.resolve(registration), register: async () => { throw new Error('CSP blocked registration'); } })).rejects.toThrow('CSP blocked');
  await expect(registerShell({ ready: new Promise(() => {}), register: async () => registration }, 5)).rejects.toThrow('timed out');
});
