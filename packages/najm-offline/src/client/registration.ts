/**
 * Registers the app's worker and waits for its installation too: `ready` alone
 * may describe a legacy active worker. The app owns when this runs; Najm's
 * worker owns cache and update behavior.
 */
export async function registerShell(container: Pick<ServiceWorkerContainer, 'register' | 'ready'>, timeoutMs = 30000, signal?: AbortSignal,
  script = '/sw.js', scope = '/') {
  let cleanup = () => {};
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancelled = new Promise<never>((_, reject) => {
    const abort = () => reject(signal?.reason ?? new DOMException('Preparation cancelled', 'AbortError'));
    signal?.addEventListener('abort', abort, { once: true });
    cleanup = () => signal?.removeEventListener('abort', abort);
    if (signal?.aborted) abort();
  });
  const removeAbort = cleanup;
  try {
    return await Promise.race([
      (async () => {
        const registration = await container.register(script, { scope, updateViaCache: 'none' });
        if (timedOut) throw new Error('Offline application preparation timed out.');
        signal?.throwIfAborted();
        // register() returns an existing registration for the same script without
        // checking it, and WebKit can skip its own navigation check: check on each
        // opening, so a changed worker (an update, offline turned off) installs now.
        if (!registration.installing && !registration.waiting) await registration.update().catch(() => undefined);
        if (timedOut) throw new Error('Offline application preparation timed out.');
        signal?.throwIfAborted();
        const worker = registration.installing;
        if (worker) await new Promise<void>((resolve, reject) => {
          // A live install may still be downloading on a slow link. Keep one
          // attempt pending until it succeeds/fails; never spend more attempts
          // because the registration watchdog elapsed during that download.
          clearTimeout(timer);
          const check = () => {
            if (worker.state === 'installed' || worker.state === 'activated') resolve();
            if (worker.state === 'redundant') reject(new Error('Offline application installation failed.'));
          };
          worker.addEventListener('statechange', check);
          cleanup = () => worker.removeEventListener('statechange', check);
          check();
        });
        await container.ready;
        return registration;
      })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => { timedOut = true; reject(new Error('Offline application preparation timed out.')); }, timeoutMs); }),
      cancelled,
    ]);
  } finally { clearTimeout(timer); cleanup(); removeAbort(); }
}

/** Retry transient preparation failures silently, with a finite attempt budget.
 * Reconnection wakes backoff but cannot reset the budget. */
export async function retryPreparation(operation: () => Promise<void>, signal: AbortSignal,
  delays: readonly number[] = [2000, 5000], wake: EventTarget | undefined = typeof window === 'undefined' ? undefined : window, maxAttempts = 3) {
  let failures = 0;
  while (!signal.aborted && failures < maxAttempts) {
    try { await operation(); return !signal.aborted; }
    catch { if (signal.aborted) return; }
    if (++failures >= maxAttempts) break;
    const delay = delays[Math.min(failures - 1, delays.length - 1)] ?? 5000;
    await new Promise<void>(resolve => {
      const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); wake?.removeEventListener('online', finish); resolve(); };
      const timer = setTimeout(finish, delay);
      signal.addEventListener('abort', finish, { once: true });
      wake?.addEventListener('online', finish, { once: true });
      if (signal.aborted) finish();
    });
  }
  return false;
}

/** One retry budget per version across all open tabs of the app. A shared
 * lifetime lock identifies an app opening; after every tab closes, the next
 * opening gets a new cohort and may retry. Storage alone cannot detect a
 * closed/crashed tab. */
export async function prepareShell(namespace: string, version: string, operation: () => Promise<void>, signal: AbortSignal,
  environment?: { locks: Pick<LockManager, 'request' | 'query'>; storage: Pick<Storage, 'getItem' | 'setItem'> }) {
  const OPEN_LOCK = `${namespace}.shell.preparation-open:`;
  const BUDGET_KEY = `${namespace}.shell.preparation-budget:`;
  let cohort = '';
  try {
    const { locks, storage } = environment ?? { locks: navigator.locks, storage: localStorage };
    if (!locks) return await retryPreparation(operation, signal, [], undefined, 1);
    // Serialize discovery and acquire our lifetime lock before admitting peers.
    await locks.request(`${namespace}.shell.preparation-open`, { signal }, async () => {
      const held = (await locks.query()).held ?? [];
      cohort = held.find(lock => lock.name?.startsWith(OPEN_LOCK))?.name?.slice(OPEN_LOCK.length) ?? crypto.randomUUID();
      await new Promise<void>((entered, reject) => {
        void locks.request(OPEN_LOCK + cohort, { mode: 'shared', signal }, async () => {
          entered();
          await new Promise<void>(release => {
            signal.addEventListener('abort', () => release(), { once: true });
            if (signal.aborted) release();
          });
        }).catch(reject);
      });
    });
    return await locks.request(BUDGET_KEY + version, { signal }, async () => {
      const key = BUDGET_KEY + version;
      const saved = JSON.parse(storage.getItem(key) ?? 'null') as { cohort?: string; attempts?: number } | null;
      let attempts = saved?.cohort === cohort && Number.isInteger(saved.attempts) ? Math.max(0, saved.attempts!) : 0;
      if (attempts >= 3) return false;
      return retryPreparation(async () => {
        // Reserve before any download, so a closed/crashed tab cannot lose an attempt.
        storage.setItem(key, JSON.stringify({ cohort, attempts: ++attempts }));
        await operation();
        if (!signal.aborted) storage.setItem(key, JSON.stringify({ cohort, attempts: 0 }));
      }, signal, undefined, undefined, 3 - attempts);
    });
  } catch {
    // Denied storage/locks must not create an unlimited per-tab retry loop.
    return false;
  }
}
