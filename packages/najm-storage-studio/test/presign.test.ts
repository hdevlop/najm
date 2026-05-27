import { describe, test, expect } from 'bun:test';
import { PresignModal } from '../src/components/presign/PresignModal';
import { TrashPanel } from '../src/panels/TrashPanel';
import { useTrash } from '../src/hooks/useTrash';

describe('Phase 6 components', () => {
  test('all phase 6 exports are functions', () => {
    expect(typeof PresignModal).toBe('function');
    expect(typeof TrashPanel).toBe('function');
    expect(typeof useTrash).toBe('function');
  });
});
