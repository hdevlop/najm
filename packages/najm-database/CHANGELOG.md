# Changelog

## 2.2.1 - 2026-10-06

### Fixed

- `@Transaction` methods are wrapped once per instance when a server reboots on
  the same container (a dev hot reload). The container keeps one transaction
  injector, delegating to the latest boot's `TransactionService`, instead of
  one per boot that wrapped the method again ("Duplicate transaction wrapper
  detected"). Needs najm-core 3.0.4 to drop the previous boot's injections.

## 2.1.1 - 2026-10-03

- Restore caller-managed connections as the default (`close: false`).
  `database(db)` and `database({ default: db })` leave clients open on stop
  and failed initialization, so existing apps and shared-pool test servers
  do not need an explicit opt-out.
- Automatic cleanup now requires `database({ default: db, close: true })`
  or a custom close callback. Ordering, client deduplication, error reporting,
  and Core 2/3 support remain available when cleanup is enabled.

## 2.1.0 - 2026-10-03

- Close supported clients automatically on server shutdown: `database(db)`.
  Shared pools must opt out with `database({ default: db, close: false })`.
  This changes the previous behavior of leaving connections open on stop.
- Accept a custom `close(db, name)` callback for driver-specific shutdown or
  timeouts. Named connection maps accept `close` inline; the second options
  argument remains supported. Drivers without a recognized closing method
  remain open and need a callback.
- Boot the database service at plugin order -100 so its clients stay available
  during higher-order plugin teardown. Core 3 app teardown runs before database
  cleanup; Core 2 retains its existing plugin-only lifecycle.
- Deduplicate cleanup by underlying client, including aliases and callbacks.
  Attempt every cleanup before reporting failures through `stop()`.
- Close partial connections when owned database initialization fails, and
  retain ownership of clients replaced by a later registration.
- Support `najm-core` 2.1.1 and 3.0.2 within their respective major versions.
- Keep caller-owned databases open in `seedAuthData()` after its temporary
  server stops, so existing seed scripts can continue using their connection.
