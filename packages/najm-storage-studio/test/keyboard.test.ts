import { describe, test, expect } from 'bun:test';
import { CommandPalette } from '../src/components/command/CommandPalette';
import { useKeyboard } from '../src/hooks/useKeyboard';

describe('Phase 8 power features', () => {
  test('all phase 8 exports are functions', () => {
    expect(typeof CommandPalette).toBe('function');
    expect(typeof useKeyboard).toBe('function');
  });
});
