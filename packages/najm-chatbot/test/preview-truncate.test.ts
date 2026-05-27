import { describe, test, expect } from 'bun:test';
import { truncatePreview } from '../src/agent/previewTruncate';

describe('previewTruncate', () => {
  test('returns primitives unchanged when under limit', () => {
    expect(truncatePreview('hello')).toBe('hello');
    expect(truncatePreview(42)).toBe(42);
    expect(truncatePreview(true)).toBe(true);
    expect(truncatePreview(null)).toBe(null);
  });

  test('returns simple objects unchanged when under char limit', () => {
    const input = { name: 'test', count: 5 };
    const result = truncatePreview(input);
    expect(result).toEqual(input);
  });

  test('returns arrays unchanged when under char limit', () => {
    const input = [1, 2, 3];
    const result = truncatePreview(input);
    expect(result).toEqual([1, 2, 3]);
  });

  test('redacts sensitive keys', () => {
    const input = { username: 'admin', password: 'secret123', token: 'abc', safe: 'value' };
    const result = truncatePreview(input) as Record<string, unknown>;
    expect(result.username).toBe('admin');
    expect(result.password).toBe('[REDACTED]');
    expect(result.token).toBe('[REDACTED]');
    expect(result.safe).toBe('value');
  });

  test('redacts keys case-insensitively', () => {
    const input = { APIKey: 'sk-123', Authorization: 'Bearer x', Safe: 'ok' };
    const result = truncatePreview(input) as Record<string, unknown>;
    expect(result.APIKey).toBe('[REDACTED]');
    expect(result.Authorization).toBe('[REDACTED]');
    expect(result.Safe).toBe('ok');
  });

  test('truncates arrays exceeding maxArrayItems', () => {
    const input = Array.from({ length: 20 }, (_, i) => i);
    const result = truncatePreview(input, { maxArrayItems: 5 }) as any;
    expect(result.type).toBe('array');
    expect(result.truncated).toBe(true);
    expect(result.length).toBe(20);
    expect(result.items).toHaveLength(5);
  });

  test('truncates at max depth', () => {
    const deep = { a: { b: { c: { d: { e: { f: 'deep' } } } } } };
    const result = truncatePreview(deep, { maxDepth: 3 }) as any;
    expect(result.a.b.c.type).toBe('object');
    expect(result.a.b.c.truncated).toBe(true);
    expect(result.a.b.c.reason).toBe('max_depth');
  });

  test('produces truncated marker when serialized exceeds maxChars', () => {
    const input = { data: 'x'.repeat(1000) };
    const result = truncatePreview(input, { maxChars: 50 }) as any;
    expect(result.type).toBe('preview');
    expect(result.truncated).toBe(true);
    expect(typeof result.value).toBe('string');
    expect(result.value.length).toBeLessThanOrEqual(50);
  });

  test('respects HARD_MAX_CHARS of 2000', () => {
    const input = { data: 'y'.repeat(5000) };
    const result = truncatePreview(input, { maxChars: 10000 }) as any;
    expect(result.truncated).toBe(true);
    expect(result.value.length).toBeLessThanOrEqual(2000);
  });

  test('handles nested objects with redaction', () => {
    const input = {
      user: {
        name: 'Alice',
        password: 'secret',
        profile: { token: 'xyz', bio: 'Hello' },
      },
    };
    const result = truncatePreview(input) as any;
    expect(result.user.name).toBe('Alice');
    expect(result.user.password).toBe('[REDACTED]');
    expect(result.user.profile.token).toBe('[REDACTED]');
    expect(result.user.profile.bio).toBe('Hello');
  });

  test('handles empty objects and arrays', () => {
    expect(truncatePreview({})).toEqual({});
    expect(truncatePreview([])).toEqual([]);
  });

  test('custom redactKeys override defaults', () => {
    const input = { customSecret: 'hidden', password: 'visible' };
    const result = truncatePreview(input, { redactKeys: ['customsecret'] }) as any;
    expect(result.customSecret).toBe('[REDACTED]');
    expect(result.password).toBe('visible');
  });

  test('handles mixed object with all value types', () => {
    const input = {
      str: 'text',
      num: 42,
      bool: false,
      nil: null,
      arr: [1, 'two'],
      obj: { nested: true },
    };
    const result = truncatePreview(input) as any;
    expect(result.str).toBe('text');
    expect(result.num).toBe(42);
    expect(result.bool).toBe(false);
    expect(result.nil).toBe(null);
    expect(result.arr).toEqual([1, 'two']);
    expect(result.obj).toEqual({ nested: true });
  });

  test('processes arrays with objects containing redacted keys', () => {
    const input = [
      { name: 'user1', password: 'pass1' },
      { name: 'user2', password: 'pass2' },
    ];
    const result = truncatePreview(input) as any[];
    expect(result[0].name).toBe('user1');
    expect(result[0].password).toBe('[REDACTED]');
    expect(result[1].name).toBe('user2');
    expect(result[1].password).toBe('[REDACTED]');
  });

  test('defaults are applied when no options provided', () => {
    const input = { data: 'test' };
    const result = truncatePreview(input);
    expect(result).toEqual(input);
  });
});
