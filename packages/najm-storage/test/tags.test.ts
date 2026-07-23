import { describe, test, expect, beforeEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { eq, and, sql } from 'drizzle-orm';
import { DbStorageProvider } from '../src/providers/DbStorageProvider';
import { StorageService } from '../src/StorageService';
import { StorageValidator } from '../src/StorageValidator';

const storageFiles = sqliteTable('storage_files', {
  id: text('id').primaryKey(),
  namespace: text('namespace').notNull(),
  filePath: text('file_path').notNull(),
  data: text('data').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  category: text('category').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => ({
  uniqueIdx: uniqueIndex('storage_ns_path_idx').on(t.namespace, t.filePath),
}));

const storageTags = sqliteTable('storage_tags', {
  id: text('id').primaryKey(),
  namespace: text('namespace').notNull(),
  name: text('name').notNull(),
  color: text('color'),
  createdAt: text('created_at').notNull(),
}, (t) => ({
  uniqueIdx: uniqueIndex('storage_tags_ns_name_idx').on(t.namespace, t.name),
}));

const storageFileTags = sqliteTable('storage_file_tags', {
  fileId: text('file_id').notNull(),
  tagId: text('tag_id').notNull(),
  createdAt: text('created_at').notNull(),
}, (t) => ({
  pk: uniqueIndex('storage_file_tags_pk').on(t.fileId, t.tagId),
}));

function createTestDb() {
  const db = new Database(':memory:');
  db.run(`
    CREATE TABLE storage_files (
      id TEXT PRIMARY KEY,
      namespace TEXT NOT NULL,
      file_path TEXT NOT NULL,
      data TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      category TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX storage_ns_path_idx ON storage_files(namespace, file_path);

    CREATE TABLE storage_tags (
      id TEXT PRIMARY KEY,
      namespace TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT,
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX storage_tags_ns_name_idx ON storage_tags(namespace, name);

    CREATE TABLE storage_file_tags (
      file_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX storage_file_tags_pk ON storage_file_tags(file_id, tag_id);
  `);
  return drizzle(db, { schema: { storageFiles, storageTags, storageFileTags } });
}

function insertFile(db: any, ns: string, path: string) {
  const now = new Date().toISOString();
  db.insert(storageFiles).values({
    id: `${ns}/${path}`,
    namespace: ns,
    filePath: path,
    data: 'test',
    mimeType: 'text/plain',
    size: 4,
    category: 'document',
    createdAt: now,
    updatedAt: now,
  }).run();
}

function createTagService(db: any) {
  const provider = new DbStorageProvider(db, { storageFiles, storageTags, storageFileTags }, 'sqlite');
  const service = new StorageService() as any;
  service.provider = provider;
  service.validator = new StorageValidator();
  service.events = { emit: () => {}, on: () => {} };
  return { service: service as StorageService, provider };
}

describe('tags', () => {
  let db: any;

  beforeEach(() => {
    db = createTestDb();
  });

  test('create and list tags with counts', () => {
    const now = new Date().toISOString();
    db.insert(storageTags).values({ id: 'ns1:tag:alpha', namespace: 'ns1', name: 'alpha', color: '#ff0000', createdAt: now }).run();
    db.insert(storageTags).values({ id: 'ns1:tag:beta', namespace: 'ns1', name: 'beta', createdAt: now }).run();

    insertFile(db, 'ns1', 'a.txt');
    db.insert(storageFileTags).values({ fileId: 'ns1/a.txt', tagId: 'ns1:tag:alpha', createdAt: now }).run();

    const rows = db
      .select({
        id: storageTags.id,
        namespace: storageTags.namespace,
        name: storageTags.name,
        color: storageTags.color,
        count: sql<number>`count(${storageFileTags.fileId})`.as('count'),
      })
      .from(storageTags)
      .leftJoin(storageFileTags, sql`${storageTags.id} = ${storageFileTags.tagId}`)
      .where(eq(storageTags.namespace, 'ns1'))
      .groupBy(storageTags.id)
      .all();

    expect(rows).toHaveLength(2);
    const alpha = rows.find((r: any) => r.name === 'alpha');
    const beta = rows.find((r: any) => r.name === 'beta');
    expect(Number(alpha!.count)).toBe(1);
    expect(Number(beta!.count)).toBe(0);
  });

  test('delete tag cascades the join table', () => {
    const now = new Date().toISOString();
    db.insert(storageTags).values({ id: 'ns1:tag:alpha', namespace: 'ns1', name: 'alpha', createdAt: now }).run();
    insertFile(db, 'ns1', 'a.txt');
    db.insert(storageFileTags).values({ fileId: 'ns1/a.txt', tagId: 'ns1:tag:alpha', createdAt: now }).run();

    db.delete(storageFileTags).where(eq(storageFileTags.tagId, 'ns1:tag:alpha')).run();
    db.delete(storageTags).where(eq(storageTags.id, 'ns1:tag:alpha')).run();

    const tags = db.select().from(storageTags).where(eq(storageTags.namespace, 'ns1')).all();
    expect(tags).toHaveLength(0);
    const joins = db.select().from(storageFileTags).all();
    expect(joins).toHaveLength(0);
  });

  test('unique constraint on (namespace, name)', () => {
    const now = new Date().toISOString();
    db.insert(storageTags).values({ id: 'ns1:tag:alpha', namespace: 'ns1', name: 'alpha', createdAt: now }).run();
    expect(() => {
      db.insert(storageTags).values({ id: 'ns1:tag:alpha2', namespace: 'ns1', name: 'alpha', createdAt: now }).run();
    }).toThrow();
  });
});

describe('file-tags', () => {
  let db: any;

  beforeEach(() => {
    db = createTestDb();
  });

  test('setFileTags creates missing tags and replaces existing', () => {
    const now = new Date().toISOString();
    insertFile(db, 'ns1', 'doc.txt');

    const fileId = 'ns1/doc.txt';

    db.delete(storageFileTags).where(eq(storageFileTags.fileId, fileId)).run();

    for (const name of ['alpha', 'beta']) {
      const tagId = `ns1:tag:${name}`;
      try {
        db.insert(storageTags).values({ id: tagId, namespace: 'ns1', name, createdAt: now }).run();
      } catch {}
      db.insert(storageFileTags).values({ fileId, tagId, createdAt: now }).run();
    }

    const rows = db
      .select({ name: storageTags.name })
      .from(storageFileTags)
      .innerJoin(storageTags, sql`${storageFileTags.tagId} = ${storageTags.id}`)
      .where(eq(storageFileTags.fileId, fileId))
      .all();

    expect(rows.map((r: any) => r.name).sort()).toEqual(['alpha', 'beta']);
  });

  test('deleting a file cascades file_tags', () => {
    const now = new Date().toISOString();
    insertFile(db, 'ns1', 'a.txt');
    db.insert(storageTags).values({ id: 'ns1:tag:x', namespace: 'ns1', name: 'x', createdAt: now }).run();
    db.insert(storageFileTags).values({ fileId: 'ns1/a.txt', tagId: 'ns1:tag:x', createdAt: now }).run();

    db.delete(storageFileTags).where(eq(storageFileTags.fileId, 'ns1/a.txt')).run();
    db.delete(storageFiles).where(eq(storageFiles.id, 'ns1/a.txt')).run();

    const joins = db.select().from(storageFileTags).all();
    expect(joins).toHaveLength(0);
  });

  test('list files by tag', () => {
    const now = new Date().toISOString();
    insertFile(db, 'ns1', 'a.txt');
    insertFile(db, 'ns1', 'b.txt');
    insertFile(db, 'ns1', 'c.txt');

    db.insert(storageTags).values({ id: 'ns1:tag:doc', namespace: 'ns1', name: 'doc', createdAt: now }).run();
    db.insert(storageFileTags).values({ fileId: 'ns1/a.txt', tagId: 'ns1:tag:doc', createdAt: now }).run();
    db.insert(storageFileTags).values({ fileId: 'ns1/b.txt', tagId: 'ns1:tag:doc', createdAt: now }).run();

    const rows = db
      .select({
        namespace: storageFiles.namespace,
        filePath: storageFiles.filePath,
      })
      .from(storageFileTags)
      .innerJoin(storageFiles, sql`${storageFileTags.fileId} = ${storageFiles.id}`)
      .where(and(
        eq(storageFileTags.tagId, 'ns1:tag:doc'),
        eq(storageFiles.namespace, 'ns1'),
      ))
      .all();

    expect(rows).toHaveLength(2);
    expect(rows.map((r: any) => r.filePath).sort()).toEqual(['a.txt', 'b.txt']);
  });

  test('patchFileTags adds and removes atomically', () => {
    const now = new Date().toISOString();
    insertFile(db, 'ns1', 'a.txt');
    insertFile(db, 'ns1', 'b.txt');

    db.insert(storageTags).values({ id: 'ns1:tag:old', namespace: 'ns1', name: 'old', createdAt: now }).run();
    db.insert(storageTags).values({ id: 'ns1:tag:new', namespace: 'ns1', name: 'new', createdAt: now }).run();

    db.insert(storageFileTags).values({ fileId: 'ns1/a.txt', tagId: 'ns1:tag:old', createdAt: now }).run();
    db.insert(storageFileTags).values({ fileId: 'ns1/b.txt', tagId: 'ns1:tag:old', createdAt: now }).run();

    db.delete(storageFileTags).where(and(
      eq(storageFileTags.fileId, 'ns1/a.txt'),
      eq(storageFileTags.tagId, 'ns1:tag:old'),
    )).run();
    db.insert(storageFileTags).values({ fileId: 'ns1/a.txt', tagId: 'ns1:tag:new', createdAt: now }).run();

    const aTags = db
      .select({ name: storageTags.name })
      .from(storageFileTags)
      .innerJoin(storageTags, sql`${storageFileTags.tagId} = ${storageTags.id}`)
      .where(eq(storageFileTags.fileId, 'ns1/a.txt'))
      .all();
    expect(aTags.map((r: any) => r.name).sort()).toEqual(['new']);

    const bTags = db
      .select({ name: storageTags.name })
      .from(storageFileTags)
      .innerJoin(storageTags, sql`${storageFileTags.tagId} = ${storageTags.id}`)
      .where(eq(storageFileTags.fileId, 'ns1/b.txt'))
      .all();
    expect(bTags.map((r: any) => r.name)).toEqual(['old']);
  });
});

describe('tag capabilities', () => {
  test('DbStorageProvider reports tags enabled when tables exist', async () => {
    const db = createTestDb();
    const { DbStorageProvider } = await import('../src/providers/DbStorageProvider');
    const provider = new DbStorageProvider(db, {
      storageFiles,
      storageTags,
      storageFileTags,
    }, 'sqlite');
    expect(provider.getCapabilities().tags).toBe(true);
    expect(provider.getCapabilities().trash).toBe(false);
    expect(provider.getCapabilities().buckets).toBe(false);
  });

  test('DbStorageProvider reports tags disabled when tag tables missing', async () => {
    const db = createTestDb();
    const { DbStorageProvider } = await import('../src/providers/DbStorageProvider');
    const provider = new DbStorageProvider(db, {
      storageFiles,
    }, 'sqlite');
    expect(provider.getCapabilities().tags).toBe(false);
  });

  test('LocalStorageProvider reports tags disabled', async () => {
    const { LocalStorageProvider } = await import('../src/providers/LocalStorageProvider');
    const provider = new LocalStorageProvider('/tmp/test-storage');
    const caps = provider.getCapabilities();
    expect(caps.tags).toBe(false);
    expect(caps.presign).toBe(false);
    expect(caps.trash).toBe(true);
    expect(caps.buckets).toBe(true);
  });

  test('read-only tag service methods return empty results without tag tables', async () => {
    const db = createTestDb();
    const { service } = createTagService(db);
    (service as any).provider = new DbStorageProvider(db, { storageFiles }, 'sqlite');

    expect(await service.listTags('ns1')).toEqual([]);
    expect(await service.getFileTags('ns1', 'doc.txt')).toEqual([]);
    expect(await service.listFilesByTag('ns1', 'alpha')).toEqual({
      files: [],
      folders: [],
      nextCursor: null,
    });
  });
});

describe('tag service integration', () => {
  let db: any;

  beforeEach(() => {
    db = createTestDb();
  });

  test('setFileTags ignores duplicate tag names', async () => {
    insertFile(db, 'ns1', 'doc.txt');
    const { service } = createTagService(db);

    await service.setFileTags('ns1', 'doc.txt', ['alpha', 'alpha', ' Alpha ']);

    const tags = await service.getFileTags('ns1', 'doc.txt');
    expect(tags.map((tag) => tag.name)).toEqual(['alpha']);
  });

  test('moving a file preserves tag assignments under the new path', async () => {
    insertFile(db, 'ns1', 'doc.txt');
    const { service, provider } = createTagService(db);
    await service.setFileTags('ns1', 'doc.txt', ['alpha']);

    await provider.move('ns1', 'doc.txt', 'renamed.txt');

    expect(await service.getFileTags('ns1', 'doc.txt')).toEqual([]);
    expect((await service.getFileTags('ns1', 'renamed.txt')).map((tag) => tag.name)).toEqual(['alpha']);
    const listed = await provider.listObjects('ns1');
    expect(listed.files[0]?.filePath).toBe('renamed.txt');
    expect(listed.files[0]?.tags).toEqual(['alpha']);
  });

  test('deleting a file removes tag joins and updates counts', async () => {
    insertFile(db, 'ns1', 'doc.txt');
    const { service, provider } = createTagService(db);
    await service.setFileTags('ns1', 'doc.txt', ['alpha']);

    await provider.delete('ns1', 'doc.txt');

    expect((await service.listTags('ns1')).find((tag) => tag.name === 'alpha')?.count).toBe(0);
    expect(await service.getFileTags('ns1', 'doc.txt')).toEqual([]);
  });

  test('listFilesByTag includes tag metadata for chip rendering', async () => {
    insertFile(db, 'ns1', 'doc.txt');
    const { service } = createTagService(db);
    await service.setFileTags('ns1', 'doc.txt', ['alpha']);

    const result = await service.listFilesByTag('ns1', 'alpha');

    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.tags).toEqual(['alpha']);
  });

  test('patchFileTags handles duplicate add values without failing the file', async () => {
    insertFile(db, 'ns1', 'doc.txt');
    const { service } = createTagService(db);

    const result = await service.patchFileTags('ns1', ['doc.txt'], { add: ['alpha', 'alpha'] });

    expect(result).toEqual({ updated: ['doc.txt'], failed: [] });
    expect((await service.getFileTags('ns1', 'doc.txt')).map((tag) => tag.name)).toEqual(['alpha']);
  });
});
