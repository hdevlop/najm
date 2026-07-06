# najm-core Review & Optimization Plan

Full review of the server boot workflow (Server → plugins → scan → BootService → routes → request handling), with a phased implementation plan.

**Scope:** `packages/najm-core` (Server, BootService, ScannerService, RouterService, MiddlewareService, ParamResolver, RequestParser, BootDiagnostics).

## Implementation Status

Implemented in `packages/najm-core`:

- Phase 1 correctness fixes: Bun/Node listener split, delayed string dependency validation, fetch-only `stop()` teardown, stopped-server reuse guard, error causes, param metadata cache sorting, ESM param metadata module, controller-identity middleware cache, app-service dedupe, and base-path preservation.
- Phase 2 hot-path fixes: route-static response metadata hoisting and lazy `RequestParser` params/query.
- Phase 3 DX pieces: BootDiagnostics wiring, route table output, boot timing warnings, double-listen guard, graceful shutdown option, startup alias failures through logger, and removal of `src/main.ts`.
- Core tests now run against the built package surface to avoid Bun 1.3 source decorator transform issues.
- Release note: ship as `najm-core@1.3.0`; Node runtime users must install `@hono/node-server`, and production logger defaults remain JSON/no-color unless explicitly overridden.

Verified:

- `bun test packages/najm-core` -> 40 pass, 0 fail.
- `bun run test:core` -> build + 40 pass, 0 fail.
- Built Bun listener smoke passed with port `0`.
- True Node fallback smoke passed on Node v24.18.0 (`@hono/node-server` path): `listen(0)` → real HTTP 200 → `stop()` → stopped-server reuse correctly rejected.

Phase 4 status — all done:

- 4.1 Done. `NODE_ENV=production` fallback restored (precedence: explicit config > `LOG_FORMAT`/`NO_COLOR` > `NODE_ENV`). Also fixed a gap the pinning test caught: standalone/pre-boot loggers (`createLogger()`) never parsed config, so early startup lines ignored prod JSON — `LoggerService` now parses env defaults in its constructor. Regression test added (prod output is pure JSON, no ANSI codes).
- 4.2 Done. `@hono/node-server` moved to optional `peerDependencies` (+ devDependency for local smoke); missing-module case now throws a clear "install @hono/node-server" error instead of raw `ERR_MODULE_NOT_FOUND`. Node v24.18.0 smoke re-passed after the change.
- 4.3 Done. Full monorepo suite run: all 16 packages that consume the changed hot paths pass (core 43/43, guard, validation, rate, cors, cookies, i18n, mcp, event, auth, kit 485/485, playground, …). The 4 failing packages (najm-database 1, najm-storage 57, najm-chatbot 63, najm-whatsapp 23) fail **identically against unmodified HEAD najm-core** — pre-existing failures unrelated to this work. najm-kit's turbo-run failure did not reproduce standalone in either state (environmental flake in `test:seq`).

---

## Current Workflow (verified)

1. `new Server(opts)` — creates Hono app + container (isolated or global), state = `IDLE`
2. `.use(plugin)` — eager registration with cycle detection, recursive dependency registration, contribution accumulation
3. `.load(...)` / `.scan(root)` — collect app classes (constructors, arrays, module objects, or filesystem barrel scan)
4. `.listen()` / `.fetch` → `ensureInitialized()` → `initialize()`:
   - `registerDefaultPlugins()` (middleware, params, router)
   - `mergeMiddlewareHandlers()`
   - `resolveScanRoots()` (imports every `index.*` under scan roots)
   - `collectPluginServices()` + container token setup
   - `BootService.boot()` — 3 stations: infrastructure → lifecycle (`scan` → `configure` → `activate` → `onReady`) → app services
   - state = `READY`
5. Per request: contextStorage → request-context middleware (ALS store + RequestParser) → route handler (resolve controller, resolve args, format response)

**Verdict:** architecture is sound. Issues below are edge cases, hot-path waste, and DX gaps — no structural changes needed.

---

## Phase 1 — Correctness Fixes (highest impact)

### 1.1 Node.js fallback broken — `Bun.serve` hardcoded
- **Where:** `packages/najm-core/src/server/index.ts:168` (`listen()`)
- **Problem:** `Bun.serve` is called unconditionally → `ReferenceError` on Node, despite the documented Node fallback.
- **Fix:** feature-detect and fall back:
  ```ts
  if (typeof Bun !== 'undefined') {
     this.server = Bun.serve({ fetch: ..., port });
  } else {
     const { serve } = await import('@hono/node-server');
     this.server = serve({ fetch: this.app.fetch, port });
  }
  ```
- Normalize a common `{ port, stop() }` shape so `stop()` / `port` getters work on both runtimes.
- **Test:** run a smoke test under `node` (not bun) hitting one route.

### 1.2 String plugin dependencies are registration-order sensitive
- **Where:** `packages/najm-core/src/server/index.ts:375-392` (`registerDependencies`)
- **Problem:** `requires('database')` throws at `.use()` time, so `.use(auth()).use(database())` fails while the reverse works. Nothing consumes string deps until boot.
- **Fix:** during `registerPlugin`, collect string deps into `pendingRequirements: Map<pluginName, string[]>` instead of throwing. Validate all of them at the top of `initialize()` (after `registerDefaultPlugins()`), throwing `Err.missingDependency` with the full list.
- **Test:** register auth-before-database → boots fine; missing database → clear error at init.

### 1.3 `stop()` never runs `onDestroy` for fetch-only/serverless servers
- **Where:** `packages/najm-core/src/server/index.ts:236` (`if (!this.server) return;`)
- **Problem:** servers used via `.fetch` / `.init()` have no `Bun.serve` handle → DB pools, caches, timers never tear down.
- **Fix:** guard on state instead of the server handle:
  ```ts
  if (this.state !== ServerState.READY && !this.server) return;
  ```
  Run `bootService.destroy()` whenever state was READY; stop the listener only if `this.server` exists.

### 1.4 Restart after `stop()` double-registers routes/middleware
- **Where:** same `stop()` — resets state to `IDLE` + clears `initPromise`, but Hono `app` and container keep all registrations. A second `listen()` re-runs `initialize()` → duplicate routes + duplicate global middleware on the same app.
- **Fix (minimal, recommended):** introduce `ServerState.STOPPED`; `ensureInitialized()` on a STOPPED server throws `Err.invalidState('Server was stopped; create a new Server instance')`.
- **Fix (full, later):** proper re-init support — recreate the Hono app and reset container registrations on stop. Only do this if test suites actually need restart semantics.
- **Test:** stop → listen again → expect the clear error (not silent duplication).

### 1.5 Swallowed error causes
- **Where:**
  - `packages/najm-core/src/router/RouterService.ts:117` — `catch (cause) { Err.registrationFailed(method, path); }` drops `cause`
  - `packages/najm-core/src/server/index.ts:252` — `stop()` throws `Err.stopFailed()` without the original error
- **Fix:** pass the cause through both error factories (`Err.registrationFailed(method, path, cause)`), include `cause.message` in the thrown message, attach `{ cause }`.

### 1.6 ParamResolver mutates + re-sorts its shared cache every request
- **Where:** `packages/najm-core/src/params/ParamResolver.ts:41-44` — `paramMetadata.sort(...)` sorts the array stored in the WeakMap, on every request.
- **Fix:** sort once inside `getCachedParameterMetadata()` when the cache entry is first built; remove the per-request `.sort()`.

### 1.7 CJS `require()` in the param resolver
- **Where:** `packages/najm-core/src/params/ParamResolver.ts:306` — `require('./decorators')` inside `getCachedParameterMetadata`.
- **Problem:** breaks pure-ESM bundling (Vite SSR, some Next.js configs) — exactly the environments Najm documents support for.
- **Fix:** break the circular import instead — move `getParameterMetadata` (and the metadata store) into a leaf module (e.g. `params/metadata.ts`) that both `decorators/` and `ParamResolver.ts` import statically.

### 1.8 Middleware cache collides across same-named controllers
- **Where:** `packages/najm-core/src/router/RouterService.ts:138` — cache key is `` `${controller.name}:${methodName}` ``.
- **Fix:** `WeakMap<Constructor, Map<string, MiddlewareHandler[]>>`. Also removes the need for `clearCache()` string bookkeeping.

### 1.9 `.scan()` / `.load()` can register duplicate app services
- **Where:** `packages/najm-core/src/server/index.ts:495-507` (`resolveScanRoots`) + `load()`.
- **Problem:** barrel scan imports every `index.*` under the root; a root barrel that re-exports feature barrels causes each class to be pushed into `appServices` multiple times. `load()` called twice does the same.
- **Fix:** dedupe at registration point — make `appServices` a `Set<Constructor>` (or dedupe in `initialize()` before `container.set`).

### 1.10 `RouterService.configure()` clobbers the injected base path
- **Where:** `packages/najm-core/src/router/RouterService.ts:44` — `this.basePath = this.config?.basePath ?? ''` overwrites the `BASE_PATH` token value that `scan()` correctly used.
- **Fix:** `this.basePath = this.basePath || this.config?.basePath || ''` (or just delete the line — routes are already built during `scan`).

---

## Phase 2 — Hot-Path Performance

All in the per-request path; boot path is fine as-is.

### 2.1 Hoist route-static work out of `createHandler`
- **Where:** `packages/najm-core/src/router/RouterService.ts:157-186`
- **Problem:** `getResponseMessage(target, methodName)`, `shouldSkipWrapping(...)`, and `getTranslator()` run on **every request**, but their answers are route-static (metadata) or boot-static (i18n service presence).
- **Fix:** compute in `registerRoute` and close over the results:
  ```ts
  private createHandler(route: RouteEntry): MiddlewareHandler {
     const { target, methodName, handler } = route;
     const messageOptions = getResponseMessage(target, methodName as string);
     const skipWrapping = shouldSkipWrapping(target, methodName as string);
     return async (ctx) => {
        const formatter = new ResponseFormatter(ctx, {
           translator: this.translator,   // resolved once in onReady()
           config: this.responseConfig,
           messageOptions,
           skipWrapping,
        });
        ...
     };
  }
  ```
- Resolve `this.translator` once in `onReady()` (i18n boots before router: order 1 vs 90).

### 2.2 Make `RequestParser.createRequest()` fully lazy
- **Where:** `packages/najm-core/src/router/RequestParser.ts:48-49`
- **Problem:** `req.param()` and `req.query()` are called eagerly inside the **global** request-context middleware for every request — `query()` parses the URL query string even for routes that never read it.
- **Fix:** convert `params` and `query` to lazy getters with memoization, same pattern as `body`/`headers`.

### 2.3 (Optional) Singleton controller fast path
- **Where:** `packages/najm-core/src/router/RouterService.ts:178` — `container.resolve(target)` per request.
- **Fix:** at registration time, check the controller's scope; if SINGLETON, resolve once lazily and cache the instance in the handler closure. Skip for REQUEST/TRANSIENT scopes.
- Low priority — diject singleton resolve is likely a cheap map hit already. Measure before doing.

---

## Phase 3 — DX Enhancements

### 3.1 Wire up BootDiagnostics (currently dead code) + route table
- **Where:** `packages/najm-core/src/boot/BootDiagnostics.ts` — never in `CORE_SERVICES`, never exported → unreachable.
- **Plan:**
  1. Add `diagnostics?: boolean` to `ServerOpts`. In `initialize()`, when enabled (or `NAJM_DEBUG=1` and `NODE_ENV !== 'production'`), append `BootDiagnostics` to the core service set.
  2. Replace the name-matching heuristic (`name.includes('Cors')` etc., lines 111-117) with real metadata: `container.find({ layer: 'plugin' })`.
  3. Route all output through `LoggerService` instead of `console.log`.
  4. Ship the **route table** as the headline feature:
     ```
     🛣  Routes (12)
        GET    /api/users          UserController.getAll     [isAuth, canRead]
        POST   /api/users          UserController.create     [isAdmin]
     ```
     Data already exists via `INJECTION_TYPES.ROUTE` injections; guard names via guard injections.

### 3.2 Boot timing report
- **Where:** `packages/najm-core/src/boot/BootService.ts:57-68` (`runLifecycle`)
- **Plan:** wrap each `method.call(service)` with `performance.now()` deltas; store `{ service, phase, ms }`. In diagnostics mode print the table; always warn when a phase exceeds a threshold (e.g. 500ms): `⚠ DatabaseService.configure took 812ms`.

### 3.3 Guard against double `listen()`
- **Where:** `listen()` in `server/index.ts`
- **Plan:** `if (this.server) throw Err.invalidState(\`Server already running on port ${this.server.port}\`);`

### 3.4 Graceful shutdown option
- **Plan:** `ServerOpts.gracefulShutdown?: boolean` (default false). When enabled in `listen()`, register `SIGINT`/`SIGTERM` handlers → `await this.stop()` → `process.exit(0)`. Remove handlers in `stop()` to avoid leaks in tests.

### 3.5 Startup error ergonomics
- **Where:** `packages/najm-core/src/server/index.ts:309-319` (alias materialization loop)
- **Plan:**
  - Replace raw `console.error` with the logger, and **fail the boot** instead of continuing with a broken alias (a half-booted server is worse than a clear error).
  - Consolidate `silent` handling: `LoggerService` already checks `opts.silent` (LoggerService.ts:79) — delete the scattered `if (!this.opts.silent)` guards in Server and let the logger be the single gate.

### 3.6 Cleanup
- `packages/najm-core/src/main.ts` starts a live server on import (manual test leftover). Move to `apps/playground` or delete; ensure nothing references it in `package.json` entries/exports.

---

## Phase 4 — Follow-ups from Post-Implementation Review

Problems found while reviewing the implemented diff. Not yet fixed.

### 4.1 LoggerService production defaults silently changed (behavior regression risk)
- **Where:** `packages/najm-core/src/logging/LoggerService.ts` (`resolveConfig` + `getDefaultConfig`)
- **Problem:** the logging refresh changed defaults beyond the plan's scope:
  - `format` used to default to `'json'` when `NODE_ENV === 'production'`; now it defaults to `'pretty'` unless `LOG_FORMAT=json` is set.
  - `colors` used to default to off in production; now colors are on unless `NO_COLOR` is set.
  - Net effect: an existing prod deployment that emitted JSON lines for a log aggregator now emits pretty output **with ANSI escape codes** — breaks log parsing pipelines on upgrade with no code change on the user's side.
- **Fix:** keep the new env vars as explicit overrides, but restore `NODE_ENV=production` as the fallback signal:
  ```ts
  format: config.format
     ?? (process.env.LOG_FORMAT as 'pretty' | 'json')
     ?? (process.env.NODE_ENV === 'production' ? 'json' : 'pretty'),
  colors: config.colors
     ?? (process.env.NO_COLOR ? false : process.env.NODE_ENV !== 'production'),
  ```
  Precedence: explicit `logger` config > `LOG_FORMAT` / `NO_COLOR` env > `NODE_ENV` fallback.
- **Test:** with `NODE_ENV=production` and no `LOG_FORMAT`, entries are JSON and color codes absent; `LOG_FORMAT=pretty` still wins over `NODE_ENV`.

### 4.2 `@hono/node-server` is a hard dependency Bun users never use
- **Where:** `packages/najm-core/package.json` (`dependencies`)
- **Problem:** the Node fallback loads `@hono/node-server` via dynamic import only on the Node path, but as a regular dependency it is installed for every consumer, including Bun-only projects.
- **Fix:** move it to `optionalDependencies` (or peer + `peerDependenciesMeta.optional`), and wrap the dynamic import in `createListener()` with a clear error when missing:
  ```
  Running on Node requires @hono/node-server. Install it with: bun add @hono/node-server
  ```
- **Test:** Node smoke still passes when the package is installed; simulated missing module produces the guidance message instead of a raw `ERR_MODULE_NOT_FOUND`.

### 4.3 Full monorepo regression run pending
- **Problem:** najm-core changes touch shared hot paths (RouterService, ParamResolver, MiddlewareService) consumed by every plugin package, but only `packages/najm-core` tests were run.
- **Fix:** run `bun run test` (Turbo, all packages) once before committing; fix any downstream breakage (most likely candidates: najm-guard middleware injections, najm-i18n translator timing via the new `onReady` caching, najm-mcp controller resolution).

---

## Suggested Order of Execution

| Step | Items | Why first |
|------|-------|-----------|
| 1 | 1.1, 1.2 | User-facing breakage (Node runtime, plugin ordering) |
| 2 | 1.5, 1.6, 1.7 | Small, isolated, zero-risk fixes |
| 3 | 1.3, 1.4 | Lifecycle semantics — needs a couple of new tests |
| 4 | 1.8, 1.9, 1.10 | Correctness polish |
| 5 | 2.1, 2.2 | Hot-path wins, behavior-preserving |
| 6 | 3.1, 3.2 | Diagnostics + route table (headline DX feature) |
| 7 | 3.3, 3.4, 3.5, 3.6 | Remaining DX polish |
| 8 | 2.3 | Optional, only after measuring |

## Testing Strategy

- Every Phase 1 item gets a regression test in `packages/najm-core` (bun:test, `isolated: true` servers, per existing pattern).
- Node fallback (1.1): add a separate `node`-run smoke script (can live in playground scripts).
- Hot-path changes (2.x): verify with existing route/param tests; no new behavior expected.
- Diagnostics (3.1/3.2): snapshot-ish test asserting the route table lists registered routes; keep output behind the flag so default test noise doesn't change.

## Non-Goals

- No parallelization of lifecycle phases (determinism > marginal boot speed).
- No structural changes to the 3-station boot or plugin contribution system — they're solid.
- Full stop→restart support (1.4 full fix) deferred unless a real use case appears.
