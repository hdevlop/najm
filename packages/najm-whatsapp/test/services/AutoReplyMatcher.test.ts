import 'reflect-metadata';
import { describe, test, expect } from 'bun:test';
import { AutoReplyMatcher } from '../../src/services/AutoReplyMatcher';

describe('AutoReplyMatcher', () => {
  test('exact match is case-insensitive on lowercased text', () => {
    const m = AutoReplyMatcher.compile({ pattern: 'Hello', matchType: 'exact' });
    expect(AutoReplyMatcher.test(m, 'hello')).toBe(true);
    expect(AutoReplyMatcher.test(m, 'HELLO')).toBe(true);
    expect(AutoReplyMatcher.test(m, 'hi')).toBe(false);
  });

  test('prefix match is case-insensitive', () => {
    const m = AutoReplyMatcher.compile({ pattern: 'price', matchType: 'prefix' });
    expect(AutoReplyMatcher.test(m, 'price list please')).toBe(true);
    expect(AutoReplyMatcher.test(m, 'PRICELIST')).toBe(true);
    expect(AutoReplyMatcher.test(m, 'total')).toBe(false);
  });

  test('regex match uses RE2JS linear-time engine', () => {
    const m = AutoReplyMatcher.compile({ pattern: '^\\d+$', matchType: 'regex' });
    expect(AutoReplyMatcher.test(m, '12345')).toBe(true);
    expect(AutoReplyMatcher.test(m, '12a')).toBe(false);
  });

  test('catastrophic backtracking pattern returns within budget on adversarial input', () => {
    // (a+)+$ would backtrack catastrophically under native JS RegExp.
    // RE2 evaluates it in linear time.
    const m = AutoReplyMatcher.compile({ pattern: '(a+)+$', matchType: 'regex' });
    const adversarial = 'a'.repeat(30) + '!';
    const start = Date.now();
    const result = AutoReplyMatcher.test(m, adversarial);
    const elapsed = Date.now() - start;
    expect(result).toBe(false);
    expect(elapsed).toBeLessThan(500);
  });

  test('invalid regex pattern throws at compile time', () => {
    expect(() => AutoReplyMatcher.compile({ pattern: '(unclosed', matchType: 'regex' })).toThrow(/Invalid regex pattern/);
  });

  test('backreferences (not supported by RE2) are rejected at compile time', () => {
    // \1 is a backreference; RE2 should reject it.
    expect(() => AutoReplyMatcher.compile({ pattern: '(a)\\1', matchType: 'regex' })).toThrow();
  });

  test('validate() rejects empty pattern', () => {
    expect(() => AutoReplyMatcher.validate('', 'exact')).toThrow(/pattern is required/);
  });

  test('validate() passes a valid regex', () => {
    expect(() => AutoReplyMatcher.validate('^hi$', 'regex')).not.toThrow();
  });

  test('text longer than the cap is truncated', () => {
    const m = AutoReplyMatcher.compile({ pattern: 'end$', matchType: 'regex' });
    const padded = 'a'.repeat(8000) + 'end';
    // 'end' is past the 4k cap so the matcher should NOT see it.
    expect(AutoReplyMatcher.test(m, padded)).toBe(false);
  });

  test('exact match trims whitespace around inbound text', () => {
    const m = AutoReplyMatcher.compile({ pattern: 'hello', matchType: 'exact' });
    expect(AutoReplyMatcher.test(m, '  hello  ')).toBe(true);
    expect(AutoReplyMatcher.test(m, 'hello\n')).toBe(true);
  });

  test('prefix match trims whitespace around inbound text and pattern', () => {
    const m = AutoReplyMatcher.compile({ pattern: '  price  ', matchType: 'prefix' });
    expect(AutoReplyMatcher.test(m, 'price list')).toBe(true);
    expect(AutoReplyMatcher.test(m, '  price list  ')).toBe(true);
    expect(AutoReplyMatcher.test(m, 'total')).toBe(false);
  });
});
