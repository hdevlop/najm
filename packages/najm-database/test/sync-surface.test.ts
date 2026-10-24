import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import metadata from '../package.json';

test('sync entrypoints are separate; legacy root does not load browser persistence', async () => {
  for (const name of ['contracts', 'client', 'server', 'pg']) {
    expect(metadata.exports['./sync/' + name]).toEqual({ types: `./dist/sync/${name}.d.ts`, import: `./dist/sync/${name}.mjs`, default: `./dist/sync/${name}.mjs` });
    const source = await readFile(new URL(`../src/sync/${name}.ts`, import.meta.url), 'utf8');
    if (name === 'client' || name === 'contracts') expect(source).not.toMatch(/from ['"](?:node:|najm-core|najm-auth|postgres|drizzle-orm|\.\.\/index)/);
  }
  const root = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
  expect(root).not.toContain('./sync');
  expect(metadata.peerDependencies['fast-idb']).toBe('0.3.1');
  expect(metadata.peerDependenciesMeta['fast-idb'].optional).toBe(true);
});
