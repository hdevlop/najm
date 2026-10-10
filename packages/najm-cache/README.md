# najm-cache

Unified cache plugin for Najm with Memory and Redis drivers. Auto-falls back to in-memory when Redis is unavailable.

## Install

```bash
bun add najm-cache
```

Peer dependency: `reflect-metadata` (optional). Optional peer: `ioredis`.

## Usage

### Memory Cache (default, no setup)

```typescript
import { Server } from 'najm-core';
import { cache } from 'najm-cache';

await new Server()
  .use(cache())
  .listen(3000);
```

### Redis Cache

```typescript
await new Server()
  .use(cache({ redis: { url: process.env.REDIS_URL! } }))
  .listen(3000);
```

Redis is optional — if not available, falls back to in-memory automatically.

### Redis from environment variables

`redisCacheConfig()` validates the URL and builds the client with the options
every Najm app shares (lazy connect, 3 retries per request, up to 3 reconnect
attempts, a swallowed `error` event). Pass the ioredis constructor so your
bundler sees a static import; the driver's own fallback loads ioredis with a
dynamic `require` that server bundles such as Next's do not trace.

```typescript
import Redis from 'ioredis';
import { cache, redisCacheConfig } from 'najm-cache';
import { isProduction } from 'najm-core/env';
import { isNextBuildPhase } from 'najm-next/env';

server.use(cache(redisCacheConfig({
  url: process.env.REDIS_URL,
  Redis,
  keyPrefix: 'myapp:',
  required: isProduction(),       // URL with a password required
  buildPhase: isNextBuildPhase(), // a build contacts no Redis
})));
```

Without a URL it returns memory (or throws when `required`). Errors name the
variable and never include the URL.

### In Services

```typescript
import { Service, Injectable } from 'najm-core';
import { CacheService } from 'najm-cache';

@Injectable()
class MyService {
  constructor(private cache: CacheService) {}

  async getUser(id: string) {
    return this.cache.getOrSet(`user:${id}`, () => fetchUser(id), 300000);
  }

  async invalidateUser(id: string) {
    await this.cache.del(`user:${id}`);
  }
}
```

## CacheService API

| Method | Description |
|--------|-------------|
| `get(key)` | Get a value |
| `set(key, value, ttlMs?)` | Set a value with optional TTL |
| `del(key)` | Delete a key |
| `compareAndDelete(key, expected)` | Atomically delete only when the stored value still matches |
| `getJson<T>(key)` | Get and parse JSON |
| `setJson(key, value, ttlMs?)` | Set JSON value |
| `getOrSet(key, factory, ttlMs?)` | Cache-aside pattern |
| `incr(key, ttlMs?)` | Atomic increment (for rate limiting) |

## Production Notes

- Use Redis for multi-instance deployments; memory driver is single-instance only
- Token blacklist in `najm-auth` uses the cache plugin — configure Redis for distributed session revocation
- One-time-token consumers should use `compareAndDelete`; a separate `get()` then `del()` is not atomic. Custom drivers may omit the optional primitive, but `CacheService.compareAndDelete()` then fails closed instead of emulating it
- `reflect-metadata` optional peer dependency; only needed if using DI decorators
