// ============================================================================
// najm-storage - Storage Service
// ============================================================================

import { readFile, stat } from 'node:fs/promises';
import { resolve as resolvePath } from 'node:path';
import { Service, Meta, Inject, DI, Container, LoggerService } from 'najm-core';
import { Events } from 'najm-event';
import { STORAGE_CONFIG } from './tokens';
import type { StorageConfig, IStorageProvider, FileInfo, StorageSchema, StorageDialect, ProcessFileOptions, ListOptions, ListResult, NamespaceInfo, UsageSummary, UsageCategory, BucketConfig, PreviewOptions } from './types';
import { LocalStorageProvider } from './providers/LocalStorageProvider';
import { DbStorageProvider } from './providers/DbStorageProvider';
import { storageSchema as pgSchema } from './schema/pg';
import { storageSchema as sqliteSchema } from './schema/sqlite';
import { storageSchema as mysqlSchema } from './schema/mysql';
import { StorageValidator } from './StorageValidator';
import { isStoragePath, isFileObject, getFileExtension, FileCategory } from './fileUtils';

function detectDialect(db: any): StorageDialect {
  const name: string = db?.dialect?.constructor?.name?.toLowerCase() ?? '';
  if (name.includes('mysql')) return 'mysql';
  if (name.includes('pg') || name.includes('postgres')) return 'pg';
  return 'sqlite'; // covers SQLiteAsyncDialect, SQLiteSyncDialect, and fallback
}

function schemaForDialect(dialect: StorageDialect): StorageSchema {
  if (dialect === 'pg') return pgSchema;
  if (dialect === 'mysql') return mysqlSchema;
  return sqliteSchema;
}

function summarizeUsage(files: FileInfo[]): UsageSummary {
  const categoryMap = new Map<string, UsageCategory>();
  let totalBytes = 0;

  for (const f of files) {
    totalBytes += f.size;
    const key = f.category.toLowerCase();
    const existing = categoryMap.get(key);
    if (existing) {
      existing.count++;
      existing.bytes += f.size;
    } else {
      categoryMap.set(key, { category: key, count: 1, bytes: f.size });
    }
  }

  return {
    totalBytes,
    totalCount: files.length,
    categories: Array.from(categoryMap.values()),
  };
}

function encodePathSegments(path: string): string {
  return path.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

function parseBoundedInt(value: number | undefined, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.min(Math.max(min, Math.round(value)), max);
}

@Service()
@Meta({ layer: 'plugin' })
export class StorageService {
  @DI() private container!: Container;
  @Inject(STORAGE_CONFIG) private config!: StorageConfig;
  @Inject(LoggerService) private log!: LoggerService;
  @Inject(StorageValidator) private validator!: StorageValidator;
  @Events() private events!: { emit: (event: string, data?: any) => void; on: (event: string, handler: (data: any) => void) => void };

  private provider!: IStorageProvider;

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  async configure(): Promise<void> {
    if (this.config.provider === 'database') {
      const dbName = this.config.database ?? 'default';
      const db = this.container.get(`Database:${dbName}`);
      const dialect = this.config.dialect ?? detectDialect(db);
      const schema = this.config.schema ?? schemaForDialect(dialect);

      this.log.info(`Storage: using ${dialect} schema for database "${dbName}"`);
      this.provider = new DbStorageProvider(db, schema, dialect);
    } else {
      const basePath = this.config.basePath ?? 'storage';
      this.provider = new LocalStorageProvider(basePath, this.config.preview);
    }

    // Auto-create fixed buckets from config
    await this.seedFixedBuckets();
  }

  private async seedFixedBuckets(): Promise<void> {
    if (!this.config.buckets?.length) return;
    for (const item of this.config.buckets) {
      const config: BucketConfig = typeof item === 'string' ? { name: item } : item;
      try {
        if (this.provider.createBucket) {
          await this.provider.createBucket(config);
          this.log.info(`Storage: auto-created bucket "${config.name}"`);
        }
      } catch (err: any) {
        if (err?.message?.includes('already exists')) {
          this.log.info(`Storage: bucket "${config.name}" already exists`);
        } else {
          this.log.error(`Storage: failed to create bucket "${config.name}"`, err);
        }
      }
    }
  }

  async activate(): Promise<void> {
    if (this.config.enableCascadeDelete !== false) {
      this.events.on('namespace:deleted', async ({ namespace }: { namespace: string }) => {
        try {
          await this.provider.deleteAll(namespace);
          this.log.info(`Storage: cascade-deleted all files for namespace "${namespace}"`);
        } catch (err) {
          this.log.error(`Storage: cascade-delete failed for namespace "${namespace}"`, err);
        }
      });
    }
  }

  async onReady(): Promise<void> {
    this.log.info(`Storage plugin ready: provider=${this.config.provider}`);
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  async listFiles(namespace: string): Promise<FileInfo[]> {
    const safeNamespace = this.validator.validateNamespace(namespace);
    return this.list(safeNamespace);
  }

  async getFileInfo(namespace: string, rawPath: string): Promise<FileInfo> {
    const target = this.validator.resolveTarget(namespace, rawPath);
    return this.getInfoOrThrow(target.namespace, target.filePath);
  }

  async serveFile(namespace: string, rawPath: string): Promise<Response> {
    const target = this.validator.resolveTarget(namespace, rawPath);
    const data = await this.get(target.namespace, target.filePath);
    const fileData = this.validator.ensureFileExists(data, target.filePath);
    const mimeType = this.validator.resolveMimeType(null, target.filePath);
    const cacheMaxAge = this.config.cacheMaxAge ?? 31536000;

    return new Response(new Uint8Array(fileData), {
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(fileData.length),
        'Cache-Control': `public, max-age=${cacheMaxAge}`,
      },
    });
  }

  async servePreview(namespace: string, rawPath: string, opts: PreviewOptions): Promise<Response | null> {
    if (!this.config.preview?.enabled) return null;
    const target = this.validator.resolveTarget(namespace, rawPath);
    const info = await this.getInfoOrThrow(target.namespace, target.filePath);
    if (info.category !== FileCategory.IMAGE) return null;
    if (!this.provider.getPreview) return null;
    const previewOptions = this.normalizePreviewOptions(opts);
    const data = await this.provider.getPreview!(target.namespace, target.filePath, previewOptions);
    if (!data) return null;
    const contentType = previewOptions.format === 'original'
      ? info.mimeType
      : `image/${previewOptions.format}`;
    return new Response(data as any, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  }

  private normalizePreviewOptions(opts: PreviewOptions): PreviewOptions {
    const maxDimension = this.config.preview?.maxDimension ?? 2048;
    const defaultQuality = this.config.preview?.defaultQuality ?? 80;
    const width = parseBoundedInt(opts.width, 1, maxDimension);
    const height = parseBoundedInt(opts.height, 1, maxDimension);
    const quality = parseBoundedInt(opts.quality, 1, 100) ?? defaultQuality;
    const format = opts.format ?? 'original';
    const fit = opts.fit ?? 'cover';
    return { width, height, quality, format, fit };
  }

  async uploadFile(
    namespace: string,
    rawPath: string,
    body: ArrayBuffer,
    contentType: string | undefined,
  ): Promise<{ message: string; namespace: string; filePath: string; size: number; mimeType: string }> {
    const target = this.validator.resolveUploadTarget(namespace, rawPath, contentType);
    const data = Buffer.from(body);

    await this.save(target.namespace, target.filePath, data, target.mimeType);

    return {
      message: 'File uploaded',
      namespace: target.namespace,
      filePath: target.filePath,
      size: data.length,
      mimeType: target.mimeType,
    };
  }

  async deleteFile(namespace: string, rawPath: string): Promise<{ message: string; namespace: string; filePath: string }> {
    const target = this.validator.resolveTarget(namespace, rawPath);
    await this.deleteOrThrow(target.namespace, target.filePath);

    return {
      message: 'File deleted',
      namespace: target.namespace,
      filePath: target.filePath,
    };
  }

  async deleteNamespace(namespace: string): Promise<{ message: string; namespace: string }> {
    const safeNamespace = this.validator.validateNamespace(namespace);
    await this.deleteAll(safeNamespace);

    return {
      message: 'Namespace deleted',
      namespace: safeNamespace,
    };
  }

  async get(namespace: string, filePath: string): Promise<Buffer | null> {
    const target = this.validator.resolveTarget(namespace, filePath);
    return this.provider.get(target.namespace, target.filePath);
  }

  async save(
    namespace: string,
    filePath: string,
    data: Buffer,
    mimeType: string,
  ): Promise<void> {
    const target = this.validator.resolveUploadTarget(namespace, filePath, mimeType);

    this.validator.validateSize(data.length);
    this.validator.validateSecurity(target.mimeType, target.filePath);
    this.validator.validateCategory(target.mimeType);

    await this.provider.save(target.namespace, target.filePath, data, target.mimeType);
    this.events.emit('storage.saved', {
      namespace: target.namespace,
      filePath: target.filePath,
      mimeType: target.mimeType,
      size: data.length,
    });
  }

  async createFolder(namespace: string, folderPath: string): Promise<string> {
    const cleaned = folderPath.replace(/^\/+|\/+$/g, '');
    if (!cleaned) throw new Error('Folder path is required');
    const placeholder = `${cleaned}/.keep`;
    const target = this.validator.resolveTarget(namespace, placeholder);
    await this.provider.save(target.namespace, target.filePath, Buffer.alloc(0), 'application/octet-stream');
    this.events.emit('storage.saved', {
      namespace: target.namespace,
      filePath: target.filePath,
      mimeType: 'application/octet-stream',
      size: 0,
    });
    return target.filePath;
  }

  async delete(namespace: string, filePath: string): Promise<boolean> {
    const target = this.validator.resolveTarget(namespace, filePath);
    const deleted = await this.provider.delete(target.namespace, target.filePath);

    if (deleted) {
      this.events.emit('storage.deleted', { namespace: target.namespace, filePath: target.filePath });
    }

    return deleted;
  }

  async getInfo(namespace: string, filePath: string): Promise<FileInfo | null> {
    const target = this.validator.resolveTarget(namespace, filePath);
    return this.provider.getInfo(target.namespace, target.filePath);
  }

  async getInfoOrThrow(namespace: string, filePath: string, message?: string): Promise<FileInfo> {
    const target = this.validator.resolveTarget(namespace, filePath);
    const info = await this.provider.getInfo(target.namespace, target.filePath);
    return this.validator.ensureFileExists(info, target.filePath, message);
  }

  async list(namespace: string): Promise<FileInfo[]> {
    const safeNamespace = this.validator.validateNamespace(namespace);
    return this.provider.list(safeNamespace);
  }

  async deleteAll(namespace: string): Promise<void> {
    const safeNamespace = this.validator.validateNamespace(namespace);

    await this.provider.deleteAll(safeNamespace);
    this.events.emit('storage.namespace.deleted', { namespace: safeNamespace });
  }

  async deleteOrThrow(namespace: string, filePath: string, message?: string): Promise<void> {
    const target = this.validator.resolveTarget(namespace, filePath);
    const deleted = await this.delete(target.namespace, target.filePath);
    this.validator.ensureDeleteSucceeded(deleted, target.filePath, message);
  }

  async saveBase64(namespace: string, filePath: string, base64: string, mimeType?: string): Promise<void> {
    const target = this.validator.resolveUploadTarget(namespace, filePath, mimeType);
    const data = this.validator.decodeBase64(base64);
    await this.save(target.namespace, target.filePath, data, target.mimeType);
  }

  async uploadBase64File(namespace: string, filePath: string, base64: string, mimeType?: string): Promise<FileInfo> {
    await this.saveBase64(namespace, filePath, base64, mimeType);
    return this.getInfoOrThrow(namespace, filePath);
  }

  async uploadFromPath(namespace: string, filePath: string, sourcePath: string): Promise<FileInfo> {
    const absolute = resolvePath(sourcePath);
    const info = await stat(absolute).catch(() => null);
    if (!info || !info.isFile()) {
      throw new Error(`Source file not found: ${absolute}`);
    }
    const data = await readFile(absolute);
    const mimeType = this.validator.resolveMimeType(null, absolute);
    await this.save(namespace, filePath, Buffer.from(data), mimeType);
    return this.getInfoOrThrow(namespace, filePath);
  }

  async copy(sourceNs: string, targetNs: string): Promise<void> {
    const safeSource = this.validator.validateNamespace(sourceNs);
    const safeTarget = this.validator.validateNamespace(targetNs);
    return this.provider.copy(safeSource, safeTarget);
  }

  // ============================================================================
  // STUDIO API — higher-level methods for the admin UI
  // ============================================================================

  async listNamespaces(): Promise<NamespaceInfo[]> {
    if (!this.provider.listNamespaces) throw new Error('Provider does not support namespace listing');
    return this.provider.listNamespaces();
  }

  async listBuckets(): Promise<BucketConfig[]> {
    if (!this.provider.listBuckets) throw new Error('Provider does not support bucket listing');
    return this.provider.listBuckets();
  }

  async createBucket(config: BucketConfig): Promise<void> {
    this.validator.validateNamespace(config.name);
    if (!this.provider.createBucket) throw new Error('Provider does not support bucket creation');
    return this.provider.createBucket(config);
  }

  async updateBucket(name: string, patch: Partial<BucketConfig>): Promise<void> {
    if (patch.name) this.validator.validateNamespace(patch.name);
    if (!this.provider.updateBucket) throw new Error('Provider does not support bucket updates');
    return this.provider.updateBucket(name, patch);
  }

  async deleteBucket(name: string): Promise<void> {
    if (!this.provider.deleteBucket) throw new Error('Provider does not support bucket deletion');
    return this.provider.deleteBucket(name);
  }

  async listObjects(namespace: string, options?: ListOptions): Promise<ListResult> {
    const safeNamespace = this.validator.validateNamespace(namespace);
    if (this.provider.listObjects) return this.provider.listObjects(safeNamespace, options);
    return { files: await this.provider.list(safeNamespace), folders: [], nextCursor: null };
  }

  async moveFile(namespace: string, from: string, to: string): Promise<void> {
    if (!this.provider.move) throw new Error('Provider does not support move');
    const safeNs = this.validator.validateNamespace(namespace);
    const safeFrom = this.validator.normalizePath(from);
    const safeTo = this.validator.normalizePath(to);
    await this.provider.move(safeNs, safeFrom, safeTo);
    this.events.emit('storage.moved', { namespace: safeNs, from: safeFrom, to: safeTo });
  }

  async copyFile(namespace: string, from: string, to: string): Promise<void> {
    if (!this.provider.copyFile) throw new Error('Provider does not support copyFile');
    const safeNs = this.validator.validateNamespace(namespace);
    const safeFrom = this.validator.normalizePath(from);
    const safeTo = this.validator.normalizePath(to);
    await this.provider.copyFile(safeNs, safeFrom, safeTo);
    this.events.emit('storage.copied', { namespace: safeNs, from: safeFrom, to: safeTo });
  }

  async batchDelete(namespace: string, paths: string[], opts: { hard?: boolean } = {}): Promise<{ deleted: string[]; failed: string[] }> {
    const safeNamespace = this.validator.validateNamespace(namespace);
    const deleted: string[] = [];
    const failed: string[] = [];
    for (const raw of paths) {
      try {
        const filePath = this.validator.normalizePath(raw);
        let ok = false;
        if (!opts.hard && this.provider.softDelete) {
          ok = await this.provider.softDelete(safeNamespace, filePath);
        }
        // Fall back to hard delete when soft delete is unsupported or failed
        if (!ok) ok = await this.provider.delete(safeNamespace, filePath);
        if (ok) deleted.push(raw);
        else failed.push(raw);
      } catch {
        failed.push(raw);
      }
    }
    this.events.emit('storage.batchDeleted', { namespace: safeNamespace, deleted });
    return { deleted, failed };
  }

  async softDeleteFile(namespace: string, filePath: string): Promise<boolean> {
    if (!this.provider.softDelete) throw new Error('Provider does not support soft delete');
    const target = this.validator.resolveTarget(namespace, filePath);
    const ok = await this.provider.softDelete(target.namespace, target.filePath);
    if (ok) this.events.emit('storage.deleted', { namespace: target.namespace, filePath: target.filePath });
    return ok;
  }

  async restoreFile(namespace: string, filePath: string): Promise<boolean> {
    if (!this.provider.restore) throw new Error('Provider does not support restore');
    const target = this.validator.resolveTarget(namespace, filePath);
    return this.provider.restore(target.namespace, target.filePath);
  }

  async listTrash(): Promise<FileInfo[]> {
    if (!this.provider.listTrash) return [];
    return this.provider.listTrash();
  }

  async presign(namespace: string, filePath: string, method: string, ttlSeconds: number): Promise<string> {
    const target = this.validator.resolveTarget(namespace, filePath);
    if (this.provider.presign) {
      return this.provider.presign(target.namespace, target.filePath, method, ttlSeconds);
    }
    // Fallback for providers without native presign: return direct serve path
    return this.getServePath(target.namespace, target.filePath);
  }

  async getUsage(): Promise<UsageSummary> {
    const namespaces = await this.listNamespaces();
    const allFiles = (await Promise.all(namespaces.map((ns) => this.provider.list(ns.name)))).flat();
    // Exclude soft-deleted files from usage accounting
    const activeFiles = allFiles.filter((f) => !f.deletedAt);
    return summarizeUsage(activeFiles);
  }

  // ============================================================================
  // DX API — high-level helpers for common file patterns
  // ============================================================================

  /**
   * Returns the HTTP path used to serve a file.
   *
   * @example
   * storage.getServePath('students', 'avatar.png')
   * // → '/students/files/serve/avatar.png'
   * // → '/api/students/files/serve/avatar.png'  (when servePrefix: '/api')
   */
  getServePath(namespace: string, filePath: string): string {
    const prefix = this.config.servePrefix ?? '';
    return `${prefix}/${encodeURIComponent(namespace)}/files/serve/${encodePathSegments(filePath)}`;
  }

  getPreviewPath(namespace: string, filePath: string, opts?: PreviewOptions): string {
    const prefix = this.config.servePrefix ?? '';
    const qs = new URLSearchParams();
    if (opts?.width) qs.set('w', String(opts.width));
    if (opts?.height) qs.set('h', String(opts.height));
    if (opts?.quality) qs.set('q', String(opts.quality));
    if (opts?.format && opts.format !== 'original') qs.set('format', opts.format);
    if (opts?.fit) qs.set('fit', opts.fit);
    const query = qs.toString();
    return `${prefix}/${encodeURIComponent(namespace)}/files/preview/${encodePathSegments(filePath)}${query ? `?${query}` : ''}`;
  }

  /**
   * Saves a Web API `File` or `Blob` directly — no manual Buffer conversion needed.
   * Returns the FileInfo of the saved file.
   *
   * @example
   * const info = await storage.saveFile('students', 'avatar.png', file);
   */
  async saveFile(namespace: string, filePath: string, file: File | Blob): Promise<FileInfo> {
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || 'application/octet-stream';
    await this.save(namespace, filePath, buffer, mimeType);
    return this.getInfoOrThrow(namespace, filePath);
  }

  /**
   * Smart file handler — the single method for all upload patterns.
   *
   * Accepts `File | Blob | string | null | undefined` and resolves to a serve path:
   * - If `input` is already a path string (starts with `/`, `http`, `storage/`) → returns it unchanged
   * - If `input` is a File/Blob → uploads it and returns the serve path
   * - If `input` is null/undefined and `options.fallback` is set → returns the fallback
   * - Otherwise → returns null
   *
   * @example
   * // In StudentService.create():
   * const avatarPath = await storage.processFile(
   *   studentId,
   *   data.image,
   *   { filePath: 'avatar.png', fallback: '/images/student_male.png' }
   * );
   */
  async processFile(
    namespace: string,
    input: File | Blob | string | null | undefined,
    options: ProcessFileOptions = {},
  ): Promise<string | null> {
    // Already a stored path — return as-is
    if (isStoragePath(input)) {
      return input as string;
    }

    // File or Blob — upload it
    if (isFileObject(input)) {
      const file = input as File | Blob;
      const ext = getFileExtension(file);
      const filePath = options.filePath ?? `file.${ext}`;
      await this.saveFile(namespace, filePath, file);
      return this.getServePath(namespace, filePath);
    }

    // Nothing to upload — use fallback
    return options.fallback ?? null;
  }

  /**
   * Emits a `namespace:deleted` event, triggering cascade deletion of all files
   * associated with the given namespace (when `enableCascadeDelete` is true).
   *
   * Call this when deleting an entity to automatically clean up its files.
   *
   * @example
   * await studentRepository.delete(id);
   * storage.emitDeleted(id);
   */
  emitDeleted(namespace: string): void {
    this.events.emit('namespace:deleted', { namespace });
  }
}
