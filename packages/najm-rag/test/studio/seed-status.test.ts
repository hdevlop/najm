import { describe, test, expect } from 'bun:test';
import { seedHealth, seedProblem } from '../../src/studio-ui/features/dashboard/components/seedStatus';

const base = { total: 228, done: 0, inserted: 0, alreadyStored: 0, failed: 0, unknownTools: [] as string[] };

describe('dashboard seed status', () => {
  test('running shows done/total', () => {
    expect(seedHealth({ ...base, state: 'running', done: 40 })).toEqual({ value: 'Seeding 40/228', tone: 'warn' });
  });

  test('a skipped seed says why', () => {
    const seed = { ...base, state: 'skipped' as const, lastError: 'embedding provider unreachable (connect ECONNREFUSED); the seed runs on the next boot' };
    expect(seedHealth(seed).tone).toBe('warn');
    expect(seedProblem(seed)).toContain('ECONNREFUSED');
  });

  test('failed batches and unknown tools are listed; a clean run has nothing to report', () => {
    const seed = { ...base, state: 'done' as const, done: 228, inserted: 220, failed: 8, unknownTools: ['old_tool', 'old_tool'], lastError: 'timeout' };
    expect(seedHealth(seed)).toEqual({ value: '8 failed', tone: 'bad' });
    expect(seedProblem(seed)).toBe('timeout. 8 of 228 phrases failed. phrases for unregistered tools were skipped: old_tool');
    expect(seedProblem({ ...base, state: 'done', done: 228, inserted: 228 })).toBeNull();
  });
});
