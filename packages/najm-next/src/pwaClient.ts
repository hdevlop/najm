import { CACHE_TOKEN, LANGUAGE_TAG, OFFLINE_LANGUAGE_DATABASE_PREFIX, OFFLINE_LANGUAGE_KEY,
  OFFLINE_LANGUAGE_STORE } from './internal/offlineLanguage';

export interface NajmPwaUpdate {
  cacheVersion: string;
  ready: boolean;
}

export interface NajmOfflineLanguageOptions {
  /** The worker's `cacheId`. */
  cacheId: string;
  /** The language the app now displays, as a BCP 47 tag. */
  language: string;
  /** Defaults to the global `indexedDB`. */
  indexedDB?: IDBFactory;
}

/**
 * Records the language the app displays, so the worker's stacked offline
 * document (`offlineDocument.languages`) shows it first. Call it when that
 * language is known and whenever it changes. Resolves false when storage is
 * unavailable; the document then keeps its configured order.
 */
export async function rememberNajmOfflineLanguage(options: NajmOfflineLanguageOptions): Promise<boolean> {
  if (typeof options.cacheId !== 'string' || !CACHE_TOKEN.test(options.cacheId)) {
    throw new TypeError('[najm-next] cacheId must contain only letters, numbers, dots, underscores, or hyphens.');
  }
  if (typeof options.language !== 'string' || !LANGUAGE_TAG.test(options.language)) {
    throw new TypeError('[najm-next] language must be a valid language tag.');
  }
  const factory = options.indexedDB ?? globalThis.indexedDB;
  if (!factory) return false;
  return new Promise(resolve => {
    try {
      const open = factory.open(OFFLINE_LANGUAGE_DATABASE_PREFIX + options.cacheId, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(OFFLINE_LANGUAGE_STORE);
      open.onerror = () => resolve(false);
      open.onsuccess = () => {
        const database = open.result;
        const finish = (stored: boolean) => { database.close(); resolve(stored); };
        try {
          const transaction = database.transaction(OFFLINE_LANGUAGE_STORE, 'readwrite');
          transaction.objectStore(OFFLINE_LANGUAGE_STORE).put(options.language, OFFLINE_LANGUAGE_KEY);
          transaction.oncomplete = () => finish(true);
          transaction.onabort = () => finish(false);
        } catch { finish(false); }
      };
    } catch { resolve(false); }
  });
}

export interface NajmPwaClientOptions {
  registration: ServiceWorkerRegistration;
  cacheId: string;
  cacheVersion: string;
  /** Return false while input/operations cannot safely cross a worker update. */
  canActivate: () => boolean | Promise<boolean>;
  container?: ServiceWorkerContainer;
}

/** No global/browser work occurs on import. Never reloads a document. */
export function connectNajmPwaClient(options: NajmPwaClientOptions) {
  const container = options.container ?? globalThis.navigator?.serviceWorker;
  if (!container) throw new TypeError('[najm-next] Service workers are unavailable.');
  let disposed = false;
  const receive = (event: MessageEvent) => {
    if (disposed || event.data?.type !== 'NAJM_PWA_CAN_ACTIVATE' || event.data.protocol !== 1 ||
      event.data.cacheId !== options.cacheId || !event.ports[0]) return;
    void Promise.resolve().then(options.canActivate).then(ready => {
      event.ports[0].postMessage({ protocol: 1, ready: !disposed && ready === true, cacheVersion: options.cacheVersion });
    }).catch(() => event.ports[0].postMessage({ protocol: 1, ready: false }));
  };
  container.addEventListener('message', receive);

  async function waitingWorker(): Promise<ServiceWorker | null> {
    // Some engines leave a registration wrapper stale after a failed install.
    // Resolve the live registration and reject a parent-scope match.
    const registration = await container.getRegistration(options.registration.scope);
    return registration?.scope === options.registration.scope ? registration.waiting : null;
  }

  async function request(worker: ServiceWorker, type: string, extra = {}): Promise<any> {
    if (disposed) throw new Error('[najm-next] PWA client is disposed.');
    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => { channel.port1.close(); reject(new Error('[najm-next] Worker update request timed out.')); }, 5000);
      channel.port1.onmessage = event => {
        clearTimeout(timer);
        channel.port1.close();
        if (event.data?.protocol !== 1 || event.data.cacheId !== options.cacheId) reject(new Error('[najm-next] Invalid worker update response.'));
        else resolve(event.data);
      };
      try { worker.postMessage({ type, protocol: 1, cacheId: options.cacheId, ...extra }, [channel.port2]); }
      catch (error) { clearTimeout(timer); channel.port1.close(); reject(error); }
    });
  }

  return {
    async getUpdate(): Promise<NajmPwaUpdate | null> {
      const waiting = await waitingWorker();
      if (!waiting) return null;
      const result = await request(waiting, 'NAJM_PWA_STATUS');
      return { cacheVersion: result.cacheVersion, ready: result.ready === true };
    },
    async activateUpdate(): Promise<{ activated: boolean; reason?: string }> {
      const waiting = await waitingWorker();
      if (!waiting) return { activated: false, reason: 'no-waiting-worker' };
      const status = await request(waiting, 'NAJM_PWA_STATUS');
      if (!status.ready) return { activated: false, reason: 'assets-unavailable' };
      const result = await request(waiting, 'NAJM_PWA_ACTIVATE', { cacheVersion: status.cacheVersion });
      return { activated: result.activated === true, ...(result.reason ? { reason: result.reason } : {}) };
    },
    dispose() { disposed = true; container.removeEventListener('message', receive); },
  };
}
