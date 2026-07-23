// ============================================================================
// najm-storage/client - Browser storage (IndexedDB)
// ============================================================================
// Browser-only module: file storage (blobs by namespace/path) and application
// data stores (JSON documents with indexes), both persisted in IndexedDB.
// Never import this from server code — use the `najm-storage` root entry there.

import { ClientDataStore } from './ClientDataStore';
import { ClientFileStore, FILES_STORE } from './ClientFileStore';
import { deleteDatabase, openDatabase, type StoreSpec } from './idb';
import type { ClientStorageConfig } from './types';

export type { IndexSpec, StoreSpec } from './idb';
export type {
  ClientFileData,
  ClientFileInfo,
  ClientNamespaceInfo,
  ClientStorageConfig,
  DataStoreSpec,
  QueryOptions,
  QueryRange,
  SaveFileOptions,
} from './types';
export { ClientDataStore } from './ClientDataStore';
export { ClientFileStore } from './ClientFileStore';
export { FileCategory, getReadableFileSize } from '../fileUtils';

const DEFAULT_DB_NAME = 'najm-storage';

export interface ClientStorage {
  /** Blob/file storage: save, get, list, delete by namespace + path. */
  files: ClientFileStore;
  /** Application data stores declared via `config.stores`. */
  data: ClientDataStore;
  /** Close the underlying IndexedDB connection. */
  close(): Promise<void>;
  /** Close and permanently delete the entire database (files and data). */
  destroy(): Promise<void>;
}

export function createClientStorage(config: ClientStorageConfig = {}): ClientStorage {
  const dbName = config.db ?? DEFAULT_DB_NAME;
  const dataStores = config.stores ?? [];

  const reserved = dataStores.find((s) => s.name === FILES_STORE);
  if (reserved) throw new Error(`Store name "${FILES_STORE}" is reserved for file storage.`);

  const specs: StoreSpec[] = [
    { name: FILES_STORE, keyPath: ['namespace', 'filePath'], indexes: [{ name: 'namespace', keyPath: 'namespace' }] },
    ...dataStores.map((s) => ({
      name: s.name,
      keyPath: s.keyPath ?? (s.autoIncrement ? undefined : 'id'),
      autoIncrement: s.autoIncrement,
      indexes: s.indexes,
    })),
  ];

  // Lazy: nothing touches IndexedDB until first use, so importing (or even
  // constructing) during SSR is safe.
  let dbPromise: Promise<IDBDatabase> | null = null;
  const db = () => (dbPromise ??= openDatabase(dbName, specs));

  const close = async () => {
    if (!dbPromise) return;
    const openDb = await dbPromise;
    openDb.close();
    dbPromise = null;
  };

  return {
    files: new ClientFileStore(db),
    data: new ClientDataStore(db, new Set(dataStores.map((s) => s.name))),
    close,
    destroy: async () => {
      await close();
      await deleteDatabase(dbName);
    },
  };
}
