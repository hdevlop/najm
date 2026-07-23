# najm-core

## 1.3.0

### Breaking / Migration Notes

- **Node.js runtime users must install `@hono/node-server`** (`bun add @hono/node-server` or `npm install @hono/node-server`). It is now an optional peer dependency instead of a hard dependency, so Bun-only projects no longer install it. A clear error explains this if the package is missing when running on Node.
- **`stop()` is now terminal.** A stopped server refuses re-initialization with a clear error instead of silently double-registering routes and middleware. Create a new `Server` instance to restart.

### Fixed

- Node.js fallback actually works: `listen()` feature-detects Bun and falls back to `@hono/node-server` instead of crashing on `Bun.serve`.
- String plugin dependencies (`.requires('database')`) are validated at initialization instead of at `.use()` time — plugin registration order no longer matters, and all missing dependencies are reported at once.
- `stop()` runs `onDestroy` lifecycle for fetch-only/serverless servers (previously database pools, caches, and timers never tore down without a live listener).
- Production logging defaults restored: JSON format and no colors when `NODE_ENV=production`. Explicit `logger` config wins over `LOG_FORMAT`/`NO_COLOR` env vars, which win over the `NODE_ENV` fallback. Pre-boot startup lines now honor these defaults too.
- Route registration and `stop()` failures preserve the original error as `cause` instead of swallowing it.
- Removed a CJS `require()` from the parameter resolver (broke pure-ESM bundling in Vite SSR / Next.js).
- Parameter metadata is sorted once at cache time instead of mutating the shared cache on every request.
- Route middleware cache is keyed by controller identity, fixing collisions between same-named controller classes from different modules.
- `.load()` / `.scan()` deduplicate app services (barrel re-exports no longer register classes twice).
- `RouterService` no longer clobbers the base path set via `server.base()`.

### Performance

- Route-static response metadata (`@ResMsg`, raw-response flags, i18n translator) is resolved once at route registration instead of on every request.
- `RequestParser` resolves route params and query strings lazily with memoization instead of eagerly for every request.

### Added

- `diagnostics: true` server option (or `NAJM_DEBUG=1` outside production): logs booted services, a route table with guard annotations, and per-service boot phase timings.
- Boot phases slower than 500ms are warned about automatically.
- `gracefulShutdown: true` server option: `SIGINT`/`SIGTERM` trigger a clean `stop()`.
- `listen()` on an already-running server throws a clear "already running" error.
