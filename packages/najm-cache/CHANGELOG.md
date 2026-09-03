# Changelog

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
