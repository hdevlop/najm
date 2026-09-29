import { describe, expect, test } from 'bun:test';
import { storedTimeMs } from '../src/shared/storedTime';
import { inTimeZone, postgresTimestamp } from './timeZone';

describe('storedTimeMs', () => {
  const instant = Date.UTC(2026, 8, 29, 17, 46, 5, 186);

  test('reads a PostgreSQL timestamp without zone as UTC, whatever the server zone', async () => {
    for (const zone of ['UTC', 'Africa/Casablanca', 'Asia/Tokyo', 'America/New_York']) {
      await inTimeZone(zone, () => {
        expect(storedTimeMs('2026-09-29 17:46:05.186')).toBe(instant);
        expect(storedTimeMs('2026-09-29T17:46:05.186')).toBe(instant);
        expect(storedTimeMs(postgresTimestamp(instant))).toBe(instant);
      });
    }
  });

  test('keeps a zone the value carries', async () => {
    await inTimeZone('Asia/Tokyo', () => {
      expect(storedTimeMs('2026-09-29T17:46:05.186Z')).toBe(instant);
      expect(storedTimeMs('2026-09-29T18:46:05.186+01:00')).toBe(instant);
      expect(storedTimeMs('2026-09-29 18:46:05.186+01')).toBe(instant);
      expect(storedTimeMs(new Date(instant))).toBe(instant);
      expect(storedTimeMs('2026-09-29')).toBe(Date.UTC(2026, 8, 29));
    });
  });

  test('the server zone really changes inside inTimeZone', async () => {
    await inTimeZone('Asia/Tokyo', () => {
      expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(-540);
    });
  });
});
