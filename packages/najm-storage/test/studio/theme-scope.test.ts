import { describe, test, expect } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dir, '../../src/studio');

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? tsxFiles(path) : path.endsWith('.tsx') ? [path] : [];
  });
}

describe('storage studio theme scope', () => {
  test('dark mode is set on the theme provider element, so the accent tokens win', () => {
    expect(readFileSync(join(root, 'app/studio.tsx'), 'utf8')).toMatch(/className="ss-studio dark /);
  });

  test('no element below the provider adds a `dark` class (it would reset --primary)', () => {
    const offenders = tsxFiles(root)
      .filter((file) => !file.endsWith('studio.tsx'))
      .filter((file) => /className="dark[\s"]/.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
