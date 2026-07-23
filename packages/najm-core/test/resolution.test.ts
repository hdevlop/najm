import { describe, expect, mock, test } from 'bun:test';
import { normalizeResolutionQuery, escapeLike, pickSingle, resolveBy } from '../dist/index.mjs';

describe('normalizeResolutionQuery', () => {
  test('trims whitespace from input', () => {
    expect(normalizeResolutionQuery('  Ahmed  ')).toBe('Ahmed');
  });

  test('returns empty string for whitespace-only input', () => {
    expect(normalizeResolutionQuery('   ')).toBe('');
  });

  test('returns same string when no whitespace', () => {
    expect(normalizeResolutionQuery('STU-001')).toBe('STU-001');
  });
});

describe('escapeLike', () => {
  test('escapes percent sign', () => {
    expect(escapeLike('100%')).toBe('100\\%');
  });

  test('escapes underscore', () => {
    expect(escapeLike('some_value')).toBe('some\\_value');
  });

  test('escapes backslash', () => {
    expect(escapeLike('path\\to')).toBe('path\\\\to');
  });

  test('escapes all special characters together', () => {
    expect(escapeLike('100%_path\\test')).toBe('100\\%\\_path\\\\test');
  });

  test('returns input unchanged when no special characters', () => {
    expect(escapeLike('Ahmed')).toBe('Ahmed');
  });
});

describe('pickSingle', () => {
  const labelFn = (row: { id: string; name: string }) => row.name;

  test('returns not_found for zero rows', () => {
    const result = pickSingle([], 'test', labelFn);
    expect(result).toEqual({ kind: 'not_found', query: 'test' });
  });

  test('returns found for exactly one row', () => {
    const row = { id: 'abc', name: 'Widget' };
    const result = pickSingle([row], 'test', labelFn);
    expect(result).toEqual({ kind: 'found', entity: row });
  });

  test('returns ambiguous with id and label candidates for multiple rows', () => {
    const rows = [
      { id: '1', name: 'Widget A' },
      { id: '2', name: 'Widget B' },
      { id: '3', name: 'Widget C' },
    ];
    const result = pickSingle(rows, 'Widget', labelFn);
    expect(result.kind).toBe('ambiguous');
    if (result.kind === 'ambiguous') {
      expect(result.query).toBe('Widget');
      expect(result.matches).toEqual([
        { id: '1', label: 'Widget A' },
        { id: '2', label: 'Widget B' },
        { id: '3', label: 'Widget C' },
      ]);
    }
  });

  test('uses labelFn to generate human-readable labels', () => {
    const rows = [
      { id: '1', name: 'Ahmed Ali' },
      { id: '2', name: 'Ahmed Hassan' },
    ];
    const customLabel = (row: { id: string; name: string }) => `Student: ${row.name}`;
    const result = pickSingle(rows, 'Ahmed', customLabel);
    if (result.kind === 'ambiguous') {
      expect(result.matches[0].label).toBe('Student: Ahmed Ali');
      expect(result.matches[1].label).toBe('Student: Ahmed Hassan');
    }
  });
});

describe('resolveBy', () => {
  const row = (id: string, name: string) => ({ id, name });
  const label = (item: { id: string; name: string }) => item.name;

  test('returns not_found for empty query', async () => {
    const search = mock(async () => [row('1', 'Widget')]);

    const result = await resolveBy('', { search, label });

    expect(result).toEqual({ kind: 'not_found', query: '' });
    expect(search).not.toHaveBeenCalled();
  });

  test('returns not_found for whitespace-only query', async () => {
    const search = mock(async () => [row('1', 'Widget')]);

    const result = await resolveBy('   ', { search, label });

    expect(result).toEqual({ kind: 'not_found', query: '   ' });
    expect(search).not.toHaveBeenCalled();
  });

  test('returns found for id hit and short-circuits exact/search', async () => {
    const entity = row('1', 'Widget');
    const findById = mock(async () => entity);
    const findExact = mock(async () => row('2', 'Exact'));
    const search = mock(async () => [row('3', 'Search')]);

    const result = await resolveBy('  1  ', { findById, findExact, search, label });

    expect(result).toEqual({ kind: 'found', entity });
    expect(findById).toHaveBeenCalledWith('1');
    expect(findExact).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
  });

  test('returns found for exact hit and short-circuits search', async () => {
    const entity = row('2', 'Exact');
    const findById = mock(async () => undefined);
    const findExact = mock(async () => entity);
    const search = mock(async () => [row('3', 'Search')]);

    const result = await resolveBy('Exact', { findById, findExact, search, label });

    expect(result).toEqual({ kind: 'found', entity });
    expect(findExact).toHaveBeenCalledWith('Exact');
    expect(search).not.toHaveBeenCalled();
  });

  test('returns found for one search result', async () => {
    const entity = row('3', 'Search');
    const search = mock(async () => [entity]);

    const result = await resolveBy('sea', { search, label });

    expect(result).toEqual({ kind: 'found', entity });
    expect(search).toHaveBeenCalledWith('sea');
  });

  test('returns ambiguous for multiple search results', async () => {
    const search = mock(async () => [row('1', 'Widget A'), row('2', 'Widget B')]);

    const result = await resolveBy('Widget', { search, label });

    expect(result).toEqual({
      kind: 'ambiguous',
      query: 'Widget',
      matches: [
        { id: '1', label: 'Widget A' },
        { id: '2', label: 'Widget B' },
      ],
    });
  });

  test('returns not_found for no search results', async () => {
    const search = mock(async () => []);

    const result = await resolveBy('missing', { search, label });

    expect(result).toEqual({ kind: 'not_found', query: 'missing' });
  });

  test('works with only search and label options', async () => {
    const entity = row('1', 'Only Search');

    const result = await resolveBy('Only', {
      search: async () => [entity],
      label,
    });

    expect(result).toEqual({ kind: 'found', entity });
  });
});
