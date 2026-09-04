import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import packageJson from '../package.json';

describe('client-safe definition entry', () => {
  test('publishes an explicit definition subpath', () => {
    expect(packageJson.exports['./define']).toEqual({
      types: './dist/define.d.ts',
      import: './dist/define.mjs',
      default: './dist/define.mjs',
    });
  });

  test('does not pull server framework dependencies into the built entry', () => {
    const built = readFileSync(join(import.meta.dir, '../dist/define.mjs'), 'utf8');

    expect(built).not.toContain('najm-core');
    expect(built).not.toContain('@hono/node-server');
    expect(built).not.toContain('node:fs');
    expect(built).not.toContain('async_hooks');
  });
});
