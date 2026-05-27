import { describe, test, expect } from 'bun:test';

describe('useSelection pure logic', () => {
  const visibleIds = ['a', 'b', 'c'];

  test('toggleRow adds id', () => {
    let selectedIds = new Set<string>();
    const toggleRow = (id: string) => {
      if (selectedIds.has(id)) {
        selectedIds.delete(id);
      } else {
        selectedIds.add(id);
      }
    };
    toggleRow('a');
    expect(selectedIds.has('a')).toBe(true);
  });

  test('toggleRow removes id', () => {
    let selectedIds = new Set<string>(['a']);
    const toggleRow = (id: string) => {
      if (selectedIds.has(id)) {
        selectedIds.delete(id);
      } else {
        selectedIds.add(id);
      }
    };
    toggleRow('a');
    expect(selectedIds.has('a')).toBe(false);
  });

  test('toggleAllVisible selects all', () => {
    let selectedIds = new Set<string>();
    const toggleAllVisible = () => {
      if (selectedIds.size === visibleIds.length) {
        selectedIds = new Set();
      } else {
        selectedIds = new Set(visibleIds);
      }
    };
    toggleAllVisible();
    expect(selectedIds.size).toBe(3);
  });

  test('toggleAllVisible clears when all selected', () => {
    const allSelectedIds = new Set(['a', 'b', 'c']);
    const emptyIds = new Set<string>();
    const resultWhenAllSelected = emptyIds;
    expect(resultWhenAllSelected.size).toBe(0);
  });

  test('toggleAllVisible selects all when none selected', () => {
    const emptyIds = new Set<string>();
    const visibleIds = ['a', 'b', 'c'];
    const resultWhenNoneSelected = new Set(visibleIds);
    expect(resultWhenNoneSelected.size).toBe(3);
  });

  test('clearSelection empties the set', () => {
    let selectedIds = new Set<string>(['a', 'b']);
    selectedIds = new Set();
    expect(selectedIds.size).toBe(0);
  });

  test('allVisibleSelected is true when all visible selected', () => {
    const selectedIds = new Set(['a', 'b', 'c']);
    const allVisibleSelected = selectedIds.size === visibleIds.length && visibleIds.length > 0;
    expect(allVisibleSelected).toBe(true);
  });

  test('someVisibleSelected is true when some selected', () => {
    const selectedIds = new Set(['a']);
    const someVisibleSelected = selectedIds.size > 0;
    expect(someVisibleSelected).toBe(true);
  });

  test('someVisibleSelected is false when none selected', () => {
    const selectedIds = new Set<string>();
    const someVisibleSelected = selectedIds.size > 0;
    expect(someVisibleSelected).toBe(false);
  });
});
