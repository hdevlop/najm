// ============================================================================
// najm-storage/client - Types
// ============================================================================

import type { FileCategory } from '../fileUtils';
import type { IndexSpec } from './idb';

/** Metadata for a file stored in the browser (mirrors the server-side FileInfo shape). */
export interface ClientFileInfo {
  namespace: string;
  filePath: string;
  mimeType: string;
  size: number;
  category: FileCategory;
  createdAt: string;
  updatedAt: string;
}

export interface ClientNamespaceInfo {
  name: string;
  fileCount: number;
  totalBytes: number;
}

export type ClientFileData = Blob | ArrayBuffer | Uint8Array | string;

export interface SaveFileOptions {
  /** Explicit MIME type. Defaults to File/Blob type, then inference from the path. */
  mimeType?: string;
}

/** Declaration of an application data store (IndexedDB object store). */
export interface DataStoreSpec {
  name: string;
  /** Key path within stored values (default: 'id'). */
  keyPath?: string | string[];
  /** Auto-generate numeric keys instead of reading them from values. */
  autoIncrement?: boolean;
  indexes?: IndexSpec[];
}

/** Key constraint translated to an IDBKeyRange. */
export interface QueryRange {
  eq?: IDBValidKey;
  gt?: IDBValidKey;
  gte?: IDBValidKey;
  lt?: IDBValidKey;
  lte?: IDBValidKey;
}

export interface QueryOptions {
  /** Query against this index instead of the primary key. */
  index?: string;
  range?: QueryRange;
  limit?: number;
  direction?: IDBCursorDirection;
}

export interface ClientStorageConfig {
  /** IndexedDB database name (default: 'najm-storage'). */
  db?: string;
  /** Application data stores available via `storage.data`. */
  stores?: DataStoreSpec[];
}
