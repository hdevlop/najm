# Changelog

## 3.1.0 - 2026-10-10

- Added `onUnresolvedClient: 'shared' | 'skip' | 'reject'` for a request
  whose client address cannot be resolved while its key depends on it
  (`'ip'`, `'user+ip'` without a user, or a custom key function). `'shared'`
  (default) keeps today's single bucket; `'skip'` does not rate-limit it;
  `'reject'` answers 503. The one-time warning names the policy in effect.
- Exported `MAX_TRUSTED_PROXY_HOPS` (8) for applications that bound their
  configured hop count.

## 3.0.0 - 2026-10-04

- Breaking: omitted trustedProxyHops now defaults to zero and ignores forwarded headers. Declare the actual trusted hop count behind a reverse proxy.
- Require Hono ^4.13.12 and the compatible core/guard releases.

## 2.1.0 - 2026-09-04

- security(rate): add `trustedProxyHops`, which indexes the `X-Forwarded-For`
  chain from the right so values a client prepends fall outside the trusted
  boundary and cannot rotate rate-limit buckets. Short chains, malformed
  literals, ports, padded octets, and oversized tokens all fail closed into one
  fixed bucket rather than becoming attacker-selected key material.
- feat(rate): pass a `RateLimitKeyContext` as a second argument to custom key
  functions. `ip`, `user+ip`, and custom keys now resolve the client address
  once and share it. One-argument callbacks remain source-compatible.
- deprecate(rate): trusting the leftmost forwarded value is now the legacy
  unconfigured path only, and is scheduled for removal in the next major.
