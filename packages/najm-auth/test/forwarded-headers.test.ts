import 'reflect-metadata';
import { describe, test, expect } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Context } from 'hono';
import { authIdentityRateLimitKey } from '../src/auth/AuthController';

const SRC = join(import.meta.dir, '..', 'src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') ? [full] : [];
  });
}

/** Minimal Hono context double covering only what the key functions read. */
const contextWith = (headers: Record<string, string>, body?: unknown): Context =>
  ({
    req: {
      header: (name: string) => headers[name.toLowerCase()],
      json: async () => {
        if (body === undefined) throw new Error('no body');
        return body;
      },
      query: () => undefined,
      raw: { headers: new Headers(headers) },
    },
  }) as unknown as Context;

describe('forwarded headers are resolved by najm-rate, not by najm-auth', () => {
  test('no auth source file parses a forwarding header itself', () => {
    const offenders = sourceFiles(SRC).filter((file) => {
      const text = readFileSync(file, 'utf8');
      return text.includes('x-forwarded-for') || text.includes('x-real-ip');
    });

    expect(offenders).toEqual([]);
  });

  test('the identity key uses the resolved address and ignores raw headers', async () => {
    const ctx = contextWith(
      { 'x-forwarded-for': '1.2.3.4', 'x-real-ip': '5.6.7.8' },
      { identifier: 'user@example.com' },
    );

    const key = await authIdentityRateLimitKey(ctx, { clientIp: '203.0.113.7' });

    expect(key.startsWith('203.0.113.7:')).toBe(true);
    expect(key).not.toContain('1.2.3.4');
    expect(key).not.toContain('5.6.7.8');
  });

  test('a rotating spoofed header cannot change the identity bucket', async () => {
    const body = { identifier: 'user@example.com' };
    const first = await authIdentityRateLimitKey(
      contextWith({ 'x-forwarded-for': '1.1.1.1' }, body),
      { clientIp: '203.0.113.7' },
    );
    const second = await authIdentityRateLimitKey(
      contextWith({ 'x-forwarded-for': '2.2.2.2' }, body),
      { clientIp: '203.0.113.7' },
    );

    expect(first).toBe(second);
  });

  test('the key never carries the raw identity', async () => {
    const key = await authIdentityRateLimitKey(
      contextWith({}, { identifier: 'user@example.com' }),
      { clientIp: '203.0.113.7' },
    );

    expect(key).not.toContain('user@example.com');
    expect(key).not.toContain('example.com');
  });

  test('a bodyless request still buckets on the resolved address', async () => {
    const key = await authIdentityRateLimitKey(contextWith({}), { clientIp: '203.0.113.7' });
    expect(key).toBe('203.0.113.7');
  });

  test('a legacy one-argument call still compiles and fails closed', async () => {
    // Source compatibility for direct callers: omitting the resolved address
    // must not fall back to a spoofable header.
    const key = await authIdentityRateLimitKey(
      contextWith({ 'x-forwarded-for': '1.2.3.4' }, { identifier: 'user@example.com' }),
    );

    expect(key.startsWith('unresolved:')).toBe(true);
    expect(key).not.toContain('1.2.3.4');
  });

  test('normalized identity equivalence survives the change', async () => {
    const upper = await authIdentityRateLimitKey(
      contextWith({}, { identifier: 'User@Example.com' }),
      { clientIp: '203.0.113.7' },
    );
    const lower = await authIdentityRateLimitKey(
      contextWith({}, { identifier: 'user@example.com' }),
      { clientIp: '203.0.113.7' },
    );

    expect(upper).toBe(lower);
  });
});
