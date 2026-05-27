// ============================================================================
// najm-storage - Database Provider (dialect-agnostic via Drizzle)
// ============================================================================

import { eq, and, like, isNull, desc, sql } from 'drizzle-orm';
import type { IStorageProvider, FileInfo, StorageSchema, StorageDialect, ListOptions, ListResult, NamespaceInfo, BucketConfig } from '../types';
import { FileCategory, getFileCategoryFromMimeType } from '../fileUtils';

const FOLDER_PLACEHOLDER = '.keep';

function isFolderPlaceholder(filePath: string): boolean {
  return filePath === FOLDER_PLACEHOLDER || filePath.endsWith(`/${FOLDER_PLACEHOLDER}`);
}

export class DbStorageProvider implements IStorageProvider {
  private readonly table: any;
  private readonly bucketTable: any;

  constructor(
    private readonly db: any,
    schema: StorageSchema,
    private readonly dialect: StorageDialect = 'sqlite',
  ) {
    this.table = schema.storageFiles;
    this.bucketTable = schema.storageBuckets;
  }

  private async upsert(values: any, updateSet: any): Promise<void> {
    const query = this.db.insert(this.table).values(values);
    if (this.dialect === 'mysql') {
      await query.onDuplicateKeyUpdate({ set: updateSet });
    } else {
      await query.onConflictDoUpdate({ target: this.table.id, set: updateSet });
    }
  }

  async get(namespace: string, filePath: string): Promise<Buffer | null> {
    const cond = [eq(this.table.namespace, namespace), eq(this.table.filePath, filePath)];
    if (this.table.deletedAt) cond.push(isNull(this.table.deletedAt));

    const [row] = await this.db
      .select({ data: this.table.data })
      .from(this.table)
      .where(and(...cond))
      .limit(1);

    if (!row) return null;
    return Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data);
  }

  async save(namespace: string, filePath: string, data: Buffer, mimeType: string): Promise<void> {
    const id = `${namespace}/${filePath}`;
    const now = new Date().toISOString();
    const category: string = getFileCategoryFromMimeType(mimeType);

    await this.upsert(
      { id, namespace, filePath, data, mimeType, size: data.length, category, createdAt: now, updatedAt: now },
      { data, mimeType, size: data.length, category, updatedAt: now },
    );
  }

  async delete(namespace: string, filePath: string): Promise<boolean> {
    const [existing] = await this.db
      .select({ id: this.table.id })
      .from(this.table)
      .where(and(eq(this.table.namespace, namespace), eq(this.table.filePath, filePath)))
      .limit(1);

    if (!existing) return false;

    await this.db
      .delete(this.table)
      .where(and(eq(this.table.namespace, namespace), eq(this.table.filePath, filePath)));

    return true;
  }

  async getInfo(namespace: string, filePath: string): Promise<FileInfo | null> {
    const cond = [eq(this.table.namespace, namespace), eq(this.table.filePath, filePath)];
    if (this.table.deletedAt) cond.push(isNull(this.table.deletedAt));

    const [row] = await this.db
      .select({
        namespace: this.table.namespace,
        filePath: this.table.filePath,
        mimeType: this.table.mimeType,
        size: this.table.size,
        category: this.table.category,
        createdAt: this.table.createdAt,
        updatedAt: this.table.updatedAt,
      })
      .from(this.table)
      .where(and(...cond))
      .limit(1);

    if (!row) return null;
    return this.toFileInfo(row);
  }

  async list(namespace: string): Promise<FileInfo[]> {
    const cond = [eq(this.table.namespace, namespace)];
    if (this.table.deletedAt) cond.push(isNull(this.table.deletedAt));

    const rows = await this.db
      .select({
        namespace: this.table.namespace,
        filePath: this.table.filePath,
        mimeType: this.table.mimeType,
        size: this.table.size,
        category: this.table.category,
        createdAt: this.table.createdAt,
        updatedAt: this.table.updatedAt,
      })
      .from(this.table)
      .where(and(...cond));

    return rows
      .filter((row: any) => !isFolderPlaceholder(row.filePath))
      .map((row: any) => this.toFileInfo(row));
  }

  async deleteAll(namespace: string): Promise<void> {
    await this.db.delete(this.table).where(eq(this.table.namespace, namespace));
  }

  async copy(sourceNs: string, targetNs: string): Promise<void> {
    const cond = [eq(this.table.namespace, sourceNs)];
    if (this.table.deletedAt) cond.push(isNull(this.table.deletedAt));

    const rows = await this.db
      .select()
      .from(this.table)
      .where(and(...cond));

    const now = new Date().toISOString();

    await Promise.all(rows.map((row: any) => {
      const newId = `${targetNs}/${row.filePath}`;
      return this.upsert(
        { ...row, id: newId, namespace: targetNs, createdAt: now, updatedAt: now },
        { data: row.data, mimeType: row.mimeType, size: row.size, category: row.category, updatedAt: now },
      );
    }));
  }

  async listObjects(namespace: string, options?: ListOptions): Promise<ListResult> {
    const { prefix = '', delimiter, limit = 1000, includeDeleted } = options ?? {};
    const cond = [eq(this.table.namespace, namespace)];
    if (!includeDeleted && this.table.deletedAt) cond.push(isNull(this.table.deletedAt));
    if (prefix) cond.push(like(this.table.filePath, `${prefix}%`));

    const rows = await this.db
      .select({
        namespace: this.table.namespace,
        filePath: this.table.filePath,
        mimeType: this.table.mimeType,
        size: this.table.size,
        category: this.table.category,
        createdAt: this.table.createdAt,
        updatedAt: this.table.updatedAt,
      })
      .from(this.table)
      .where(and(...cond))
      .limit(limit + 1);

    const files: FileInfo[] = [];
    const folderSet = new Set<string>();

    for (const row of rows) {
      const rel = row.filePath;
      if (delimiter) {
        const rest = rel.slice(prefix.length);
        const idx = rest.indexOf(delimiter);
        if (idx >= 0) {
          folderSet.add(prefix + rest.slice(0, idx + delimiter.length));
          continue;
        }
      }
      if (isFolderPlaceholder(rel)) continue;
      files.push(this.toFileInfo(row));
      if (files.length >= limit) break;
    }

    return { files, folders: Array.from(folderSet).sort() };
  }

  async listNamespaces(): Promise<NamespaceInfo[]> {
    const cond = this.table.deletedAt ? [isNull(this.table.deletedAt)] : [];

    const fileRows = await this.db
      .select({
        namespace: this.table.namespace,
        count: sql<number>`count(*)`.as('count'),
        totalBytes: sql<number>`coalesce(sum(${this.table.size}), 0)`.as('totalBytes'),
      })
      .from(this.table)
      .where(and(...cond))
      .groupBy(this.table.namespace);

    const fileMap = new Map<string, { count: number; bytes: number }>(
      fileRows.map((r: any) => [String(r.namespace), { count: Number(r.count), bytes: Number(r.totalBytes) }]),
    );

    // Include registered buckets even if empty
    const bucketRows = this.bucketTable
      ? await this.db.select({ name: this.bucketTable.name }).from(this.bucketTable)
      : [];

    const allNames = new Set([...fileMap.keys(), ...bucketRows.map((r: any) => r.name)]);

    return Array.from(allNames).map((name) => ({
      name,
      fileCount: fileMap.get(name)?.count ?? 0,
      totalBytes: fileMap.get(name)?.bytes ?? 0,
    }));
  }

  async listBuckets(): Promise<BucketConfig[]> {
    if (!this.bucketTable) return [];
    const rows = await this.db.select().from(this.bucketTable);
    return rows.map((r: any) => ({
      name: r.name,
      label: r.label ?? undefined,
      maxFileSize: r.maxFileSize ?? undefined,
      allowedMimeTypes: r.allowedMimeTypes ? JSON.parse(r.allowedMimeTypes) : undefined,
      protected: r.protected ? true : false,
    }));
  }

  async createBucket(config: BucketConfig): Promise<void> {
    if (!this.bucketTable) throw new Error('Bucket table not configured');
    await this.db.insert(this.bucketTable).values({
      name: config.name,
      label: config.label ?? null,
      maxFileSize: config.maxFileSize ?? null,
      allowedMimeTypes: config.allowedMimeTypes ? JSON.stringify(config.allowedMimeTypes) : null,
      protected: config.protected ? 1 : 0,
    });
  }

  async updateBucket(name: string, patch: Partial<BucketConfig>): Promise<void> {
    if (!this.bucketTable) throw new Error('Bucket table not configured');
    const set: any = {};
    if (patch.label !== undefined) set.label = patch.label ?? null;
    if (patch.maxFileSize !== undefined) set.maxFileSize = patch.maxFileSize ?? null;
    if (patch.allowedMimeTypes !== undefined) set.allowedMimeTypes = patch.allowedMimeTypes ? JSON.stringify(patch.allowedMimeTypes) : null;
    if (patch.protected !== undefined) set.protected = patch.protected ? 1 : 0;
    if (patch.name !== undefined && patch.name !== name) {
      // rename: insert new, delete old
      const [existing] = await this.db.select().from(this.bucketTable).where(eq(this.bucketTable.name, name)).limit(1);
      if (!existing) throw new Error(`Bucket "${name}" not found`);
      await this.db.insert(this.bucketTable).values({ ...existing, name: patch.name });
      await this.db.delete(this.bucketTable).where(eq(this.bucketTable.name, name));
      // update files table namespace
      await this.db.update(this.table).set({ namespace: patch.name }).where(eq(this.table.namespace, name));
    } else {
      await this.db.update(this.bucketTable).set(set).where(eq(this.bucketTable.name, name));
    }
  }

  async deleteBucket(name: string): Promise<void> {
    if (!this.bucketTable) throw new Error('Bucket table not configured');
    const [existing] = await this.db.select().from(this.bucketTable).where(eq(this.bucketTable.name, name)).limit(1);
    if (existing?.protected) throw new Error(`Bucket "${name}" is protected and cannot be deleted`);
    await this.db.delete(this.bucketTable).where(eq(this.bucketTable.name, name));
    await this.db.delete(this.table).where(eq(this.table.namespace, name));
  }

  async move(namespace: string, from: string, to: string): Promise<void> {
    const cond = [eq(this.table.namespace, namespace), eq(this.table.filePath, from)];
    if (this.table.deletedAt) cond.push(isNull(this.table.deletedAt));

    const now = new Date().toISOString();
    const result = await this.db
      .update(this.table)
      .set({ id: `${namespace}/${to}`, filePath: to, updatedAt: now })
      .where(and(...cond));

    const affected = (result as any).changes ?? (result as any).rowCount ?? 0;
    if (affected === 0) throw new Error('Source not found');
  }

  async copyFile(namespace: string, from: string, to: string): Promise<void> {
    const cond = [eq(this.table.namespace, namespace), eq(this.table.filePath, from)];
    if (this.table.deletedAt) cond.push(isNull(this.table.deletedAt));

    const [row] = await this.db
      .select()
      .from(this.table)
      .where(and(...cond))
      .limit(1);

    if (!row) throw new Error('Source not found');
    const now = new Date().toISOString();
    await this.upsert(
      { ...row, id: `${namespace}/${to}`, filePath: to, createdAt: now, updatedAt: now },
      { data: row.data, mimeType: row.mimeType, size: row.size, category: row.category, updatedAt: now },
    );
  }

  async softDelete(namespace: string, filePath: string): Promise<boolean> {
    if (!this.table.deletedAt) return false;
    const result = await this.db
      .update(this.table)
      .set({ deletedAt: new Date().toISOString() })
      .where(and(eq(this.table.namespace, namespace), eq(this.table.filePath, filePath)));
    return (result as any).changes > 0 || (result as any).rowCount > 0;
  }

  async restore(namespace: string, filePath: string): Promise<boolean> {
    if (!this.table.deletedAt) return false;
    const result = await this.db
      .update(this.table)
      .set({ deletedAt: null })
      .where(and(eq(this.table.namespace, namespace), eq(this.table.filePath, filePath)));
    return (result as any).changes > 0 || (result as any).rowCount > 0;
  }

  async listTrash(): Promise<FileInfo[]> {
    if (!this.table.deletedAt) return [];
    const rows = await this.db
      .select({
        namespace: this.table.namespace,
        filePath: this.table.filePath,
        mimeType: this.table.mimeType,
        size: this.table.size,
        category: this.table.category,
        createdAt: this.table.createdAt,
        updatedAt: this.table.updatedAt,
        deletedAt: this.table.deletedAt,
      })
      .from(this.table)
      .where(sql`${this.table.deletedAt} IS NOT NULL`);

    return rows.map((row: any) => ({
      ...this.toFileInfo(row),
      deletedAt: row.deletedAt,
    }));
  }

  private toFileInfo(row: any): FileInfo {
    return {
      namespace: row.namespace,
      filePath: row.filePath,
      mimeType: row.mimeType,
      size: row.size,
      category: (row.category as FileCategory) ?? FileCategory.UNKNOWN,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
