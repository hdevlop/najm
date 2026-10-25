import { afterAll, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readShellManifest } from '../src/worker';

const built = { version: 'a'.repeat(20), document: '/offline-shell/shell-built.html', assets: ['/offline-shell/app-built.js'] };
const latest = { version: 'b'.repeat(20), document: '/offline-shell/shell-latest.html', assets: ['/offline-shell/app-latest.js'] };
const root = await mkdtemp(join(tmpdir(), 'najm-offline-shell-manifest-'));
await mkdir(join(root, 'public/offline-shell'), { recursive: true });
await writeFile(join(root, 'public/offline-shell/manifest.json'), JSON.stringify(latest));
await writeFile(join(root, `public/offline-shell/manifest-${built.version}.json`), JSON.stringify(built));
afterAll(() => rm(root, { recursive: true, force: true }));

test('a running server keeps precaching the shell built with it after a later shell build', async () => {
  // `next start` would answer 404 for the later shell's new files.
  expect(await readShellManifest(root, built.version)).toEqual(built);
});

test('unbuilt runs read the latest shell', async () => {
  expect(await readShellManifest(root, undefined)).toEqual(latest);
});

test('a missing or malformed build version never falls back to another shell', async () => {
  await expect(readShellManifest(root, 'c'.repeat(20))).rejects.toThrow();
  await expect(readShellManifest(root, '../manifest')).rejects.toThrow('Invalid offline shell version');
});
