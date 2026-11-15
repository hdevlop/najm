import { describe, test, expect, afterAll } from 'bun:test';
import { isExpired, normalizeExpiresAt } from '../src/sessions/ChatSessionSchema';

// PostgreSQL stores `timestamp without time zone` as the UTC wall time we
// wrote (it ignores the trailing Z) and returns it with no zone, e.g.
// '2026-11-14 12:00:00'. That string must still mean 12:00 UTC.
const originalTz = process.env.TZ;
process.env.TZ = 'America/New_York';
afterAll(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

describe('H6: session expiry read back without a time zone', () => {
  test('the process really is off UTC for this test', () => {
    expect(new Date('2026-11-14T12:00:00Z').getTimezoneOffset()).not.toBe(0);
  });

  test('a zone-less PostgreSQL timestamp is read as UTC', () => {
    const stored = '2026-11-14 12:00:00';
    expect(isExpired(stored, new Date('2026-11-14T12:30:00.000Z'))).toBe(true);
    expect(isExpired(stored, new Date('2026-11-14T11:30:00.000Z'))).toBe(false);
    expect(normalizeExpiresAt(stored)).toBe('2026-11-14T12:00:00.000Z');
  });

  test('fractional seconds from PostgreSQL are kept', () => {
    expect(normalizeExpiresAt('2026-11-14 12:00:00.123456')).toBe('2026-11-14T12:00:00.123Z');
  });

  test('ISO strings with a zone and Date values are unchanged', () => {
    expect(normalizeExpiresAt('2026-11-14T12:00:00.000Z')).toBe('2026-11-14T12:00:00.000Z');
    expect(normalizeExpiresAt('2026-11-14T13:00:00+01:00')).toBe('2026-11-14T12:00:00.000Z');
    expect(normalizeExpiresAt(new Date('2026-11-14T12:00:00.000Z'))).toBe('2026-11-14T12:00:00.000Z');
  });
});
