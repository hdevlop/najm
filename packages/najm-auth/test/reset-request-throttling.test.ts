import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import type { Context } from 'hono';
import { getRateLimitOptions } from 'najm-rate';
import {
  AuthController,
  authEmailRateLimitKey,
  authIdentityRateLimitKey,
} from '../src/auth/AuthController';
import { RegistrationController } from '../src/auth/RegistrationController';
import { resetPasswordDto, registerDto, loginDto } from '../src/users/UserDto';

const CLIENT = '203.0.113.10';

function contextFor(body: unknown): Context {
  const request = new Request('https://auth.example.test/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return {
    req: {
      header: (name: string) => request.headers.get(name) ?? undefined,
      json: () => request.json(),
    },
  } as unknown as Context;
}

const emailKey = (body: unknown) => authEmailRateLimitKey(contextFor(body), { clientIp: CLIENT });
const identityKey = (body: unknown) => authIdentityRateLimitKey(contextFor(body), { clientIp: CLIENT });

describe('reset-request throttling cannot be re-bucketed by an ignored field', () => {
  test('forgot-password and register bucket on the email-only key', () => {
    expect(getRateLimitOptions(AuthController, 'forgotPassword')).toMatchObject({
      limit: 3,
      window: '15m',
      key: authEmailRateLimitKey,
    });
    expect(getRateLimitOptions(RegistrationController, 'registerUser')).toMatchObject({
      limit: 5,
      window: '15m',
      key: authEmailRateLimitKey,
    });
  });

  test('an extra identifier cannot buy a fresh bucket for the same recipient', async () => {
    const plain = await emailKey({ email: 'victim@example.invalid' });

    for (const extra of ['anything', 'a@b.invalid', '+212612345678', 'victim@example.invalid']) {
      expect(await emailKey({ email: 'victim@example.invalid', identifier: extra }))
        .toBe(plain);
    }
  });

  test('distinct extra identifiers do not each receive their own bucket', async () => {
    const keys = await Promise.all(
      ['one@example.invalid', 'two@example.invalid', 'three@example.invalid'].map((identifier) =>
        emailKey({ email: 'victim@example.invalid', identifier }),
      ),
    );

    expect(new Set(keys).size).toBe(1);
  });

  test('unknown, empty, and non-string fields never select a bucket', async () => {
    const plain = await emailKey({ email: 'victim@example.invalid' });

    const variants: unknown[] = [
      { email: 'victim@example.invalid', identifier: '' },
      { email: 'victim@example.invalid', identifier: '   ' },
      { email: 'victim@example.invalid', identifier: 12345 },
      { email: 'victim@example.invalid', identifier: null },
      { email: 'victim@example.invalid', identifier: { nested: 'x' } },
      { email: 'victim@example.invalid', identifier: ['a'] },
      { email: 'victim@example.invalid', userName: 'victim', phone: '+212612345678' },
    ];

    for (const variant of variants) {
      expect(await emailKey(variant)).toBe(plain);
    }
  });

  test('email casing and surrounding space normalize to one bucket', async () => {
    const plain = await emailKey({ email: 'victim@example.invalid' });
    expect(await emailKey({ email: '  VICTIM@Example.Invalid  ' })).toBe(plain);
  });

  test('an overlong email falls back to the shared client bucket, never a fresh one', async () => {
    const overlong = `${'a'.repeat(250)}@example.invalid`;
    expect(await emailKey({ email: overlong })).toBe(CLIENT);
    expect(await emailKey({ email: `${'b'.repeat(250)}@example.invalid` })).toBe(CLIENT);
  });

  test('malformed JSON and a missing body fall back to the client bucket', async () => {
    const malformed = {
      req: {
        header: () => undefined,
        json: () => Promise.reject(new Error('not json')),
      },
    } as unknown as Context;

    expect(await authEmailRateLimitKey(malformed, { clientIp: CLIENT })).toBe(CLIENT);
    expect(await emailKey([])).toBe(CLIENT);
    expect(await emailKey('a string body')).toBe(CLIENT);
  });

  test('different recipients keep independent buckets', async () => {
    expect(await emailKey({ email: 'one@example.invalid' }))
      .not.toBe(await emailKey({ email: 'two@example.invalid' }));
  });

  test('the bucket never contains the recipient address', async () => {
    const key = await emailKey({ email: 'victim@example.invalid' });
    expect(key).toStartWith(`${CLIENT}:`);
    expect(key).not.toContain('victim@example.invalid');
    expect(key).not.toContain('victim');
  });

  test('the reset DTO really does discard identifier, so the key must too', () => {
    const parsed = resetPasswordDto.parse({
      email: 'victim@example.invalid',
      identifier: 'attacker-chosen',
    });
    expect(parsed).toEqual({ email: 'victim@example.invalid' });
    expect(registerDto.parse({
      email: 'victim@example.invalid',
      password: 'Password1',
      identifier: 'attacker-chosen',
    })).not.toHaveProperty('identifier');
  });
});

describe('login keeps its identifier contract', () => {
  test('login bucket follows the field its DTO and service actually read', async () => {
    // loginDto's first union branch wins whenever `identifier` is a usable
    // string, and AuthService reads `identifier` first — so must the key.
    const parsed = loginDto.parse({
      identifier: 'chosen@example.invalid',
      email: 'other@example.invalid',
      password: 'Password1',
    });
    expect(parsed).toEqual({ identifier: 'chosen@example.invalid', password: 'Password1' });

    expect(await identityKey({
      identifier: 'chosen@example.invalid',
      email: 'other@example.invalid',
      password: 'Password1',
    })).toBe(await identityKey({ identifier: 'chosen@example.invalid', password: 'Password1' }));
  });

  test('an unusable identifier falls back to email rather than to a bucket of its own', async () => {
    const byEmail = await identityKey({ email: 'victim@example.invalid', password: 'Password1' });

    for (const identifier of ['', '  ', 0, null, undefined, false]) {
      expect(await identityKey({ identifier, email: 'victim@example.invalid', password: 'Password1' }))
        .toBe(byEmail);
    }
  });
});
