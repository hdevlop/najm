import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { copyFile, mkdir, mkdtemp, rm, symlink } from 'node:fs/promises';
import { dirname, basename, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

test('built database plugin preserves shared pools and closes owned pools on Core 2.1.1', async () => {
  // A separate process avoids mixing the two core versions' global decorators.
  const script = `
    import { Database } from 'bun:sqlite';
    import 'reflect-metadata';
    const { Server, Service, Meta, plugin } = await import('najm-core');
    const { database, DB } = await import('./database.mjs');
    const sqlite = new Database(':memory:');
    const db = { $client: sqlite, query: () => sqlite.query('select 1 as one').all() };
    const shared = new Server({ isolated: true, silent: true }).use(database({ default: db }));
    await shared.init();
    await shared.stop();
    if (db.query()[0].one !== 1) throw new Error('Shared client closed');
    let flushed = false;
    class Flush {
      onDestroy() { if (this.db.query()[0].one !== 1) throw new Error('Closed too soon'); flushed = true; }
    }
    Service()(Flush);
    Meta({ layer: 'plugin', order: -10 })(Flush);
    DB()(Flush.prototype, 'db');
    const owner = new Server({ isolated: true, silent: true })
      .use(database({ default: db, alias: db, close: true }))
      .use(plugin('flush').services(Flush).build());
    await owner.init();
    await owner.stop();
    if (!flushed) throw new Error('Plugin did not flush');
    let closed = false;
    try { db.query(); } catch { closed = true; }
    if (!closed) throw new Error('Owned client not closed');
    console.log('CORE_2_DATABASE_LIFECYCLE_OK');
  `;
  const root = await mkdtemp(join(tmpdir(), 'najm-database-core2-'));
  try {
    // Test the actual built bytes with native package resolution to Core 2.
    await mkdir(join(root, 'node_modules'));
    const require = createRequire(import.meta.url);
    for (const [name, source] of Object.entries({
      'najm-core': 'najm-core-v2', 'drizzle-orm': 'drizzle-orm',
      'reflect-metadata': 'reflect-metadata',
    })) {
      const entry = require.resolve(source);
      const packageRoot = source.startsWith('najm-core') ? dirname(dirname(entry)) : dirname(entry);
      await symlink(packageRoot, join(root, 'node_modules', name), 'junction');
    }
    await copyFile(fileURLToPath(new URL('../dist/index.mjs', import.meta.url)), join(root, 'database.mjs'));
    const child = Bun.spawn({
      cmd: [process.execPath, 'run', '-'],
      cwd: root,
      stdin: new Blob([script]),
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const timeout = setTimeout(() => child.kill(), 4000);
    try {
      const [stdout, stderr, code] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ]);
      expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
      expect(stdout).toContain('CORE_2_DATABASE_LIFECYCLE_OK');
    } finally {
      clearTimeout(timeout);
    }
  } finally {
    if (dirname(resolve(root)) !== resolve(tmpdir()) || !basename(root).startsWith('najm-database-core2-')) {
      throw new Error('Unexpected compatibility fixture path');
    }
    await rm(root, { recursive: true, force: true });
  }
});
