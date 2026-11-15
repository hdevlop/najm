import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// najm-kit's NPageHeader renders only its slot children (NPageHeaderActions,
// NPageHeaderFilters, NPageHeaderTop, ...) and silently drops everything else.
// A screen that put its body inside the header rendered an empty page: the
// Routing Lab never showed a preview result. Screens pass slots as props and
// render their body after the header.
const root = join(import.meta.dir, '..', '..', 'src', 'studio-ui');

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith('.tsx') ? [path] : [];
  });
}

describe('studio screens and NPageHeader', () => {
  it('never nest a screen body inside NPageHeader', () => {
    const offenders = tsxFiles(root)
      .filter((path) => readFileSync(path, 'utf8').includes('</NPageHeader>'))
      .map((path) => relative(root, path).replaceAll('\\', '/'));
    expect(offenders).toEqual([]);
  });
});
