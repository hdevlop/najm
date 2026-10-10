import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Controller, Get, Server } from 'najm-core';
import {
  MAX_TRUSTED_PROXY_HOPS,
  RateLimit,
  UNRESOLVED_CLIENT_ADDRESS,
  rateLimit,
  resolveClientAddress,
  type UnresolvedClientPolicy,
} from '../src';
import { resetClientAddressWarnings } from '../src/clientAddress';

let server: Server | undefined;
let warnings: string[] = [];
const originalWarn = console.warn;

beforeEach(() => {
  resetClientAddressWarnings();
  warnings = [];
  console.warn = (...args: unknown[]) => void warnings.push(args.map(String).join(' '));
});

afterEach(async () => {
  console.warn = originalWarn;
  await server?.stop();
  server = undefined;
});

// With one trusted hop and no X-Forwarded-For, no request has a client address.
async function start(port: number, policy: UnresolvedClientPolicy | undefined, key: 'ip' | 'user' = 'ip') {
  @Controller('/probe')
  class ProbeController {
    @Get('/')
    @RateLimit({ limit: 1, window: '1m', key })
    get() {
      return { ok: true };
    }
  }

  server = new Server({ isolated: true, silent: true })
    .use(rateLimit({ trustedProxyHops: 1, ...(policy ? { onUnresolvedClient: policy } : {}) }))
    .load(ProbeController);
  await server.listen(port);
  return () => fetch(`http://localhost:${port}/probe`);
}

describe('onUnresolvedClient', () => {
  test("defaults to 'shared': unresolved requests share one bucket", async () => {
    const get = await start(3471, undefined);
    expect((await get()).status).toBe(200);
    expect((await get()).status).toBe(429);
    expect(warnings.join('\n')).toContain('every affected request shares one rate-limit bucket.');
  });

  test("'skip' leaves unresolved requests unlimited and says so", async () => {
    const get = await start(3472, 'skip');
    for (let index = 0; index < 4; index += 1) expect((await get()).status).toBe(200);
    expect(warnings.join('\n')).toContain("affected requests are not rate limited (onUnresolvedClient: 'skip').");
    expect(warnings.join('\n')).not.toContain('shares one rate-limit bucket');
  });

  test("'reject' refuses unresolved requests with 503", async () => {
    const get = await start(3473, 'reject');
    const response = await get();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      code: 'HTTP_503',
      message: 'Client address could not be determined',
      status: 503,
    });
  });

  test('applies only when the key uses the client address', async () => {
    // A 'user' key does not contain the address, so 'reject' does not refuse
    // and the anonymous bucket limits as before.
    const get = await start(3474, 'reject', 'user');
    expect((await get()).status).toBe(200);
    expect((await get()).status).toBe(429);
  });

  test('a resolved address is limited normally under every policy', async () => {
    for (const [index, policy] of (['shared', 'skip', 'reject'] as const).entries()) {
      const port = 3475 + index;
      await start(port, policy);
      const get = () => fetch(`http://localhost:${port}/probe`, { headers: { 'x-forwarded-for': '203.0.113.9' } });
      expect((await get()).status).toBe(200);
      expect((await get()).status).toBe(429);
      await server!.stop();
      server = undefined;
    }
  });
});

describe('resolveClientAddress', () => {
  test('still returns the unresolved token, worded for the policy, once per cause and policy', () => {
    expect(resolveClientAddress({}, 0, undefined)).toBe(UNRESOLVED_CLIENT_ADDRESS);
    expect(resolveClientAddress({}, 0, undefined)).toBe(UNRESOLVED_CLIENT_ADDRESS);
    expect(resolveClientAddress({}, 0, undefined, 'skip')).toBe(UNRESOLVED_CLIENT_ADDRESS);
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain('shares one rate-limit bucket');
    expect(warnings[1]).toContain("onUnresolvedClient: 'skip'");
  });

  test('exports the conventional hop ceiling', () => {
    expect(MAX_TRUSTED_PROXY_HOPS).toBe(8);
  });
});
