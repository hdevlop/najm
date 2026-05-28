// ============================================================================
// najm-storage - Local Filesystem Provider
// ============================================================================

import { promises as fs } from 'fs';
import { join, dirname, extname } from 'path';
import { createHash } from 'crypto';
import type { IStorageProvider, FileInfo, ListOptions, ListResult, NamespaceInfo, BucketConfig, PreviewOptions, PreviewConfig } from '../types';
import { FileCategory, getFileCategoryFromMimeType, inferMimeTypeFromPath } from '../fileUtils';

const FOLDER_PLACEHOLDER = '.keep';

function isFolderPlaceholder(filePath: string): boolean {
  return filePath === FOLDER_PLACEHOLDER || filePath.endsWith(`/${FOLDER_PLACEHOLDER}`);
}

function normalizePreviewCacheDir(cacheDir: string | undefined): string {
  const normalized = (cacheDir ?? '.thumbnails')
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment && segment !== '.' && segment !== '..')
    .join('/');
  const safe = normalized || '.thumbnails';
  return safe.split('/')[0]?.startsWith('.') ? safe : `.${safe}`;
}

function parseBoundedInt(value: number | undefined, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.min(Math.max(min, Math.round(value)), max);
}

export class LocalStorageProvider implements IStorageProvider {
  private readonly previewConfig?: PreviewConfig;
  private readonly inflight = new Map<string, Promise<Uint8Array | null>>();

  constructor(private readonly basePath: string, previewConfig?: PreviewConfig) {
    this.previewConfig = previewConfig
      ? { ...previewConfig, cacheDir: normalizePreviewCacheDir(previewConfig.cacheDir) }
      : undefined;
  }

  private resolve(namespace: string, filePath: string): string {
    return join(this.basePath, namespace, filePath);
  }

  private get previewCacheRoot(): string {
    return join(this.basePath, this.previewConfig?.cacheDir ?? '.thumbnails');
  }

  private isPreviewCacheNamespace(namespace: string): boolean {
    const rootSegment = (this.previewConfig?.cacheDir ?? '.thumbnails').replace(/\\/g, '/').split('/')[0];
    return namespace === rootSegment;
  }

  async get(namespace: string, filePath: string): Promise<Buffer | null> {
    if (this.isPreviewCacheNamespace(namespace)) return null;
    try {
      return await fs.readFile(this.resolve(namespace, filePath));
    } catch {
      return null;
    }
  }

  async getInfo(namespace: string, filePath: string): Promise<FileInfo | null> {
    if (this.isPreviewCacheNamespace(namespace)) return null;
    try {
      const full = this.resolve(namespace, filePath);
      const stat = await fs.stat(full);
      const mimeType = inferMimeTypeFromPath(filePath) ?? 'application/octet-stream';

      return {
        namespace,
        filePath,
        mimeType,
        size: stat.size,
        category: getFileCategoryFromMimeType(mimeType),
        createdAt: stat.birthtime.toISOString(),
        updatedAt: stat.mtime.toISOString(),
      };
    } catch {
      return null;
    }
  }

  async save(namespace: string, filePath: string, data: Buffer, _mimeType: string): Promise<void> {
    const dest = this.resolve(namespace, filePath);
    await fs.mkdir(dirname(dest), { recursive: true });
    await fs.writeFile(dest, data);
    await this.invalidatePreviewCache(namespace, filePath);
  }

  async delete(namespace: string, filePath: string): Promise<boolean> {
    try {
      await fs.unlink(this.resolve(namespace, filePath));
      await this.invalidatePreviewCache(namespace, filePath);
      return true;
    } catch {
      try {
        await fs.unlink(join(this.basePath, namespace, '.trash', filePath));
        await this.invalidatePreviewCache(namespace, filePath);
        return true;
      } catch {
        return false;
      }
    }
  }

  async list(namespace: string): Promise<FileInfo[]> {
    if (this.isPreviewCacheNamespace(namespace)) return [];
    const nsDir = join(this.basePath, namespace);
    try {
      const entries = await this.readDirRecursive(nsDir);
      const infos: FileInfo[] = [];

      for (const entry of entries) {
        try {
          const relPath = entry.full.slice(nsDir.length + 1).replace(/\\/g, '/');
          if (relPath.startsWith('.trash')) continue;
          if (isFolderPlaceholder(relPath)) continue;
          const stat = await fs.stat(entry.full);
          const mimeType = inferMimeTypeFromPath(relPath) ?? 'application/octet-stream';

          infos.push({
            namespace,
            filePath: relPath,
            mimeType,
            size: stat.size,
            category: getFileCategoryFromMimeType(mimeType),
            createdAt: stat.birthtime.toISOString(),
            updatedAt: stat.mtime.toISOString(),
          });
        } catch {
          // skip unreadable entries
        }
      }

      return infos;
    } catch {
      return [];
    }
  }

  async deleteAll(namespace: string): Promise<void> {
    const nsDir = join(this.basePath, namespace);
    try {
      await fs.rm(nsDir, { recursive: true, force: true });
    } catch {
      // namespace directory may not exist
    }
    await this.invalidateNamespacePreviewCache(namespace);
  }

  async copy(sourceNs: string, targetNs: string): Promise<void> {
    const files = await this.list(sourceNs);

    await Promise.all(
      files.map(async (file) => {
        const data = await this.get(sourceNs, file.filePath);
        if (data) {
          await this.save(targetNs, file.filePath, data, file.mimeType);
        }
      })
    );
  }

  async listObjects(namespace: string, options?: ListOptions): Promise<ListResult> {
    if (this.isPreviewCacheNamespace(namespace)) return { files: [], folders: [] };
    const base = join(this.basePath, namespace);
    const prefix = options?.prefix ?? '';
    const delimiter = options?.delimiter;
    const limit = options?.limit ?? 1000;

    const all = await this.readDirRecursive(base);
    const files: FileInfo[] = [];
    const folderSet = new Set<string>();

    for (const entry of all) {
      const rel = entry.full.slice(base.length + 1).replace(/\\/g, '/');
      if (rel.startsWith('.trash')) continue;
      if (prefix && !rel.startsWith(prefix)) continue;
      if (delimiter) {
        const rest = rel.slice(prefix.length);
        const idx = rest.indexOf(delimiter);
        if (idx >= 0) {
          folderSet.add(prefix + rest.slice(0, idx + delimiter.length));
          continue;
        }
      }
      if (isFolderPlaceholder(rel)) continue;
      const info = await this.getInfo(namespace, rel);
      if (info && !info.deletedAt) files.push(info);
      if (files.length >= limit) break;
    }

    return { files, folders: Array.from(folderSet).sort() };
  }

  async listNamespaces(): Promise<NamespaceInfo[]> {
    try {
      const entries = await fs.readdir(this.basePath, { withFileTypes: true });
      const namespaces: NamespaceInfo[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith('.')) continue;
        const files = await this.list(entry.name);
        namespaces.push({
          name: entry.name,
          fileCount: files.length,
          totalBytes: files.reduce((sum, f) => sum + f.size, 0),
        });
      }

      return namespaces;
    } catch {
      return [];
    }
  }

  async move(namespace: string, from: string, to: string): Promise<void> {
    const src = this.resolve(namespace, from);
    const dst = this.resolve(namespace, to);
    await fs.mkdir(dirname(dst), { recursive: true });
    await fs.rename(src, dst);
    await this.invalidatePreviewCache(namespace, from);
    await this.invalidatePreviewCache(namespace, to);
  }

  async copyFile(namespace: string, from: string, to: string): Promise<void> {
    const src = this.resolve(namespace, from);
    const dst = this.resolve(namespace, to);
    await fs.mkdir(dirname(dst), { recursive: true });
    await fs.copyFile(src, dst);
    await this.invalidatePreviewCache(namespace, to);
  }

  async softDelete(namespace: string, filePath: string): Promise<boolean> {
    const src = this.resolve(namespace, filePath);
    const dst = join(this.basePath, namespace, '.trash', filePath);
    try {
      await fs.mkdir(dirname(dst), { recursive: true });
      await fs.rename(src, dst);
      await this.invalidatePreviewCache(namespace, filePath);
      return true;
    } catch {
      return false;
    }
  }

  async restore(namespace: string, filePath: string): Promise<boolean> {
    const src = join(this.basePath, namespace, '.trash', filePath);
    const dst = this.resolve(namespace, filePath);
    try {
      await fs.mkdir(dirname(dst), { recursive: true });
      await fs.rename(src, dst);
      await this.invalidatePreviewCache(namespace, filePath);
      return true;
    } catch {
      return false;
    }
  }

  async listTrash(): Promise<FileInfo[]> {
    const results: FileInfo[] = [];
    try {
      const namespaces = await fs.readdir(this.basePath, { withFileTypes: true });
      for (const ns of namespaces) {
        if (!ns.isDirectory()) continue;
        const trashDir = join(this.basePath, ns.name, '.trash');
        const entries = await this.readDirRecursive(trashDir);
        for (const entry of entries) {
          const rel = entry.full.slice(trashDir.length + 1).replace(/\\/g, '/');
          if (isFolderPlaceholder(rel)) continue;
          const mimeType = inferMimeTypeFromPath(rel) ?? 'application/octet-stream';
          try {
            const stat = await fs.stat(entry.full);
            results.push({
              namespace: ns.name,
              filePath: rel,
              mimeType,
              size: stat.size,
              category: getFileCategoryFromMimeType(mimeType),
              createdAt: stat.birthtime.toISOString(),
              updatedAt: stat.mtime.toISOString(),
              deletedAt: stat.mtime.toISOString(),
            });
          } catch { /* skip unreadable */ }
        }
      }
    } catch { /* no trash */ }
    return results;
  }

  async getPreview(namespace: string, filePath: string, options: PreviewOptions): Promise<Uint8Array | null> {
    if (!this.previewConfig?.enabled) return null;

    const info = await this.getInfo(namespace, filePath);
    if (!info || info.category !== FileCategory.IMAGE) return null;

    const previewOptions = this.normalizePreviewOptions(options);
    const cacheKey = this.buildPreviewCacheKey(namespace, filePath, info.updatedAt, previewOptions);
    const cachePath = join(this.previewCacheRoot, cacheKey);

    // Deduplicate entire getPreview operation (including cache read)
    const existing = this.inflight.get(cachePath);
    if (existing) return existing;

    const promise = this.runGetPreview(namespace, filePath, cachePath, previewOptions);
    this.inflight.set(cachePath, promise);
    promise.finally(() => this.inflight.delete(cachePath));
    return promise;
  }

  private normalizePreviewOptions(options: PreviewOptions): PreviewOptions {
    const maxDim = this.previewConfig?.maxDimension ?? 2048;
    return {
      width: parseBoundedInt(options.width, 1, maxDim),
      height: parseBoundedInt(options.height, 1, maxDim),
      quality: parseBoundedInt(options.quality, 1, 100) ?? (this.previewConfig?.defaultQuality ?? 80),
      fit: options.fit ?? 'cover',
      format: options.format ?? 'original',
    };
  }

  private buildPreviewCacheKey(
    namespace: string,
    filePath: string,
    updatedAt: string,
    options: PreviewOptions,
  ): string {
    const hash = createHash('md5').update(`${namespace}/${filePath}`).digest('hex').slice(0, 16);
    const updatedHash = createHash('md5').update(updatedAt).digest('hex').slice(0, 8);
    const w = options.width ?? 0;
    const h = options.height ?? 0;
    const q = options.quality ?? (this.previewConfig?.defaultQuality ?? 80);
    const fit = options.fit ?? 'cover';
    const fmt = options.format ?? 'original';
    const ext = fmt === 'original' ? (extname(filePath).slice(1) || 'bin') : fmt;
    return `${namespace}/${hash}_${updatedHash}_${w}x${h}_q${q}_${fit}_${fmt}.${ext}`;
  }

  private async runGetPreview(
    namespace: string,
    filePath: string,
    cachePath: string,
    options: PreviewOptions,
  ): Promise<Uint8Array | null> {
    // Check cache hit
    try {
      const cached = await fs.readFile(cachePath);
      return new Uint8Array(cached);
    } catch {
      // cache miss — generate
    }

    try {
      let sharpModule: any;
      try {
        sharpModule = await import('sharp');
      } catch {
        return null; // sharp not installed
      }
      const sharp = sharpModule.default ?? sharpModule;

      const srcPath = this.resolve(namespace, filePath);
      const srcData = await fs.readFile(srcPath);
      let pipeline = sharp(srcData);

      const maxDim = this.previewConfig?.maxDimension ?? 2048;
      const width = options.width ? Math.min(Math.max(1, Math.round(options.width)), maxDim) : undefined;
      const height = options.height ? Math.min(Math.max(1, Math.round(options.height)), maxDim) : undefined;
      const quality = options.quality ? Math.min(Math.max(1, Math.round(options.quality)), 100) : (this.previewConfig?.defaultQuality ?? 80);
      const fit = options.fit ?? 'cover';

      if (width || height) {
        pipeline = pipeline.resize(width, height, { fit });
      }

      if (options.format && options.format !== 'original') {
        pipeline = pipeline.toFormat(options.format, { quality });
      } else if (width || height) {
        // Apply default quality for resized originals
        pipeline = pipeline.jpeg({ quality, progressive: true, force: false });
      }

      const buffer = await pipeline.toBuffer();
      await fs.mkdir(dirname(cachePath), { recursive: true });
      await fs.writeFile(cachePath, buffer);
      await this.enforceCacheLimit();
      return new Uint8Array(buffer);
    } catch {
      return null;
    }
  }

  private async invalidatePreviewCache(namespace: string, filePath: string): Promise<void> {
    if (!this.previewConfig?.enabled) return;
    const cacheDir = join(this.previewCacheRoot, namespace);
    const hash = createHash('md5').update(`${namespace}/${filePath}`).digest('hex').slice(0, 16);
    try {
      const entries = await fs.readdir(cacheDir);
      for (const entry of entries) {
        if (entry.startsWith(hash + '_')) {
          await fs.unlink(join(cacheDir, entry)).catch(() => {});
        }
      }
    } catch {
      // cache dir may not exist
    }
  }

  private async invalidateNamespacePreviewCache(namespace: string): Promise<void> {
    if (!this.previewConfig?.enabled) return;
    const cacheDir = join(this.previewCacheRoot, namespace);
    try {
      await fs.rm(cacheDir, { recursive: true, force: true });
    } catch {
      // cache dir may not exist
    }
  }

  private async enforceCacheLimit(): Promise<void> {
    const maxBytes = this.previewConfig?.maxCacheBytes;
    if (!maxBytes || maxBytes <= 0) return;

    const cacheRoot = this.previewCacheRoot;
    const files: { path: string; size: number; mtime: number }[] = [];
    let total = 0;

    try {
      await this.walkCacheDir(cacheRoot, files);
    } catch {
      return;
    }

    for (const f of files) {
      total += f.size;
    }

    if (total <= maxBytes) return;

    // Sort by mtime ascending (oldest first) and delete until under limit
    files.sort((a, b) => a.mtime - b.mtime);
    for (const f of files) {
      if (total <= maxBytes) break;
      try {
        await fs.unlink(f.path);
        total -= f.size;
      } catch {
        // ignore
      }
    }
  }

  private async walkCacheDir(dir: string, out: { path: string; size: number; mtime: number }[]): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await this.walkCacheDir(full, out);
      } else {
        const stat = await fs.stat(full);
        out.push({ path: full, size: stat.size, mtime: stat.mtimeMs });
      }
    }
  }

  private async readDirRecursive(dir: string): Promise<Array<{ full: string }>> {
    const results: Array<{ full: string }> = [];
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...(await this.readDirRecursive(full)));
        } else {
          results.push({ full });
        }
      }
    } catch {
      // skip
    }
    return results;
  }

  private get bucketsJsonPath(): string {
    return join(this.basePath, '.buckets.json');
  }

  private async readBuckets(): Promise<BucketConfig[]> {
    try {
      const raw = await fs.readFile(this.bucketsJsonPath, 'utf-8');
      return JSON.parse(raw) as BucketConfig[];
    } catch {
      return [];
    }
  }

  private async writeBuckets(buckets: BucketConfig[]): Promise<void> {
    await fs.mkdir(this.basePath, { recursive: true });
    await fs.writeFile(this.bucketsJsonPath, JSON.stringify(buckets, null, 2));
  }

  async listBuckets(): Promise<BucketConfig[]> {
    const buckets = await this.readBuckets();
    // Also include directories not yet in registry
    try {
      const entries = await fs.readdir(this.basePath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith('.')) continue;
        if (!buckets.find((b) => b.name === entry.name)) {
          buckets.push({ name: entry.name });
        }
      }
    } catch { /* no basePath yet */ }
    return buckets;
  }

  async createBucket(config: BucketConfig): Promise<void> {
    const buckets = await this.readBuckets();
    if (buckets.find((b) => b.name === config.name)) {
      throw new Error(`Bucket "${config.name}" already exists`);
    }
    buckets.push(config);
    await fs.mkdir(join(this.basePath, config.name), { recursive: true });
    await this.writeBuckets(buckets);
  }

  async updateBucket(name: string, patch: Partial<BucketConfig>): Promise<void> {
    const buckets = await this.readBuckets();
    const idx = buckets.findIndex((b) => b.name === name);
    if (idx === -1) {
      // if directory exists, promote to registered bucket
      try {
        const stat = await fs.stat(join(this.basePath, name));
        if (stat.isDirectory()) {
          buckets.push({ name, ...patch });
          await this.writeBuckets(buckets);
          return;
        }
      } catch { /* not found */ }
      throw new Error(`Bucket "${name}" not found`);
    }
    buckets[idx] = { ...buckets[idx], ...patch, name: buckets[idx].name };
    if (patch.name && patch.name !== name) {
      await fs.rename(join(this.basePath, name), join(this.basePath, patch.name));
    }
    await this.writeBuckets(buckets);
  }

  async deleteBucket(name: string): Promise<void> {
    const buckets = await this.readBuckets();
    const bucket = buckets.find((b) => b.name === name);
    if (bucket?.protected) {
      throw new Error(`Bucket "${name}" is protected and cannot be deleted`);
    }
    const filtered = buckets.filter((b) => b.name !== name);
    await this.writeBuckets(filtered);
    try {
      await fs.rm(join(this.basePath, name), { recursive: true, force: true });
    } catch { /* may not exist */ }
  }
}
