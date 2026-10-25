import { OFFLINE_RENEWAL_MS } from '../index';

/** One in-flight renewal and at most one coalesced follow-up for concurrent triggers. */
export function createRenewalQueue(run: (request: { takeRefresh(): boolean; requireRefresh(): void }) => Promise<void>) {
  let running: Promise<void> | null = null;
  let queued = false;
  let refresh = false;
  const request = (force = false): Promise<void> => {
    refresh ||= force;
    if (running) { queued = true; return running; }
    // Defer run until running is assigned, including when it emits a synchronous auth event.
    running = Promise.resolve().then(() => run({
      takeRefresh() { const value = refresh; refresh = false; return value; },
      requireRefresh() { refresh = true; },
    })).finally(() => {
      running = null;
      if (queued) { queued = false; void request().catch(() => undefined); }
    });
    return running;
  };
  return request;
}

type Events = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
export type RenewalSchedule = {
  auth: { on(event: 'tokenRefresh', listener: () => void): unknown; off(event: 'tokenRefresh', listener: () => void): unknown };
  document: Events & { readonly visibilityState: DocumentVisibilityState };
  window: Events;
  reconcile(): Promise<void>;
  refresh(): Promise<void>;
  /** After reconnecting, when server data may have changed meanwhile. Defaults to refresh. */
  reconnect?(): Promise<void>;
  interval?: (listener: () => void, milliseconds: number) => () => void;
  /** Defaults to OFFLINE_RENEWAL_MS. */
  intervalMs?: number;
};

/** Timers are advisory: a visible resume and every successful token refresh authorize immediately. */
export function connectRenewalSchedule(options: RenewalSchedule) {
  let stopped = false;
  const invoke = (action: () => Promise<void>) => {
    if (!stopped) void Promise.resolve().then(() => { if (!stopped) return action(); }).catch(() => undefined);
  };
  const visible = () => { if (options.document.visibilityState !== 'hidden') invoke(options.reconcile); };
  const refresh = () => invoke(options.refresh);
  const reconnect = () => invoke(options.reconnect ?? options.refresh);
  const interval = options.interval ?? ((listener, milliseconds) => {
    const timer = setInterval(listener, milliseconds);
    return () => clearInterval(timer);
  });
  const cancel = interval(visible, options.intervalMs ?? OFFLINE_RENEWAL_MS);
  options.auth.on('tokenRefresh', refresh);
  options.document.addEventListener('visibilitychange', visible);
  options.window.addEventListener('online', reconnect);
  invoke(options.reconcile);
  return () => {
    stopped = true;
    cancel();
    options.auth.off('tokenRefresh', refresh);
    options.document.removeEventListener('visibilitychange', visible);
    options.window.removeEventListener('online', reconnect);
  };
}
