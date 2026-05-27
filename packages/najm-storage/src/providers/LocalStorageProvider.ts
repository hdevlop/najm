// ============================================================================
// najm-storage - Local Filesystem Provider
// ============================================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import type { IStorageProvider, FileInfo, ListOptions, ListResult, NamespaceInfo, BucketConfig } from '../types';
import { getFileCategoryFromMimeType, inferMimeTypeFromPath } from '../fileUtils';

const FOLDER_PLACEHOLDER = '.keep';

function isFolderPlaceholder(filePath: string): boolean {
  return filePath === FOLDER_PLACEHOLDER || filePath.endsWith(`/${FOLDER_PLACEHOLDER}`);
}

export class LocalStorageProvider implements IStorageProvider {
  constructor(private readonly basePath: string) {}

  private resolve(namespace: string, filePath: string): string {
    return join(this.basePath, namespace, filePath);
  }

  async get(namespace: string, filePath: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(this.resolve(namespace, filePath));
    } catch {
      return null;
    }
  }

  async getInfo(namespace: string, filePath: string): Promise<FileInfo | null> {
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
  }

  async delete(namespace: string, filePath: string): Promise<boolean> {
    try {
      await fs.unlink(this.resolve(namespace, filePath));
      return true;
    } catch {
      try {
        await fs.unlink(join(this.basePath, namespace, '.trash', filePath));
        return true;
      } catch {
        return false;
      }
    }
  }

  async list(namespace: string): Promise<FileInfo[]> {
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
  }

  async copyFile(namespace: string, from: string, to: string): Promise<void> {
    const src = this.resolve(namespace, from);
    const dst = this.resolve(namespace, to);
    await fs.mkdir(dirname(dst), { recursive: true });
    await fs.copyFile(src, dst);
  }

  async softDelete(namespace: string, filePath: string): Promise<boolean> {
    const src = this.resolve(namespace, filePath);
    const dst = join(this.basePath, namespace, '.trash', filePath);
    try {
      await fs.mkdir(dirname(dst), { recursive: true });
      await fs.rename(src, dst);
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
