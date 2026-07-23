import { describe, expect, test } from 'bun:test';
import { getKeepBothPath, getPasteTarget } from '../../src/studio/features/explorer/hooks/useExplorerClipboard';

describe('explorer clipboard helpers', () => {
  test('builds a paste target in the active folder', () => {
    expect(getPasteTarget('docs/readme.md', 'archive/')).toEqual({
      name: 'readme.md',
      target: 'archive/readme.md',
    });
  });

  test('uses a Windows-style copy name when keeping both files', () => {
    const occupied = new Set(['docs/readme.md']);
    expect(getKeepBothPath('docs/readme.md', occupied)).toBe('docs/readme - Copy.md');
  });

  test('increments the keep-both suffix until the name is free', () => {
    const occupied = new Set([
      'docs/readme.md',
      'docs/readme - Copy.md',
      'docs/readme - Copy (2).md',
    ]);
    expect(getKeepBothPath('docs/readme.md', occupied)).toBe('docs/readme - Copy (3).md');
  });
});
