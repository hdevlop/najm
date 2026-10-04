import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

test('the built CLI provides its declared executable and TypeScript entry', () => {
  const root = join(import.meta.dir, '..');
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  for (const entry of [manifest.main, manifest.types, ...Object.values(manifest.bin)]) {
    expect(existsSync(join(root, entry as string))).toBe(true);
  }
});
