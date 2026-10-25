import { afterEach, describe, expect, test } from 'bun:test';
import { IDBFactory } from 'fake-indexeddb';
import { OFFLINE_DURATION_MS, OFFLINE_RENEWAL_MS, type OfflineGrant } from './support/app';
import { connectRenewalSchedule, createRenewalQueue } from './support/app';
import { openAppReplica, type AppReplica } from './support/app';
import type { ShellBootstrap } from './support/app';

const minute = 60_000;
const hour = 60 * minute;
const start = Date.UTC(2026, 9, 24, 7, 30);
const databases: AppReplica[] = [];
const disconnect: (() => void)[] = [];
afterEach(() => {
  for (const stop of disconnect.splice(0)) stop();
  for (const storage of databases.splice(0)) storage.replica.close();
});

class TestDocument extends EventTarget {
  visibilityState: DocumentVisibilityState = 'visible';
  visible(value: boolean) {
    this.visibilityState = value ? 'visible' : 'hidden';
    this.dispatchEvent(new Event('visibilitychange'));
  }
}

class TestAuth {
  listeners = new Set<() => void>();
  on(_event: 'tokenRefresh', listener: () => void) { this.listeners.add(listener); }
  off(_event: 'tokenRefresh', listener: () => void) { this.listeners.delete(listener); }
  tokenRefresh() { for (const listener of this.listeners) listener(); }
}

/** Advance delivers ordinary intervals; sleep deliberately delivers no callbacks. */
class TestClock {
  now = start;
  timer: { callback(): void; interval: number; next: number } | null = null;
  interval = (callback: () => void, interval: number) => {
    this.timer = { callback, interval, next: this.now + interval };
    return () => { this.timer = null; };
  };
  async advance(milliseconds: number, settle: () => Promise<void>) {
    const end = this.now + milliseconds;
    while (this.timer && this.timer.next <= end) {
      this.now = this.timer.next;
      this.timer.next += this.timer.interval;
      this.timer.callback();
      await settle();
    }
    this.now = end;
  }
  sleep(milliseconds: number) {
    this.now += milliseconds;
    if (this.timer) this.timer.next = this.now + this.timer.interval;
  }
}

async function setup() {
  const clock = new TestClock();
  const auth = new TestAuth();
  const document = new TestDocument();
  const window = new EventTarget();
  const storage = await openAppReplica({ installationId: 'installation', accountId: 'account' }, new IDBFactory(), () => clock.now);
  databases.push(storage);
  const bootstrap: ShellBootstrap = { version: 1, accountId: 'account', expiresAt: start + OFFLINE_DURATION_MS,
    routes: [{ href: '/students', label: 'Students' }],
    ui: { preferences: { language: 'en', theme: 'light', timeZone: 'Africa/Casablanca' }, branding: { slots: {}, revision: 1 },
      appearance: { designConfig: { version: 1, theme: { mode: 'light', accent: 'neutral' } } } } };
  const checks: number[] = [];
  const forced: boolean[] = [];
  const applied: boolean[] = [];
  const pending = new Set<Promise<void>>();
  let online = true;
  let authorized = true;
  let hold: Promise<void> | null = null;
  const request = createRenewalQueue(async task => {
    // Captured before authorization, as in runtime.ts; logout/CAS must reject late grants.
    const token = await storage.access.capture();
    checks.push(clock.now);
    const accepted = authorized;
    if (hold) await hold;
    if (!online) throw new TypeError('Failed to fetch');
    if (!accepted) { await storage.access.lock(await storage.access.capture(), 'authorization-revoked'); return; }
    const grant: OfflineGrant = { protocol: 1, schema: 1, accountId: 'account', installationId: 'installation', installationEpoch: 'epoch',
      authorizationGeneration: 'generation', issuedAt: clock.now, validUntil: clock.now + OFFLINE_DURATION_MS,
      scopes: [{ id: 'year:2026-2027', academicYear: '2026-2027', capabilities: ['read:students'] }],
      account: { id: 'account', name: 'Meryem', email: null, image: null, role: 'parent' },
      permissions: ['read:offline', 'read:students'], activeYear: '2026-2027' };
    applied.push((await storage.enrollPresentation(token, grant, { ...bootstrap, expiresAt: grant.validUntil })).applied);
    forced.push(task.takeRefresh());
  });
  const track = (force: boolean) => {
    const result = request(force);
    pending.add(result);
    void result.then(() => pending.delete(result), () => pending.delete(result));
    return result;
  };
  const settle = async () => {
    // Event callbacks enqueue microtasks; the coalesced follow-up can enqueue another.
    for (let i = 0; i < 8; i++) { await Promise.resolve(); await Promise.allSettled([...pending]); }
  };
  const stop = connectRenewalSchedule({ auth, document, window, interval: clock.interval,
    reconcile: () => track(false), refresh: () => track(true) });
  disconnect.push(stop);
  await settle();
  return { clock, auth, document, window, storage, checks, forced, applied, settle, stop,
    advance: (milliseconds: number) => clock.advance(milliseconds, settle),
    online: (value: boolean) => { online = value; }, authorize: (value: boolean) => { authorized = value; },
    hold: (value: Promise<void> | null) => { hold = value; },
    expiry: async () => (await storage.store.read())!.entitlement!.validUntil };
}

describe('read authorization renewal schedule', () => {
  test('startup and every 15-minute check retain an eight-hour window beyond an eight-hour online session', async () => {
    const f = await setup();
    expect(f.checks).toEqual([start]);
    await f.advance(9 * hour);
    expect(f.checks).toHaveLength(37);
    expect(Math.max(...f.checks.slice(1).map((time, index) => time - f.checks[index]!))).toBe(OFFLINE_RENEWAL_MS);
    expect(await f.expiry()).toBe(f.clock.now + OFFLINE_DURATION_MS);
    f.online(false);
    await f.advance(7 * hour + 59 * minute);
    expect((await f.storage.access.refresh()).status).toBe('available');
    expect(await f.expiry()).toBe(start + 17 * hour);
    await f.advance(minute);
    expect((await f.storage.access.refresh()).reason).toBe('expired');
  });

  test('a 14:00 interruption retains eight hours after recent authorization rather than the initial 15:30 expiry', async () => {
    const f = await setup();
    expect(await f.expiry()).toBe(Date.UTC(2026, 9, 24, 15, 30));
    await f.advance(6 * hour + 30 * minute);
    expect(f.clock.now).toBe(Date.UTC(2026, 9, 24, 14));
    expect(await f.expiry()).toBe(Date.UTC(2026, 9, 24, 22));
    f.online(false);
    await f.advance(7 * hour + 59 * minute);
    expect((await f.storage.access.refresh()).status).toBe('available');
    await f.advance(minute);
    expect((await f.storage.access.refresh()).reason).toBe('expired');
  });

  test('each successful tokenRefresh authorizes immediately, including while hidden; resume and reconnect do too', async () => {
    const f = await setup();
    await f.advance(minute);
    f.auth.tokenRefresh(); await f.settle();
    expect(f.checks.at(-1)).toBe(start + minute);
    f.document.visible(false);
    await f.advance(minute);
    f.auth.tokenRefresh(); await f.settle();
    expect(f.checks.at(-1)).toBe(start + 2 * minute);
    await f.advance(minute);
    f.document.visible(true); await f.settle();
    expect(f.checks.at(-1)).toBe(start + 3 * minute);
    await f.advance(minute);
    f.window.dispatchEvent(new Event('online')); await f.settle();
    expect(f.checks.at(-1)).toBe(start + 4 * minute);
    expect(f.forced).toEqual([false, true, true, false, true]);
    expect(await f.expiry()).toBe(f.clock.now + OFFLINE_DURATION_MS);
  });

  test('a sleeping tab renews on visible resume without waiting for its next interval', async () => {
    const f = await setup();
    f.document.visible(false);
    await f.advance(hour);
    expect(f.checks).toEqual([start]);
    f.clock.sleep(8 * hour);
    expect((await f.storage.access.refresh()).reason).toBe('expired');
    f.document.visible(true); await f.settle();
    expect(f.checks).toEqual([start, start + 9 * hour]);
    expect((await f.storage.access.refresh()).status).toBe('available');
    expect(await f.expiry()).toBe(f.clock.now + OFFLINE_DURATION_MS);
  });

  test('failed resume and token refresh authorization never extend old access; the next scheduled check retries', async () => {
    const f = await setup();
    const original = await f.expiry();
    f.document.visible(false);
    f.clock.sleep(7 * hour);
    f.online(false);
    f.document.visible(true); f.auth.tokenRefresh(); await f.settle();
    expect(await f.expiry()).toBe(original);
    expect((await f.storage.access.refresh()).status).toBe('available');
    await f.advance(hour);
    expect((await f.storage.access.refresh()).reason).toBe('expired');
    expect(await f.expiry()).toBe(original);
    const failedAt = f.checks.at(-1)!;
    f.online(true);
    await f.advance(OFFLINE_RENEWAL_MS);
    expect(f.checks.at(-1)! - failedAt).toBe(OFFLINE_RENEWAL_MS);
    expect((await f.storage.access.refresh()).status).toBe('available');
    expect(await f.expiry()).toBe(f.clock.now + OFFLINE_DURATION_MS);
  });

  test('revocation is known at the next scheduled check and resume cannot restore refused access', async () => {
    const f = await setup();
    const original = await f.expiry();
    f.authorize(false);
    await f.advance(OFFLINE_RENEWAL_MS - 1);
    expect((await f.storage.access.refresh()).status).toBe('available');
    await f.advance(1);
    expect((await f.storage.access.refresh()).reason).toBe('authorization-revoked');
    expect(await f.expiry()).toBe(original);
    f.document.visible(false); f.clock.sleep(hour); f.document.visible(true); await f.settle();
    expect((await f.storage.access.refresh()).reason).toBe('authorization-revoked');
  });

  test('simultaneous triggers coalesce, and a late authorization cannot replace a logout lock', async () => {
    const f = await setup();
    let release!: () => void;
    f.hold(new Promise<void>(resolve => { release = resolve; }));
    await f.advance(minute);
    f.auth.tokenRefresh();
    // Allow capture to complete, but do not wait for the deliberately blocked authorization.
    for (let i = 0; i < 8 && f.checks.length < 2; i++) await new Promise(resolve => setTimeout(resolve, 0));
    expect(f.checks).toHaveLength(2);
    f.window.dispatchEvent(new Event('online'));
    f.document.visible(true);
    f.auth.tokenRefresh();
    await Promise.resolve();
    const original = await f.expiry();
    await f.storage.access.lock(await f.storage.access.capture(), 'logout');
    // Teardown removes all future triggers; an already in-flight CAS must still fail.
    f.stop();
    f.hold(null); release();
    // Refuse the queued follow-up as the real runtime's account fence does after logout.
    f.authorize(false);
    await f.settle();
    expect(f.checks.length).toBeLessThanOrEqual(3);
    expect(f.applied).toEqual([true, false]);
    expect(await f.expiry()).toBe(original);
    expect((await f.storage.access.refresh()).status).toBe('locked');
  });

  test('disconnect removes timer, token, visibility and online listeners, including queued startup', async () => {
    const f = await setup();
    f.stop();
    f.auth.tokenRefresh(); f.document.visible(true); f.window.dispatchEvent(new Event('online'));
    await f.advance(hour); await f.settle();
    expect(f.checks).toEqual([start]);
    expect(f.auth.listeners.size).toBe(0);
    let called = false;
    const stop = connectRenewalSchedule({ auth: f.auth, document: f.document, window: f.window,
      interval: f.clock.interval, reconcile: async () => { called = true; }, refresh: async () => { called = true; } });
    stop(); await f.settle();
    expect(called).toBe(false);
  });
});

test('renewal coalesces forced replacements without overlapping work or retrying indefinitely after failure', async () => {
  let release!: () => void;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const refreshes: boolean[] = [];
  let calls = 0;
  let active = 0;
  let maxActive = 0;
  const request = createRenewalQueue(async task => {
    calls++; active++; maxActive = Math.max(maxActive, active);
    try {
      if (calls === 1) await blocked;
      refreshes.push(task.takeRefresh());
      throw new TypeError('Failed to fetch');
    } finally { active--; }
  });
  const first = request();
  for (let i = 0; i < 20; i++) expect(request(i === 19)).toBe(first);
  release();
  await expect(first).rejects.toThrow('Failed to fetch');
  for (let i = 0; i < 8; i++) await Promise.resolve();
  expect(calls).toBe(2);
  expect(maxActive).toBe(1);
  expect(refreshes).toEqual([true, false]);
});

test('a reconnect forces a replacement; a token refresh only renews authorization', async () => {
  const calls: string[] = [];
  const auth = new TestAuth();
  const window = new EventTarget();
  const stop = connectRenewalSchedule({ auth, document: new TestDocument(), window, interval: () => () => undefined,
    reconcile: async () => { calls.push('reconcile'); }, refresh: async () => { calls.push('refresh'); },
    reconnect: async () => { calls.push('reconnect'); } });
  disconnect.push(stop);
  await new Promise(resolve => setTimeout(resolve, 0));
  auth.tokenRefresh();
  window.dispatchEvent(new Event('online'));
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(calls).toEqual(['reconcile', 'refresh', 'reconnect']);
  stop();
  window.dispatchEvent(new Event('online'));
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(calls).toHaveLength(3);
});
