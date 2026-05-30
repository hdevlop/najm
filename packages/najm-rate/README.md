# najm-rate

Rate limiting plugin for Najm with route-scoped keys and cache-backed storage.

## Install

```bash
bun add najm-rate
```

## Usage

### Global Rate Limit

```typescript
import { Server } from 'najm-core';
import { rateLimit } from 'najm-rate';

await new Server()
  .use(rateLimit({ defaultWindow: '1m', defaultLimit: 100 }))
  .listen(3000);
```

### Route-Level Rate Limit

```typescript
import { Controller, Get, Post } from 'najm-core';
import { Body } from 'najm-core';
import { RateLimit, SkipRateLimit } from 'najm-rate';

@Controller('/api')
class ApiController {
  @Post('/search')
  @RateLimit({ limit: 10, window: '1m' })
  search(@Body() data: any) {
    return this.searchService.run(data);
  }

  @Post('/auth/login')
  @RateLimit({ limit: 5, window: '15m' })
  login(@Body() credentials: any) {
    return this.authService.login(credentials);
  }

  @Get('/health')
  @SkipRateLimit()
  health() {
    return { ok: true };
  }
}
```

## Configuration

### Plugin Configuration

```typescript
rateLimit({
  defaultWindow: '1m',        // Time window: '1s', '1m', '1h', '1d'
  defaultLimit: 100,           // Max requests per window
  keyGenerator: 'ip',         // 'ip' | 'user' | 'api-key' | 'user+ip' | (ctx) => string
  skip: (ctx) => ctx.req.path === '/health',  // Skip rate limiting for certain requests
})
```

### Decorator Options

```typescript
@RateLimit({
  limit: 10,                   // Max requests
  window: '1m',               // Time window
  key: 'ip',                   // Key strategy for this route
  message: 'Too many requests',
  statusCode: 429,
  headers: true,
})
```

## Production Notes

- Requires `najm-cache` to be registered — rate limit counters stored in cache
- Configure Redis via `najm-cache` for distributed rate limiting across instances
- Use `@SkipRateLimit()` on health checks and internal endpoints
- Plugin-level `keyGenerator` sets the default; route-level `key` takes precedence per-route