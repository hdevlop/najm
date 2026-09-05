import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const packageRoot = join(import.meta.dir, '..');
const manifest = JSON.parse(
  readFileSync(join(packageRoot, 'package.json'), 'utf8'),
) as {
  files?: string[];
  exports?: Record<string, Record<string, string>>;
};

describe('published cache surface', () => {
  test('every declared runtime and type target is inside the published dist directory', () => {
    expect(manifest.files).toContain('dist');

    const entries = Object.entries(manifest.exports ?? {});
    expect(entries.map(([subpath]) => subpath)).toEqual(['.']);

    for (const [, conditions] of entries) {
      for (const target of Object.values(conditions)) {
        expect(target.startsWith('./dist/')).toBe(true);
      }
    }
  });
});
