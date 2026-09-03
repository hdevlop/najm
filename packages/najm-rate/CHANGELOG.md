# Changelog

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
