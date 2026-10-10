# Changelog

## 2.3.0 - 2026-10-10

- Added `redisCacheConfig({ url, Redis, keyPrefix?, required?, buildPhase?, variable? })`.
  It validates the Redis URL (`redis:`/`rediss:` with a host, and a password
  when `required`), builds the client from the application's ioredis
  constructor with the shared connection options, returns memory when no URL
  is set and the cache is not required, and returns unrequired memory during a
  build phase. Errors name the variable and never include the URL.

## 2.2.0 - 2026-09-05

- feat(cache): add atomic `compareAndDelete(key, expected)` support to the
  memory and Redis drivers for one-time-token consumption. The Redis driver
  compares and deletes inside one Lua evaluation; a custom driver that omits
  the optional primitive fails closed through `CacheService` rather than
  falling back to a racy `get()` plus `del()` pair.
- fix(packaging): remove the advertised `./* -> ./src/*.ts` wildcard, whose
  targets were never included by the package's `files: ["dist"]` contract;
  all supported cache services, drivers, and types remain exported from the
  package root.

## 2.1.2 - 2026-09-04

- fix(cache): attach an error listener to the package-owned ioredis client so
  failed startup/readiness probes cannot write Redis host details to stderr;
  callers still receive the existing value-free readiness failure.

## 2.1.1 - 2026-09-04

- fix(cache): probe a required cache backend during the server `onReady`
  lifecycle so an unreachable Redis instance rejects application startup
  instead of being discovered only by a later readiness request.

## 2.1.0 - 2026-09-04

- security(redis): increment a counter and attach its expiry in one Lua script.
  The previous `INCR`-inside-`MULTI` followed by a separate `PEXPIRE` left a
  window where a process failure produced a counter with no TTL, pinning a
  rate-limit bucket open indefinitely. The script also repairs keys an earlier
  build already left without an expiry.
- feat(cache): add `required` mode. A missing URL, an unavailable Redis
  implementation, or an unnamed driver now throws instead of silently falling
  back to an unshared per-process memory store. Errors never include the URL or
  its credentials.
- feat(cache): add `ping()` and `verifyReady()` readiness probes, and an
  optional pre-constructed `redis.client` for supplying an existing connection.
