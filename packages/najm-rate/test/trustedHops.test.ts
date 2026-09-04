import { describe, test, expect, afterEach } from 'bun:test';
import { Server, Controller, Get } from 'najm-core';
import { rateLimit, RateLimit, UNRESOLVED_CLIENT_ADDRESS } from '../src';
import type { RateLimitKeyContext } from '../src';
import type { Context } from 'hono';

let server: Server;

afterEach(async () => {
  await server?.stop();
});

const get = (port: number, forwardedFor?: string, path = '/probe') =>
  fetch(`http://localhost:${port}${path}`, {
    headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : undefined,
  });

describe('trusted-hop rate limiting through the middleware', () => {
  test('a rotating left-side XFF value cannot mint fresh buckets', async () => {
    @Controller('/probe')
    class ProbeController {
      @Get('/')
      @RateLimit({ limit: 2, window: '1m', key: 'ip' })
      get() {
        return { ok: true };
      }
    }

    server = new Server({ isolated: true })
      .use(rateLimit({ trustedProxyHops: 1 }))
      .load(ProbeController);
    await server.listen(3460);

    // Every request presents a different spoofed left-side value; only the
    // rightmost entry sits at the trusted boundary, and it never changes.
    await get(3460, '1.1.1.1, 203.0.113.7');
    await get(3460, '2.2.2.2, 203.0.113.7');
    const blocked = await get(3460, '3.3.3.3, 203.0.113.7');

    expect(blocked.status).toBe(429);
  });

  test('distinct addresses at the trusted boundary still get their own bucket', async () => {
    @Controller('/probe')
    class ProbeController {
      @Get('/')
      @RateLimit({ limit: 1, window: '1m', key: 'ip' })
      get() {
        return { ok: true };
      }
    }

    server = new Server({ isolated: true })
      .use(rateLimit({ trustedProxyHops: 1 }))
      .load(ProbeController);
    await server.listen(3461);

    expect((await get(3461, '203.0.113.7')).status).toBe(200);
    expect((await get(3461, '203.0.113.7')).status).toBe(429);
    // A genuinely different client is unaffected by the first one's bucket.
    expect((await get(3461, '198.51.100.4')).status).toBe(200);
  });

  test("'ip', 'user+ip', and a custom key all observe the identical address", async () => {
    const seen: string[] = [];

    @Controller('/probe')
    class ProbeController {
      @Get('/custom')
      @RateLimit({
        limit: 50,
        window: '1m',
        key: (_ctx: Context, keyContext: RateLimitKeyContext) => {
          seen.push(keyContext.clientIp);
          return keyContext.clientIp;
        },
      })
      custom() {
        return { ok: true };
      }

      @Get('/ip')
      @RateLimit({ limit: 1, window: '1m', key: 'ip' })
      ip() {
        return { ok: true };
      }

      @Get('/userip')
      @RateLimit({ limit: 1, window: '1m', key: 'user+ip' })
      userip() {
        return { ok: true };
      }
    }

    server = new Server({ isolated: true })
      .use(rateLimit({ trustedProxyHops: 1 }))
      .load(ProbeController);
    await server.listen(3462);

    const chain = '9.9.9.9, 203.0.113.7';
    await get(3462, chain, '/probe/custom');

    // The custom callback received the resolved boundary address, not the
    // leftmost spoofed one.
    expect(seen).toEqual(['203.0.113.7']);

    // And the built-in strategies bucket on that same address: a second
    // request from the same boundary address is limited even though the
    // spoofed left-side value changed.
    expect((await get(3462, '1.1.1.1, 203.0.113.7', '/probe/ip')).status).toBe(200);
    expect((await get(3462, '2.2.2.2, 203.0.113.7', '/probe/ip')).status).toBe(429);
    expect((await get(3462, '3.3.3.3, 203.0.113.7', '/probe/userip')).status).toBe(200);
    expect((await get(3462, '4.4.4.4, 203.0.113.7', '/probe/userip')).status).toBe(429);
  });

  test('an unusable chain is throttled rather than exempted', async () => {
    @Controller('/probe')
    class ProbeController {
      @Get('/')
      @RateLimit({ limit: 2, window: '1m', key: 'ip' })
      get() {
        return { ok: true };
      }
    }

    server = new Server({ isolated: true })
      .use(rateLimit({ trustedProxyHops: 2 }))
      .load(ProbeController);
    await server.listen(3463);

    // Chains shorter than the boundary collapse into one fixed bucket, so a
    // malformed header cannot be used to escape rate limiting.
    await get(3463, 'not-an-ip');
    await get(3463, 'also-not-an-ip');
    const blocked = await get(3463, 'still-not-an-ip');

    expect(blocked.status).toBe(429);
  });

  test('a one-argument custom callback stays source-compatible', async () => {
    @Controller('/probe')
    class ProbeController {
      @Get('/')
      @RateLimit({ limit: 1, window: '1m', key: (ctx: Context) => ctx.req.path })
      get() {
        return { ok: true };
      }
    }

    server = new Server({ isolated: true })
      .use(rateLimit({ trustedProxyHops: 1 }))
      .load(ProbeController);
    await server.listen(3464);

    expect((await get(3464, '203.0.113.7')).status).toBe(200);
    expect((await get(3464, '203.0.113.7')).status).toBe(429);
  });

  test('zero hops refuses forwarded headers through the real middleware', async () => {
    @Controller('/probe')
    class ProbeController {
      @Get('/')
      @RateLimit({ limit: 1, window: '1m', key: 'ip' })
      get() {
        return { ok: true };
      }
    }

    server = new Server({ isolated: true })
      .use(rateLimit({ trustedProxyHops: 0 }))
      .load(ProbeController);
    await server.listen(3470);

    // One real client presenting two different spoofed chains. At zero hops the
    // forwarded header carries no weight at all, so both requests are the same
    // bucket and the second is limited.
    expect((await get(3470, '198.51.100.10')).status).toBe(200);
    expect((await get(3470, '192.0.2.44')).status).toBe(429);
  });

  test('zero hops keys on the connection peer, not on a parsed header', async () => {
    const seen: string[] = [];

    @Controller('/probe')
    class ProbeController {
      @Get('/')
      @RateLimit({
        limit: 50,
        window: '1m',
        key: (_ctx: Context, keyContext: RateLimitKeyContext) => {
          seen.push(keyContext.clientIp);
          return keyContext.clientIp;
        },
      })
      get() {
        return { ok: true };
      }
    }

    server = new Server({ isolated: true })
      .use(rateLimit({ trustedProxyHops: 0 }))
      .load(ProbeController);
    await server.listen(3471);

    await get(3471, '192.0.2.44');

    expect(seen).toHaveLength(1);
    expect(seen[0]).not.toBe('192.0.2.44');
    // A loopback peer supplied by the runtime, in either address family.
    expect(['127.0.0.1', '::1']).toContain(seen[0]!);
  });

  test('the fail-closed token is a stable, non-attacker-controlled value', () => {
    expect(UNRESOLVED_CLIENT_ADDRESS).toBe('unresolved');
  });
});
