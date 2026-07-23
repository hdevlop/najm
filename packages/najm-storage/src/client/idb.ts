// ============================================================================
// najm-storage/client - IndexedDB primitives
// ============================================================================

export interface IndexSpec {
  name: string;
  keyPath: string | string[];
  unique?: boolean;
  multiEntry?: boolean;
}

export interface StoreSpec {
  name: string;
  keyPath?: string | string[];
  autoIncrement?: boolean;
  indexes?: IndexSpec[];
}

export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new DOMException('Transaction aborted', 'AbortError'));
  });
}

export function assertIndexedDB(): IDBFactory {
  const idb = globalThis.indexedDB;
  if (!idb) {
    throw new Error(
      'najm-storage/client requires IndexedDB, which is not available in this environment. ' +
      'This module is browser-only — do not import it in server code.'
    );
  }
  return idb;
}

function createStore(db: IDBDatabase, spec: StoreSpec): void {
  const store = db.createObjectStore(spec.name, {
    keyPath: spec.keyPath,
    autoIncrement: spec.autoIncrement ?? false,
  });
  for (const index of spec.indexes ?? []) {
    store.createIndex(index.name, index.keyPath, {
      unique: index.unique ?? false,
      multiEntry: index.multiEntry ?? false,
    });
  }
}

function missingStores(db: IDBDatabase, specs: StoreSpec[]): StoreSpec[] {
  return specs.filter((spec) => !db.objectStoreNames.contains(spec.name));
}

function open(idb: IDBFactory, name: string, specs: StoreSpec[], version?: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = version === undefined ? idb.open(name) : idb.open(name, version);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const spec of missingStores(db, specs)) createStore(db, spec);
    };
    request.onsuccess = () => {
      const db = request.result;
      // Let a future upgrade (e.g. another tab adding stores) proceed instead of blocking.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new DOMException(`Database "${name}" upgrade blocked by another open connection`, 'BlockedError'));
  });
}

/**
 * Open a database ensuring all required object stores exist. If the database
 * already exists but lacks some stores, it is reopened with a bumped version
 * so the missing stores can be created.
 */
export async function openDatabase(name: string, specs: StoreSpec[]): Promise<IDBDatabase> {
  const idb = assertIndexedDB();
  const db = await open(idb, name, specs);
  if (missingStores(db, specs).length === 0) return db;
  const nextVersion = db.version + 1;
  db.close();
  return open(idb, name, specs, nextVersion);
}

export function deleteDatabase(name: string): Promise<void> {
  const idb = assertIndexedDB();
  return new Promise((resolve, reject) => {
    const request = idb.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new DOMException(`Database "${name}" deletion blocked by another open connection`, 'BlockedError'));
  });
}
