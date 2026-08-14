import { describe, test, expect, afterEach } from 'bun:test';
import { Server } from 'najm-core';
import { Get, Post, RawResponse } from 'najm-core';
import { Body } from 'najm-core';
import { rateLimit, RateLimit, SkipRateLimit, RateLimitService } from '../src';
import { Controller, Inject } from 'najm-core';
import { CacheService } from 'najm-cache';
import type { Context } from 'hono';

let server: Server;

afterEach(async () => {
  await server?.stop();
});

// ============================================================
// BASIC RATE LIMITING
// ============================================================
describe('Basic Rate Limiting', () => {
  test('should allow requests within limit', async () => {
    @Controller('/test')
    class TestController {
      @Get('/')
      @RateLimit({ limit: 3, window: '1m' })
      get() {
        return { ok: true };
      }
    }

    server = new Server({ isolated: true }).use(rateLimit()).load(TestController);
    await server.listen(3400);

    const res = await fetch('http://localhost:3400/test');
    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('3');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('2');
  });

  test('should block requests exceeding limit', async () => {
    @Controller('/test')
    class TestController {
      @Get('/')
      @RateLimit({ limit: 2, window: '1m' })
      get() {
        return { ok: true };
      }
    }

    server = new Server({ isolated: true }).use(rateLimit()).load(TestController);
    await server.listen(3401);

    await fetch('http://localhost:3401/test'); // 1
    await fetch('http://localhost:3401/test'); // 2
    const res = await fetch('http://localhost:3401/test'); // 3 - blocked

    expect(res.status).toBe(429);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('2');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(res.headers.get('X-RateLimit-Reset')).not.toBeNull();
    expect(res.headers.get('Retry-After')).not.toBeNull();
    expect(await res.json()).toEqual({
      code: 'HTTP_429',
      message: 'Too many requests',
      status: 429,
    });
  });

  test('should decrement remaining count correctly', async () => {
    @Controller('/test')
    class TestController {
      @Get('/')
      @RateLimit({ limit: 5, window: '1m' })
      get() {
        return { ok: true };
      }
    }

    server = new Server({ isolated: true }).use(rateLimit()).load(TestController);
    await server.listen(3402);

    const res1 = await fetch('http://localhost:3402/test');
    expect(res1.headers.get('X-RateLimit-Remaining')).toBe('4');

    const res2 = await fetch('http://localhost:3402/test');
    expect(res2.headers.get('X-RateLimit-Remaining')).toBe('3');

    const res3 = await fetch('http://localhost:3402/test');
    expect(res3.headers.get('X-RateLimit-Remaining')).toBe('2');
  });

  test('should return default error message', async () => {
    @Controller('/test')
    class TestController {
      @Get('/')
      @RateLimit({ limit: 1, window: '1m' })
      get() {
        return { ok: true };
      }
    }

    server = new Server({ isolated: true }).use(rateLimit()).load(TestController);
    await server.listen(3403);

    await fetch('http://localhost:3403/test');
    const res = await fetch('http://localhost:3403/test');

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.message).toBe('Too many requests');
  });
});

// ============================================================
// CUSTOM OPTIONS
// ============================================================
describe('Custom Options', () => {
  test('should use custom error message', async () => {
    @Controller('/test')
    class TestController {
      @Get('/')
      @RateLimit({ limit: 1, window: '1m', message: 'Slow down there, cowboy!' })
      get() {
        return { ok: true };
      }
    }

    server = new Server({ isolated: true }).use(rateLimit()).load(TestController);
    await server.listen(3404);

    await fetch('http://localhost:3404/test');
    const res = await fetch('http://localhost:3404/test');

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.message).toBe('Slow down there, cowboy!');
  });

  test('should use custom status code', async () => {
    @Controller('/test')
    class TestController {
      @Get('/')
      @RateLimit({ limit: 1, window: '1m', statusCode: 503 })
      get() {
        return { ok: true };
      }
    }

    server = new Server({ isolated: true }).use(rateLimit()).load(TestController);
    await server.listen(3405);

    await fetch('http://localhost:3405/test');
    const res = await fetch('http://localhost:3405/test');

    expect(res.status).toBe(503);
  });

  test('should hide headers when headers: false', async () => {
    @Controller('/test')
    class TestController {
      @Get('/')
      @RateLimit({ limit: 3, window: '1m', headers: false })
      get() {
        return { ok: true };
      }
    }

    server = new Server({ isolated: true }).use(rateLimit()).load(TestController);
    await server.listen(3406);

    const res = await fetch('http://localhost:3406/test');
    expect(res.status).toBe(200);
    expect(res.headers.has('X-RateLimit-Limit')).toBe(false);
    expect(res.headers.has('X-RateLimit-Remaining')).toBe(false);
    expect(res.headers.has('X-RateLimit-Reset')).toBe(false);
  });
});

// ============================================================
// TIME WINDOW FORMATS
// ============================================================
describe('Time Window Formats', () => {
  test('should parse seconds format', async () => {
    @Controller('/test')
    class TestController {
      @Get('/')
      @RateLimit({ limit: 2, window: '30s' })
      get() {
        return { ok: true };
      }
    }

    server = new Server({ isolated: true }).use(rateLimit()).load(TestController);
    await server.listen(3407);

    const res = await fetch('http://localhost:3407/test');
    expect(res.status).toBe(200);

    const reset = parseInt(res.headers.get('X-RateLimit-Reset') ?? '0', 10);
    const now = Math.floor(Date.now() / 1000);
    expect(reset - now).toBeLessThanOrEqual(31);
    expect(reset - now).toBeGreaterThan(0);
  });

  test('should parse minutes format', async () => {
    @Controller('/test')
    class TestController {
      @Get('/')
      @RateLimit({ limit: 2, window: '5m' })
      get() {
        return { ok: true };
      }
    }

    server = new Server({ isolated: true }).use(rateLimit()).load(TestController);
    await server.listen(3408);

    const res = await fetch('http://localhost:3408/test');
    expect(res.status).toBe(200);

    const reset = parseInt(res.headers.get('X-RateLimit-Reset') ?? '0', 10);
    const now = Math.floor(Date.now() / 1000);
    expect(reset - now).toBeLessThanOrEqual(301);
    expect(reset - now).toBeGreaterThan(290);
  });

  test('should parse hours format', async () => {
    @Controller('/test')
    class TestController {
      @Get('/')
      @RateLimit({ limit: 2, window: '1h' })
      get() {
        return { ok: true };
      }
    }

    server = new Server({ isolated: true }).use(rateLimit()).load(TestController);
    await server.listen(3409);

    const res = await fetch('http://localhost:3409/test');
    expect(res.status).toBe(200);

    const reset = parseInt(res.headers.get('X-RateLimit-Reset') ?? '0', 10);
    const now = Math.floor(Date.now() / 1000);
    expect(reset - now).toBeLessThanOrEqual(3601);
    expect(reset - now).toBeGreaterThan(3590);
  });

  test('should accept number as milliseconds', async () => {
    @Controller('/test')
    class TestController {
      @Get('/')
      @RateLimit({ limit: 2, window: 60000 })
      get() {
        return { ok: true };
      }
    }

    server = new Server({ isolated: true }).use(rateLimit()).load(TestController);
    await server.listen(3410);

    const res = await fetch('http://localhost:3410/test');
    expect(res.status).toBe(200);

    const reset = parseInt(res.headers.get('X-RateLimit-Reset') ?? '0', 10);
    const now = Math.floor(Date.now() / 1000);
    expect(reset - now).toBeLessThanOrEqual(61);
    expect(reset - now).toBeGreaterThan(55);
  });
});

// ============================================================
// CONTROLLER-LEVEL RATE LIMITING
// ============================================================
describe('Controller-Level Rate Limiting', () => {
  test('should apply rate limit to all methods in controller', async () => {
    @Controller('/api')
    @RateLimit({ limit: 3, window: '1m' })
    class ApiController {
      @Get('/a')
      a() {
        return { route: 'a' };
      }

      @Get('/b')
      b() {
        return { route: 'b' };
      }
    }

    server = new Server({ isolated: true }).use(rateLimit()).load(ApiController);
    await server.listen(3411);

    // All routes share the controller-level limit
    const res1 = await fetch('http://localhost:3411/api/a');
    expect(res1.status).toBe(200);
    expect(res1.headers.get('X-RateLimit-Limit')).toBe('3');

    const res2 = await fetch('http://localhost:3411/api/b');
    expect(res2.status).toBe(200);
  });

  test('controller-level @RateLimit wins over @SkipRateLimit on methods', async () => {
    @Controller('/api')
    @RateLimit({ limit: 1, window: '1m' })
    class ApiController {
      @Get('/limited')
      limited() {
        return { type: 'limited' };
      }

      @Get('/skipped')
      @SkipRateLimit()
      skipped() {
        return { type: 'skipped' };
      }
    }

    server = new Server({ isolated: true }).use(rateLimit()).load(ApiController);
    await server.listen(3412);

    // First request passes
    const res1 = await fetch('http://localhost:3412/api/limited');
    expect(res1.status).toBe(200);

    // Second request blocked - controller level rate limit applies
    const res2 = await fetch('http://localhost:3412/api/skipped');
    expect(res2.status).toBe(429); // @SkipRateLimit doesn't bypass controller-level
  });

  test('method-level rate limit adds to controller-level', async () => {
    @Controller('/api')
    @RateLimit({ limit: 10, window: '1m' })
    class ApiController {
      @Get('/normal')
      normal() {
        return { type: 'normal' };
      }

      @Get('/strict')
      @RateLimit({ limit: 1, window: '1m' })
      strict() {
        return { type: 'strict' };
      }
    }

    server = new Server({ isolated: true }).use(rateLimit()).load(ApiController);
    await server.listen(3413);

    // Normal endpoint uses controller limit
    const res1 = await fetch('http://localhost:3413/api/normal');
    expect(res1.status).toBe(200);
    expect(res1.headers.get('X-RateLimit-Limit')).toBe('10');

    // Strict endpoint has its own additional limit
    await fetch('http://localhost:3413/api/strict');
    const res2 = await fetch('http://localhost:3413/api/strict');
    expect(res2.status).toBe(429);
  });
});

// ============================================================
// GLOBAL RATE LIMITING & @SkipRateLimit
// ============================================================
describe('Global Rate Limiting', () => {
  test('should apply global limit via plugin config', async () => {
    @Controller('/api')
    class ApiController {
      @Get('/data')
      data() {
        return { data: 'test' };
      }
    }

    server = new Server({ isolated: true })
      .use(rateLimit({ defaultLimit: 2, defaultWindow: '1m' }))
      .load(ApiController);

    await server.listen(3414);

    await fetch('http://localhost:3414/api/data');
    await fetch('http://localhost:3414/api/data');
    const res = await fetch('http://localhost:3414/api/data');

    expect(res.status).toBe(429);
  });

  test('should skip global limit with plugin skip function', async () => {
    @Controller('/api')
    class ApiController {
      @Get('/data')
      data() {
        return { data: 'test' };
      }
    }

    server = new Server({ isolated: true })
      .use(
        rateLimit({
          defaultLimit: 1,
          defaultWindow: '1m',
          skip: (ctx) => ctx.req.path.includes('/api'),
        })
      )
      .load(ApiController);

    await server.listen(3415);

    // All requests pass because skip function returns true
    const res1 = await fetch('http://localhost:3415/api/data');
    const res2 = await fetch('http://localhost:3415/api/data');
    const res3 = await fetch('http://localhost:3415/api/data');

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res3.status).toBe(200);
  });

  test('@SkipRateLimit bypasses method-level rate limit only', async () => {
    @Controller('/api')
    class ApiController {
      @Get('/limited')
      @RateLimit({ limit: 1, window: '1m' })
      limited() {
        return { type: 'limited' };
      }

      @Get('/health')
      health() {
        return { status: 'ok' };
      }
    }

    server = new Server({ isolated: true }).use(rateLimit()).load(ApiController);
    await server.listen(3416);

    // Limited route blocks after 1 request
    await fetch('http://localhost:3416/api/limited');
    const res1 = await fetch('http://localhost:3416/api/limited');
    expect(res1.status).toBe(429);

    // Health route has no rate limit - always works
    const res2 = await fetch('http://localhost:3416/api/health');
    const res3 = await fetch('http://localhost:3416/api/health');
    expect(res2.status).toBe(200);
    expect(res3.status).toBe(200);
  });
});

// ============================================================
// KEY STRATEGIES
// ============================================================
describe('Key Strategies', () => {
  test('should use IP-based key by default', async () => {
    @Controller('/test')
    class TestController {
      @Get('/')
      @RateLimit({ limit: 2, window: '1m' })
      get() {
        return { ok: true };
      }
    }

    server = new Server({ isolated: true }).use(rateLimit()).load(TestController);
    await server.listen(3417);

    await fetch('http://localhost:3417/test');
    await fetch('http://localhost:3417/test');
    const res = await fetch('http://localhost:3417/test');

    expect(res.status).toBe(429);
  });

  test('should use api-key strategy', async () => {
    @Controller('/test')
    class TestController {
      @Get('/')
      @RateLimit({ limit: 2, window: '1m', key: 'api-key' })
      get() {
        return { ok: true };
      }
    }

    server = new Server({ isolated: true }).use(rateLimit()).load(TestController);
    await server.listen(3418);

    // Same API key shares limit
    await fetch('http://localhost:3418/test', { headers: { 'X-Api-Key': 'key-1' } });
    await fetch('http://localhost:3418/test', { headers: { 'X-Api-Key': 'key-1' } });
    const res1 = await fetch('http://localhost:3418/test', { headers: { 'X-Api-Key': 'key-1' } });
    expect(res1.status).toBe(429);

    // Different API key has separate limit
    const res2 = await fetch('http://localhost:3418/test', { headers: { 'X-Api-Key': 'key-2' } });
    expect(res2.status).toBe(200);
  });

  test('should use custom key function', async () => {
    @Controller('/test')
    class TestController {
      @Get('/')
      @RateLimit({
        limit: 2,
        window: '1m',
        key: (ctx) => ctx.req.header('X-Custom-Key') ?? 'default',
      })
      get() {
        return { ok: true };
      }
    }

    server = new Server({ isolated: true }).use(rateLimit()).load(TestController);
    await server.listen(3419);

    // Same custom key shares limit
    await fetch('http://localhost:3419/test', { headers: { 'X-Custom-Key': 'custom-1' } });
    await fetch('http://localhost:3419/test', { headers: { 'X-Custom-Key': 'custom-1' } });
    const res1 = await fetch('http://localhost:3419/test', { headers: { 'X-Custom-Key': 'custom-1' } });
    expect(res1.status).toBe(429);

    // Different custom key has separate limit
    const res2 = await fetch('http://localhost:3419/test', { headers: { 'X-Custom-Key': 'custom-2' } });
    expect(res2.status).toBe(200);
  });
});

// ============================================================
// RATE LIMIT SERVICE PUBLIC API
// ============================================================
describe('RateLimitService Public API', () => {
  test('should check rate limit entry', async () => {
    @Controller('/test')
    class TestController {
      @Inject(RateLimitService) rateLimitService!: RateLimitService;

      @Get('/')
      @RateLimit({ limit: 5, window: '1m', key: 'api-key' })
      get() {
        return { ok: true };
      }

      @Get('/check')
      @RawResponse()
      async check() {
        const entry = await this.rateLimitService.check('test-key');
        return Response.json({ entry });
      }
    }

    server = new Server({ isolated: true }).use(rateLimit()).load(TestController);
    await server.listen(3420);

    // Make a request with test-key
    await fetch('http://localhost:3420/test', { headers: { 'X-Api-Key': 'test-key' } });

    // Check the entry
    const res = await fetch('http://localhost:3420/test/check');
    const body = await res.json();

    expect(body.entry).toBeDefined();
    expect(body.entry.count).toBe(1);
    expect(body.entry.resetAt).toBeGreaterThan(Date.now());
  });

  test('should reset rate limit entry', async () => {
    @Controller('/test')
    class TestController {
      @Inject(RateLimitService) rateLimitService!: RateLimitService;

      @Get('/')
      @RateLimit({ limit: 1, window: '1m', key: 'api-key' })
      get() {
        return { ok: true };
      }

      @Post('/reset')
      reset() {
        const result = this.rateLimitService.reset('reset-key');
        return { result };
      }
    }

    server = new Server({ isolated: true }).use(rateLimit()).load(TestController);
    await server.listen(3421);

    // Exhaust the limit
    await fetch('http://localhost:3421/test', { headers: { 'X-Api-Key': 'reset-key' } });

    // Should be blocked
    const blocked = await fetch('http://localhost:3421/test', { headers: { 'X-Api-Key': 'reset-key' } });
    expect(blocked.status).toBe(429);

    // Reset the key
    await fetch('http://localhost:3421/test/reset', { method: 'POST' });

    // Should be allowed again
    const allowed = await fetch('http://localhost:3421/test', { headers: { 'X-Api-Key': 'reset-key' } });
    expect(allowed.status).toBe(200);
  });

  test('should get stats', async () => {
    @Controller('/test')
    class TestController {
      @Inject(RateLimitService) rateLimitService!: RateLimitService;

      @Get('/')
      @RateLimit({ limit: 10, window: '1m', key: 'api-key' })
      get() {
        return { ok: true };
      }

      @Get('/stats')
      @RawResponse()
      stats() {
        return Response.json(this.rateLimitService.getStats());
      }
    }

    server = new Server({ isolated: true }).use(rateLimit()).load(TestController);
    await server.listen(3422);

    // Make some requests with different keys
    await fetch('http://localhost:3422/test', { headers: { 'X-Api-Key': 'stats-key-1' } });
    await fetch('http://localhost:3422/test', { headers: { 'X-Api-Key': 'stats-key-2' } });
    await fetch('http://localhost:3422/test', { headers: { 'X-Api-Key': 'stats-key-3' } });

    // Get stats
    const res = await fetch('http://localhost:3422/test/stats');
    const stats = await res.json();

    expect(stats.totalKeys).toBeGreaterThanOrEqual(3);
    expect(stats.activeKeys).toBeGreaterThanOrEqual(3);
    expect(stats.maxKeys).toBe(10000);
  });
});

// ============================================================
// EDGE CASES
// ============================================================
describe('Edge Cases', () => {
  test('should handle rapid concurrent requests', async () => {
    @Controller('/test')
    class TestController {
      @Get('/')
      @RateLimit({ limit: 5, window: '1m' })
      get() {
        return { ok: true };
      }
    }

    server = new Server({ isolated: true }).use(rateLimit()).load(TestController);
    await server.listen(3423);

    // Send concurrent requests
    const requests = Array.from({ length: 10 }, () => fetch('http://localhost:3423/test'));
    const responses = await Promise.all(requests);
    const statuses = responses.map((r) => r.status);

    const successCount = statuses.filter((s) => s === 200).length;
    const failCount = statuses.filter((s) => s === 429).length;

    expect(successCount).toBe(5);
    expect(failCount).toBe(5);
  });

  test('should handle zero remaining gracefully', async () => {
    @Controller('/test')
    class TestController {
      @Get('/')
      @RateLimit({ limit: 1, window: '1m' })
      get() {
        return { ok: true };
      }
    }

    server = new Server({ isolated: true }).use(rateLimit()).load(TestController);
    await server.listen(3424);

    const res = await fetch('http://localhost:3424/test');
    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
  });

  test('should work with POST method', async () => {
    @Controller('/test')
    class TestController {
      @Post('/')
      @RateLimit({ limit: 2, window: '1m' })
      post() {
        return { created: true };
      }
    }

    server = new Server({ isolated: true }).use(rateLimit()).load(TestController);
    await server.listen(3425);

    await fetch('http://localhost:3425/test', { method: 'POST' });
    await fetch('http://localhost:3425/test', { method: 'POST' });
    const res = await fetch('http://localhost:3425/test', { method: 'POST' });

    expect(res.status).toBe(429);
  });
});

// ============================================================
// CLEANUP & CONFIG
// ============================================================
describe('Cleanup & Config', () => {
  test('should configure custom max keys', async () => {
    @Controller('/test')
    class TestController {
      @Inject(RateLimitService) rateLimitService!: RateLimitService;

      @Get('/')
      @RateLimit({ limit: 10, window: '1m' })
      get() {
        return { ok: true };
      }

      @Get('/stats')
      @RawResponse()
      stats() {
        return Response.json(this.rateLimitService.getStats());
      }
    }

    server = new Server({ isolated: true })
      .use(rateLimit({ maxKeys: 100 }))
      .load(TestController);

    await server.listen(3426);

    const res = await fetch('http://localhost:3426/test/stats');
    const stats = await res.json();

    expect(stats.maxKeys).toBe(100);
  });
});

// ============================================================
// BUG-001: CACHE CLEARED ON SERVER STOP
// ============================================================
describe('BUG-001: Rate limit resets on server stop', () => {
  test('should clear rate limit counters after server stop and restart', async () => {
    @Controller('/test')
    class TestController {
      @Get('/')
      @RateLimit({ limit: 2, window: '1m' })
      get() {
        return { ok: true };
      }
    }

    // First server instance — exhaust the limit
    server = new Server({ isolated: true }).use(rateLimit()).load(TestController);
    await server.listen(3430);

    await fetch('http://localhost:3430/test');
    await fetch('http://localhost:3430/test');
    const blocked = await fetch('http://localhost:3430/test');
    expect(blocked.status).toBe(429);

    // Stop should trigger onDestroy lifecycle (clears cache)
    await server.stop();

    // Second server instance — limit should be fresh
    server = new Server({ isolated: true }).use(rateLimit()).load(TestController);
    await server.listen(3430);

    const res = await fetch('http://localhost:3430/test');
    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('1');
  });

  test('should expose flush() on CacheService', async () => {
    @Controller('/test')
    class TestController {
      @Inject(CacheService) cache!: CacheService;

      @Get('/')
      @RateLimit({ limit: 2, window: '1m' })
      get() {
        return { ok: true };
      }

      @Post('/flush')
      @RawResponse()
      async flush() {
        await this.cache.flush();
        return Response.json({ flushed: true });
      }
    }

    server = new Server({ isolated: true }).use(rateLimit()).load(TestController);
    await server.listen(3431);

    // Exhaust the limit
    await fetch('http://localhost:3431/test');
    await fetch('http://localhost:3431/test');
    const blocked = await fetch('http://localhost:3431/test');
    expect(blocked.status).toBe(429);

    // Flush cache
    await fetch('http://localhost:3431/test/flush', { method: 'POST' });

    // Limit should be reset
    const res = await fetch('http://localhost:3431/test');
    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('1');
  });
});

// ============================================================
// BUG-002: CUSTOM KEY FUNCTION (IP + BODY FIELD)
// ============================================================
describe('BUG-002: Custom key function with body field', () => {
  const ipAndEmail = async (ctx: Context): Promise<string> => {
    const ip = ctx.req.header('x-forwarded-for')?.split(',')[0]?.trim()
      ?? ctx.req.header('x-real-ip')
      ?? 'unknown';
    try {
      const body = await ctx.req.json();
      if (body?.email) return `${ip}:${body.email}`;
    } catch {
      // fallback to IP
    }
    return ip;
  };

  test('should bucket by IP + email, not just IP', async () => {
    @Controller('/auth')
    class AuthController {
      @Post('/login')
      @RateLimit({ limit: 2, window: '1m', key: ipAndEmail })
      login(@Body() body: any) {
        return { ok: true, email: body.email };
      }
    }

    server = new Server({ isolated: true }).use(rateLimit()).load(AuthController);
    await server.listen(3432);

    const loginAs = (email: string) =>
      fetch('http://localhost:3432/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'test' }),
      });

    // User A: 2 attempts (should pass)
    const a1 = await loginAs('alice@test.com');
    expect(a1.status).toBe(200);
    const a2 = await loginAs('alice@test.com');
    expect(a2.status).toBe(200);

    // User A: 3rd attempt (should be blocked)
    const a3 = await loginAs('alice@test.com');
    expect(a3.status).toBe(429);

    // User B: should NOT be blocked (different bucket)
    const b1 = await loginAs('bob@test.com');
    expect(b1.status).toBe(200);
  });

  test('should fall back to IP when body has no email', async () => {
    @Controller('/auth')
    class AuthController {
      @Post('/login')
      @RateLimit({ limit: 2, window: '1m', key: ipAndEmail })
      login() {
        return { ok: true };
      }
    }

    server = new Server({ isolated: true }).use(rateLimit()).load(AuthController);
    await server.listen(3433);

    // Requests without email field fall back to IP-only key
    await fetch('http://localhost:3433/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'test' }),
    });
    await fetch('http://localhost:3433/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'test' }),
    });
    const res = await fetch('http://localhost:3433/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'test' }),
    });

    // All share one IP bucket — blocked after 2
    expect(res.status).toBe(429);
  });
});
