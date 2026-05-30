import { describe, test, expect } from 'bun:test';
import { PresignModal } from '../../src/studio/features/presign/components/PresignModal';
import { TrashView } from '../../src/studio/features/trash';
import { useTrash } from '../../src/studio/features/trash/hooks/useTrash';

describe('Phase 6 components', () => {
  test('all phase 6 exports are functions', () => {
    expect(typeof PresignModal).toBe('function');
    expect(typeof TrashView).toBe('function');
    expect(typeof useTrash).toBe('function');
  });
});
