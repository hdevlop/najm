// The shared happy-dom preload defines a `window` that fake-indexeddb/auto
// would attach to instead of globalThis, so assign the polyfill explicitly.
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { describe, test, expect, afterEach } from 'bun:test';

Object.assign(globalThis, { indexedDB, IDBKeyRange });

import { createClientStorage, FileCategory, type ClientStorage } from '../../src/client';

let storage: ClientStorage | undefined;
let dbCounter = 0;

function create(stores?: Parameters<typeof createClientStorage>[0]['stores']) {
  storage = createClientStorage({ db: `test-db-${++dbCounter}`, stores });
  return storage;
}

afterEach(async () => {
  await storage?.destroy();
  storage = undefined;
});

describe('ClientFileStore', () => {
  test('saves and reads back a blob with metadata', async () => {
    const { files } = create();
    const blob = new Blob(['hello world'], { type: 'text/plain' });

    const info = await files.save('avatars', 'greeting.txt', blob);
    expect(info.namespace).toBe('avatars');
    expect(info.filePath).toBe('greeting.txt');
    // Bun's Blob may normalize the type to 'text/plain;charset=utf-8'
    expect(info.mimeType.startsWith('text/plain')).toBe(true);
    expect(info.size).toBe(11);
    expect(info.category).toBe(FileCategory.TEXT);

    const stored = await files.get('avatars', 'greeting.txt');
    expect(stored).not.toBeNull();
    expect(await stored!.text()).toBe('hello world');
    expect(stored!.type.startsWith('text/plain')).toBe(true);
  });

  test('accepts string, Uint8Array and ArrayBuffer inputs', async () => {
    const { files } = create();

    await files.save('docs', 'note.md', '# hi');
    expect((await files.getInfo('docs', 'note.md'))!.mimeType).toBe('text/markdown');

    const bytes = new Uint8Array([1, 2, 3]);
    await files.save('docs', 'raw.bin', bytes);
    const raw = await files.get('docs', 'raw.bin');
    expect(new Uint8Array(await raw!.arrayBuffer())).toEqual(bytes);

    await files.save('docs', 'buf.bin', bytes.buffer.slice(0) as ArrayBuffer);
    expect((await files.getInfo('docs', 'buf.bin'))!.size).toBe(3);
  });

  test('infers mime type from path and preserves createdAt on overwrite', async () => {
    const { files } = create();

    const first = await files.save('images', 'logo.png', new Blob([new Uint8Array(4)]));
    expect(first.mimeType).toBe('image/png');
    expect(first.category).toBe(FileCategory.IMAGE);

    await new Promise((r) => setTimeout(r, 5));
    const second = await files.save('images', 'logo.png', new Blob([new Uint8Array(8)]));
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.size).toBe(8);
  });

  test('lists per namespace and aggregates namespaces', async () => {
    const { files } = create();
    await files.save('a', 'one.txt', '1');
    await files.save('a', 'two.txt', '22');
    await files.save('b', 'three.txt', '333');

    const listed = await files.list('a');
    expect(listed.map((f) => f.filePath).sort()).toEqual(['one.txt', 'two.txt']);

    const namespaces = await files.listNamespaces();
    expect(namespaces).toEqual([
      { name: 'a', fileCount: 2, totalBytes: 3 },
      { name: 'b', fileCount: 1, totalBytes: 3 },
    ]);
  });

  test('delete and deleteAll', async () => {
    const { files } = create();
    await files.save('ns', 'x.txt', 'x');
    await files.save('ns', 'y.txt', 'y');

    expect(await files.delete('ns', 'x.txt')).toBe(true);
    expect(await files.delete('ns', 'x.txt')).toBe(false);
    expect(await files.get('ns', 'x.txt')).toBeNull();

    await files.deleteAll('ns');
    expect(await files.list('ns')).toEqual([]);
  });

  test('normalizes paths and rejects traversal', async () => {
    const { files } = create();
    await files.save('ns', '/sub//dir/./file.txt', 'ok');
    expect((await files.getInfo('ns', 'sub/dir/file.txt'))!.filePath).toBe('sub/dir/file.txt');

    expect(files.save('ns', '../escape.txt', 'no')).rejects.toThrow('Invalid file path');
    expect(files.save('..', 'file.txt', 'no')).rejects.toThrow('Invalid namespace');
  });
});

describe('ClientDataStore', () => {
  test('put/get/getAll/delete/clear with default id keyPath', async () => {
    const { data } = create([{ name: 'products' }]);

    await data.put('products', { id: 'p1', name: 'Widget', price: 5 });
    await data.put('products', { id: 'p2', name: 'Gadget', price: 15 });

    expect(await data.get('products', 'p1')).toEqual({ id: 'p1', name: 'Widget', price: 5 });
    expect((await data.getAll('products')).length).toBe(2);

    await data.delete('products', 'p1');
    expect(await data.get('products', 'p1')).toBeUndefined();

    await data.clear('products');
    expect(await data.count('products')).toBe(0);
  });

  test('queries by index with ranges, limit and direction', async () => {
    const { data } = create([
      { name: 'products', indexes: [{ name: 'price', keyPath: 'price' }] },
    ]);
    await data.put('products', { id: 'p1', price: 5 });
    await data.put('products', { id: 'p2', price: 10 });
    await data.put('products', { id: 'p3', price: 20 });

    const cheap = await data.query<{ id: string }>('products', { index: 'price', range: { lte: 10 } });
    expect(cheap.map((p) => p.id).sort()).toEqual(['p1', 'p2']);

    const above = await data.query<{ id: string }>('products', { index: 'price', range: { gt: 5 } });
    expect(above.map((p) => p.id).sort()).toEqual(['p2', 'p3']);

    const topOne = await data.query<{ id: string }>('products', { index: 'price', direction: 'prev', limit: 1 });
    expect(topOne.map((p) => p.id)).toEqual(['p3']);

    expect(await data.count('products', { index: 'price', range: { gte: 10 } })).toBe(2);
  });

  test('autoIncrement stores generate keys', async () => {
    const { data } = create([{ name: 'logs', autoIncrement: true }]);
    const k1 = await data.put('logs', { msg: 'first' });
    const k2 = await data.put('logs', { msg: 'second' });
    expect(k2).toBeGreaterThan(k1 as number);
    expect(await data.get('logs', k1)).toEqual({ msg: 'first' });
  });

  test('rejects undeclared stores with a helpful error', async () => {
    const { data } = create();
    expect(data.get('nope', 1)).rejects.toThrow('Unknown data store "nope"');
  });

  test('reopening with additional stores upgrades the database', async () => {
    const name = `test-db-upgrade-${++dbCounter}`;
    const s1 = createClientStorage({ db: name });
    await s1.files.save('ns', 'a.txt', 'a');
    await s1.close();

    const s2 = createClientStorage({ db: name, stores: [{ name: 'settings' }] });
    await s2.data.put('settings', { id: 'theme', value: 'dark' });
    // pre-existing file data survives the version upgrade
    expect(await s2.files.get('ns', 'a.txt')).not.toBeNull();
    storage = s2;
  });
});
