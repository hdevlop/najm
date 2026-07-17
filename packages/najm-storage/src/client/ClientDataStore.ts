// ============================================================================
// najm-storage/client - IndexedDB Data Store (JSON documents with indexes)
// ============================================================================

import { requestToPromise, transactionDone } from './idb';
import type { QueryOptions, QueryRange } from './types';

function toKeyRange(range?: QueryRange): IDBKeyRange | undefined {
  if (!range) return undefined;
  if (range.eq !== undefined) return IDBKeyRange.only(range.eq);
  const lower = range.gt ?? range.gte;
  const upper = range.lt ?? range.lte;
  if (lower !== undefined && upper !== undefined) {
    return IDBKeyRange.bound(lower, upper, range.gt !== undefined, range.lt !== undefined);
  }
  if (lower !== undefined) return IDBKeyRange.lowerBound(lower, range.gt !== undefined);
  if (upper !== undefined) return IDBKeyRange.upperBound(upper, range.lt !== undefined);
  return undefined;
}

export class ClientDataStore {
  constructor(
    private readonly db: () => Promise<IDBDatabase>,
    private readonly storeNames: Set<string>,
  ) {}

  private async store(name: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
    if (!this.storeNames.has(name)) {
      throw new Error(
        `Unknown data store "${name}". Declare it in createClientStorage({ stores: [{ name: '${name}' }] }).`
      );
    }
    const db = await this.db();
    return db.transaction(name, mode).objectStore(name);
  }

  async put<T>(storeName: string, value: T, key?: IDBValidKey): Promise<IDBValidKey> {
    const store = await this.store(storeName, 'readwrite');
    const result = requestToPromise(key === undefined ? store.put(value) : store.put(value, key));
    await transactionDone(store.transaction);
    return result;
  }

  async get<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
    const store = await this.store(storeName, 'readonly');
    return requestToPromise(store.get(key)) as Promise<T | undefined>;
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    const store = await this.store(storeName, 'readonly');
    return requestToPromise(store.getAll()) as Promise<T[]>;
  }

  async query<T>(storeName: string, options: QueryOptions = {}): Promise<T[]> {
    const store = await this.store(storeName, 'readonly');
    const source = options.index ? store.index(options.index) : store;
    const range = toKeyRange(options.range);

    if (options.limit === undefined && options.direction === undefined) {
      return requestToPromise(source.getAll(range)) as Promise<T[]>;
    }

    return new Promise<T[]>((resolve, reject) => {
      const results: T[] = [];
      const request = source.openCursor(range, options.direction ?? 'next');
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor || (options.limit !== undefined && results.length >= options.limit)) {
          resolve(results);
          return;
        }
        results.push(cursor.value as T);
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async count(storeName: string, options: Pick<QueryOptions, 'index' | 'range'> = {}): Promise<number> {
    const store = await this.store(storeName, 'readonly');
    const source = options.index ? store.index(options.index) : store;
    return requestToPromise(source.count(toKeyRange(options.range)));
  }

  async delete(storeName: string, key: IDBValidKey): Promise<void> {
    const store = await this.store(storeName, 'readwrite');
    store.delete(key);
    await transactionDone(store.transaction);
  }

  async clear(storeName: string): Promise<void> {
    const store = await this.store(storeName, 'readwrite');
    store.clear();
    await transactionDone(store.transaction);
  }
}
