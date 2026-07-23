import 'reflect-metadata';
import { afterEach, describe, expect, test } from 'bun:test';
import { Body, Controller, Post, Server } from 'najm-core';
import { rateLimit, RateLimit } from 'najm-rate';
import type { Context } from 'hono';
import {
  authIdentityRateLimitKey,
} from '../src/auth/AuthController';

let server: Server | undefined;

afterEach(async () => {
  await server?.stop();
  server = undefined;
});

describe('authentication identity rate-limit key', () => {
  test('same IP and two identifiers produce different opaque keys', async () => {
    const first = await key({ identifier: 'alice@example.test', password: 'First123' });
    const second = await key({ identifier: 'bob@example.test', password: 'First123' });

    expect(first).not.toBe(second);
    expect(first).not.toContain('alice@example.test');
    expect(second).not.toContain('bob@example.test');
  });

  test('same IP and identifier produce the same key', async () => {
    expect(
      await key({ identifier: 'alice@example.test', password: 'First123' }),
    ).toBe(
      await key({ identifier: 'alice@example.test', password: 'Second456' }),
    );
  });

  test('email normalization is trimmed and case-insensitive', async () => {
    expect(
      await key({ identifier: '  Alice@Example.Test  ', password: 'First123' }),
    ).toBe(
      await key({ identifier: 'alice@example.test', password: 'First123' }),
    );
  });

  test('registration body.email remains supported', async () => {
    expect(
      await key({ email: 'Alice@Example.Test', password: 'First123' }),
    ).toBe(
      await key({ identifier: 'alice@example.test', password: 'First123' }),
    );
  });

  test('phone identifiers use the login-compatible normalized value', async () => {
    expect(
      await key({ identifier: '00 212 (612) 34-56-78', password: 'First123' }),
    ).toBe(
      await key({ identifier: '+212612345678', password: 'First123' }),
    );
  });

  test('missing or malformed JSON safely falls back to IP', async () => {
    expect(await key({ password: 'First123' })).toBe('203.0.113.10');
    expect(await rawKey('{')).toBe('203.0.113.10');
  });

  test('password never affects or appears in the key', async () => {
    const first = await key({
      identifier: 'alice@example.test',
      password: 'credential-one',
    });
    const second = await key({
      identifier: 'alice@example.test',
      password: 'credential-two',
    });

    expect(first).toBe(second);
    expect(first).not.toContain('credential-one');
    expect(first).not.toContain('credential-two');
  });

  test('one identity reaches 429 without blocking another identity on the same IP', async () => {
    @Controller('/auth-rate-test')
    class RateController {
      @Post('/login')
      @RateLimit({
        limit: 5,
        window: '1m',
        key: authIdentityRateLimitKey,
      })
      login(@Body() body: { identifier: string }) {
        return { identifier: body.identifier };
      }
    }

    const port = 35_000 + Math.floor(Math.random() * 1_000);
    server = new Server({ isolated: true }).use(rateLimit()).load(RateController);
    await server.listen(port);

    const login = (identifier: string) => fetch(
      `http://127.0.0.1:${port}/auth-rate-test/login`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '203.0.113.20',
        },
        body: JSON.stringify({ identifier, password: 'NeverInTheKey123' }),
      },
    );

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await login('alice@example.test')).status).toBe(200);
    }
    expect((await login('alice@example.test')).status).toBe(429);
    expect((await login('bob@example.test')).status).toBe(200);
  });
});

function key(body: Record<string, unknown>): Promise<string> {
  return rawKey(JSON.stringify(body));
}

function rawKey(body: string): Promise<string> {
  const request = new Request('https://auth.example.test/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': '203.0.113.10',
    },
    body,
  });
  const context = {
    req: {
      header: (name: string) => request.headers.get(name) ?? undefined,
      json: () => request.json(),
    },
  } as unknown as Context;
  return authIdentityRateLimitKey(context);
}
