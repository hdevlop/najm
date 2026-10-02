# najm-core

## 3.0.1 - 2026-10-02

### Fixed

- The `x-request-id` response header now reaches every response. It was set
  before the route ran, which only applies to responses Hono builds itself
  (`c.json`, `c.body`), so error responses from `Err.handle` (404, 401, 500),
  file downloads and handlers returning a `Response` lost it. A request id a
  handler sets itself is kept.

### Performance

- Routes that resolve parameters asynchronously (`@Body`, `@File`, custom
  parameters) no longer allocate closures and an options object per request.
  `@Body` dispatch is about 7% faster (12.8 to 11.9 us in-process on Bun).

## 3.0.0

### Breaking change

- Controllers are mounted only when the server declares them through `.load()`,
  `.scan()`, or a plugin's `.services()`. Importing a decorated controller no
  longer mounts its routes. Add previously import-only controllers to the
  appropriate declaration before upgrading. Development startup warns about
  decorated controllers that were imported but omitted.
- Boot lifecycle discovery uses the same server-specific declarations for app
  and plugin services. A class imported into diject's shared container cannot
  start a service for a plugin that did not declare it. Services without an
  explicit plugin boot layer remain lazy, and an empty boot list no longer
  causes diject to boot every singleton.

## 2.1.0 - 2026-09-27

### Added

- `createParamDecorator(resolve)` — public custom parameter decorators. The
  resolver runs once per invocation after route middlewares and guards, may be
  async, and receives `{ transport, container, header, query, param }`; a
  rejection fails the request before the handler runs. Values are passed to
  the invocation only, so concurrent requests stay isolated.
- `resolveCustomParam(meta, context)` and the `ParamResolveContext`,
  `ParamResolve` and `CustomParamOptions` types, so transports such as
  `najm-mcp` resolve the same parameters.

### Changed

- The `'custom'` parameter type, previously reserved and always `undefined`,
  now carries a resolver. Handlers with one never take the synchronous
  argument fast path.
- The built-in decorators use an internal `createBuiltInParamDecorator`
  factory; it was never exported.

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
