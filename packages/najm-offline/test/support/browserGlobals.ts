import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';

/** In-memory Storage with the browser's string semantics. */
export class MemoryStorage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

const NAMES = ['window', 'document', 'localStorage', 'indexedDB', 'IDBKeyRange'] as const;

/**
 * Window, document, storage and IndexedDB for code that runs in a page. Test
 * files share one process, so `uninstall` restores whatever was there before.
 */
export function installBrowserGlobals() {
  const previous = new Map(NAMES.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const window = new EventTarget();
  const document = Object.assign(new EventTarget(), { visibilityState: 'visible', documentElement: { lang: 'en', dir: 'ltr' } });
  const localStorage = new MemoryStorage();
  const values = { window, document, localStorage, indexedDB: new IDBFactory(), IDBKeyRange };
  for (const name of NAMES) Object.defineProperty(globalThis, name, { value: values[name], configurable: true, writable: true });
  return {
    window, document, localStorage,
    /** The event another tab's write delivers to this one. */
    storageEvent(key: string, oldValue: string | null, newValue: string | null) {
      window.dispatchEvent(Object.assign(new Event('storage'), { key, oldValue, newValue }));
    },
    uninstall() {
      for (const name of NAMES) {
        const descriptor = previous.get(name);
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete (globalThis as Record<string, unknown>)[name];
      }
    },
  };
}

export async function until(check: () => boolean | Promise<boolean>, timeout = 5000) {
  const deadline = Date.now() + timeout;
  while (!await check()) {
    if (Date.now() > deadline) throw new Error('Condition did not become true');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}
