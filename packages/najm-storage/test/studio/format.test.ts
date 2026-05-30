import { describe, test, expect } from 'bun:test';
import { formatBytes, formatRelativeTime } from '../../src/studio/lib/format';

describe('formatBytes', () => {
  test('formats 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  test('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1 KB');
  });

  test('formats fractional kilobytes', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  test('formats megabytes', () => {
    expect(formatBytes(1024 * 1024 * 2.5)).toBe('2.5 MB');
  });

  test('formats gigabytes', () => {
    expect(formatBytes(1024 ** 3 * 3)).toBe('3 GB');
  });
});

describe('formatRelativeTime', () => {
  test('returns "just now" for recent timestamps', () => {
    expect(formatRelativeTime(new Date().toISOString())).toBe('just now');
  });

  test('returns minutes for recent past', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
    expect(formatRelativeTime(fiveMinAgo)).toBe('5 min ago');
  });

  test('returns hours for older timestamps', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString();
    expect(formatRelativeTime(twoHoursAgo)).toBe('2 hr ago');
  });

  test('returns days for even older timestamps', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
    expect(formatRelativeTime(threeDaysAgo)).toBe('3 days ago');
  });
});
