// ============================================================================
// najm-storage/client - IndexedDB File Store
// ============================================================================

import { getFileCategoryFromMimeType, inferMimeTypeFromPath } from '../fileUtils';
import { requestToPromise, transactionDone } from './idb';
import type { ClientFileData, ClientFileInfo, ClientNamespaceInfo, SaveFileOptions } from './types';

export const FILES_STORE = '__najm_files__';
const NAMESPACE_INDEX = 'namespace';

interface FileRecord extends ClientFileInfo {
  /** Stored as ArrayBuffer — safe to structured-clone in every IndexedDB implementation. */
  data: ArrayBuffer;
}

function normalizePath(value: string, label: string): string {
  const normalized = value
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment && segment !== '.')
    .join('/');
  if (!normalized || normalized.split('/').includes('..')) {
    throw new Error(`Invalid ${label}: "${value}"`);
  }
  return normalized;
}

async function toArrayBuffer(data: ClientFileData): Promise<ArrayBuffer> {
  if (typeof data === 'string') {
    const bytes = new TextEncoder().encode(data);
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  }
  if (data instanceof Uint8Array) {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  }
  if (data instanceof ArrayBuffer) return data;
  return data.arrayBuffer();
}

function resolveMimeType(data: ClientFileData, filePath: string, options?: SaveFileOptions): string {
  const raw = options?.mimeType
    ?? (data instanceof Blob && data.type ? data.type : null)
    ?? inferMimeTypeFromPath(filePath)
    ?? (typeof data === 'string' ? 'text/plain' : 'application/octet-stream');
  // Strip parameters ('text/plain;charset=utf-8') so category lookup matches.
  return raw.split(';')[0].trim().toLowerCase();
}

function toInfo(record: FileRecord): ClientFileInfo {
  const { data: _data, ...info } = record;
  return info;
}

export class ClientFileStore {
  constructor(private readonly db: () => Promise<IDBDatabase>) {}

  private async store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.db();
    return db.transaction(FILES_STORE, mode).objectStore(FILES_STORE);
  }

  async save(namespace: string, filePath: string, data: ClientFileData, options?: SaveFileOptions): Promise<ClientFileInfo> {
    const ns = normalizePath(namespace, 'namespace');
    const path = normalizePath(filePath, 'file path');
    const buffer = await toArrayBuffer(data);
    const mimeType = resolveMimeType(data, path, options);
    const now = new Date().toISOString();

    const store = await this.store('readwrite');
    const existing = (await requestToPromise(store.get([ns, path]))) as FileRecord | undefined;
    const record: FileRecord = {
      namespace: ns,
      filePath: path,
      data: buffer,
      mimeType,
      size: buffer.byteLength,
      category: getFileCategoryFromMimeType(mimeType),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    store.put(record);
    await transactionDone(store.transaction);
    return toInfo(record);
  }

  async get(namespace: string, filePath: string): Promise<Blob | null> {
    const store = await this.store('readonly');
    const record = (await requestToPromise(
      store.get([normalizePath(namespace, 'namespace'), normalizePath(filePath, 'file path')])
    )) as FileRecord | undefined;
    return record ? new Blob([record.data], { type: record.mimeType }) : null;
  }

  async getInfo(namespace: string, filePath: string): Promise<ClientFileInfo | null> {
    const store = await this.store('readonly');
    const record = (await requestToPromise(
      store.get([normalizePath(namespace, 'namespace'), normalizePath(filePath, 'file path')])
    )) as FileRecord | undefined;
    return record ? toInfo(record) : null;
  }

  /** Returns a temporary object URL for the stored file (caller revokes via URL.revokeObjectURL). */
  async objectUrl(namespace: string, filePath: string): Promise<string | null> {
    const blob = await this.get(namespace, filePath);
    return blob ? URL.createObjectURL(blob) : null;
  }

  async list(namespace: string): Promise<ClientFileInfo[]> {
    const store = await this.store('readonly');
    const records = (await requestToPromise(
      store.index(NAMESPACE_INDEX).getAll(normalizePath(namespace, 'namespace'))
    )) as FileRecord[];
    return records.map(toInfo);
  }

  async delete(namespace: string, filePath: string): Promise<boolean> {
    const key = [normalizePath(namespace, 'namespace'), normalizePath(filePath, 'file path')];
    const store = await this.store('readwrite');
    const existing = await requestToPromise(store.getKey(key));
    if (existing === undefined) return false;
    store.delete(key);
    await transactionDone(store.transaction);
    return true;
  }

  async deleteAll(namespace: string): Promise<void> {
    const ns = normalizePath(namespace, 'namespace');
    const store = await this.store('readwrite');
    const keys = await requestToPromise(store.index(NAMESPACE_INDEX).getAllKeys(ns));
    for (const key of keys) store.delete(key);
    await transactionDone(store.transaction);
  }

  async listNamespaces(): Promise<ClientNamespaceInfo[]> {
    const store = await this.store('readonly');
    const records = (await requestToPromise(store.getAll())) as FileRecord[];
    const namespaces = new Map<string, ClientNamespaceInfo>();
    for (const record of records) {
      const entry = namespaces.get(record.namespace) ?? { name: record.namespace, fileCount: 0, totalBytes: 0 };
      entry.fileCount += 1;
      entry.totalBytes += record.size;
      namespaces.set(record.namespace, entry);
    }
    return [...namespaces.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
}
