# Najm — Hot-Path Performance Plan ("Beat Elysia")

Goal: close the request-dispatch gap to raw Hono via boot-time route
compilation (Tier 1), then optionally bypass Hono dispatch to compete with
Elysia head-on (Tier 2). Continues the Phase 7 performance-validation work
(benchmarks live in `benchmarks/`).

This document is written to be executable by an autonomous coding agent with
no prior context. Read the whole file before changing code.

---

## 0. Orientation for the implementing agent

### Repo facts you must know

- Monorepo (Bun workspaces + Turbo). The framework core is
  `packages/najm-core`. All hot-path code touched by this plan lives there.
- **Tests import the built bundle**, not source:
  `packages/najm-core/test/*.test.ts` do
  `import { ... } from '../dist/index.mjs'`. Therefore you MUST rebuild
  before every test run or you test stale code:

  ```bash
  bun run build:core                      # from repo root (turbo → tsup)
  bun --cwd packages/najm-core test       # full core suite (58+ tests)
  ```

- Benchmarks (run from repo root; they import the built `najm-core`):

  ```bash
  bun benchmarks/layers.bench.ts          # layer-by-layer µs/op breakdown
  bun benchmarks/hotpath.bench.ts         # in-process dispatch ops/s
  bun run bench:frameworks                # vs Elysia/Fastify/NestJS/Hono
  ```

- Source style in `najm-core/src`: 3-space indent, section banner comments
  (`// ====== LIFECYCLE: SCAN ======`), private helpers below public API.
  Match it.
- DI container is `diject` (external npm pkg, `node_modules/diject`).
  Relevant exports: `Container`, `Scope` (SINGLETON/REQUEST/TRANSIENT),
  `getScope(target: Function): Scope`, `createAlsToken`, `container.run(store, fn)`
  (ALS enter), `container.get(token)` (**sync**, reads ALS or registry),
  `container.resolve(target)` (**async** instantiate/fetch),
  `container.getInjectionsFor(type, target, methodName?)` (registry scan).

### The request flow today (what you are optimizing)

```
Bun.serve → Hono app.fetch
  → contextStorage()                     [MiddlewareService.registerCoreMiddleware, order 1]
  → request-context middleware           [order 2 — uuid, RequestParser, container.run(ALS), cleanupReq]
  → (metrics/cors/user middleware if registered)
  → route handler                        [RouterService.createHandler closure]
       new ResponseFormatter(ctx, {...})           ← alloc per request
       await container.resolve(target)             ← async DI per request, even singletons
       await this.resolveArgs(target, methodName)  ← getInjectionsFor scan per request
         → injection.resolve()                     ← ParamResolver.resolveArgs(handler)
             → Promise.all(extractParameterValue)  ← async switch per arg, ALS probes
       handler.call(instance, ...args)
       formatter.formatResponse(result)
```

Key files (all under `packages/najm-core/src/`):

| File | Role | Hot spots |
| --- | --- | --- |
| `router/RouterService.ts` | route registration + per-request handler | `createHandler()` (~L164), `resolveArgs()` (~L204) |
| `params/ParamService.ts` | scans `@Params` etc., registers PARAMS injections | `registerParamInjection()` — injection is `{ type, target, methodName, metadata, resolve }` |
| `params/ParamResolver.ts` | per-request arg building | `resolveArgs()`, `extractParameterValue()` (giant switch) |
| `params/metadata.ts` | `getParameterMetadata(handler)` → `ParameterMetadata[]` (`{ index, type, propertyKey }`) | already WeakMap-cached in resolver |
| `middleware/MiddlewareService.ts` | core middleware | `createRequestContextMiddleware()` (~L125): uuid + eager `new RequestParser(ctx)` + `parser.createRequest()` + `container.run` |
| `router/ResponseFormatter.ts` | response wrapping | allocated per request in `createHandler` |
| `router/RequestParser.ts` | lazy-ish request view | constructed eagerly per request today |

### Boot lifecycle constraint (critical for T1.1)

`BootService` boots in stations: STATION 1 core services → STATION 2 plugin
lifecycle (`scan` → `configure` → `activate` → `onReady`) → STATION 3 app
services (controllers) resolved **after** plugin phases. Therefore
**do not eagerly `container.resolve(controller)` inside
`RouterService.activate()`** — controllers are app-layer and must not be
instantiated before STATION 3. Use lazy-once capture inside the handler
closure instead (first request resolves, then caches — see T1.1).

---

## 1. Measured baseline (where the 47µs goes)

Measured with `benchmarks/layers.bench.ts` (in-process `server.fetch()`, 50k
iterations, Bun 1.3.14, Windows x64). Ratios matter, not absolutes —
re-measure on the same machine before/after every change.

| Layer | µs/op | Δ | Cause |
| --- | --- | --- | --- |
| A. raw Hono `/users/:id` | 6.9 | — | floor |
| B. + `contextStorage()` | 8.4 | +1.5 | second ALS enter (diject already has one) |
| C. + requestId (uuid + echo) | 14.1 | +5.7 | `randomUUID()` per request, even when unread |
| D. + parser + `container.run` + cleanup | 23.7 | +9.7 | eager `new RequestParser` + `createRequest()`, ALS enter, cleanup promise |
| E. najm `/plain` (no param decorators) | 28.1 | +4.3 | per-request `ResponseFormatter` alloc, async controller `resolve()` |
| F. najm `/users/:id` (one `@Params`) | 53.9 | **+25.8** | **param resolution — audit below** |

Competitive context (`benchmarks/frameworks.bench.ts`, runtime held at Bun):
raw Hono 100%, **Elysia 137%**, Fastify 67%, **najm 53%**, NestJS 48%.
Elysia beats raw Hono because it AOT-compiles routes (Sucrose) onto
`Bun.serve` directly. najm sits **on** Hono, so raw Hono is najm's ceiling
until Tier 2.

### Hot-path audit (why one `@Params('id')` costs 25.8µs)

Per request, `RouterService.createHandler` + `ParamResolver.resolveArgs` do:

1. `container.getInjectionsFor(PARAMS, target, methodName)` — registry scan
   **every request**; the result is a boot-time constant
   (`RouterService.resolveArgs`, ~L204).
2. `await container.resolve(target)` — async DI resolution per request even
   for SINGLETON controllers (`createHandler`, ~L178).
3. `Promise.all` + async `extractParameterValue` per arg — promise machinery
   around what is a sync `ctx.req.param('id')`
   (`ParamResolver.resolveArgs`, L41–56).
4. ALS probes `container.get(VALIDATED_PARAMS/BODY/QUERY/HEADERS)` per param.
   NOTE: `container.get` is **sync and cheap-ish**; the killer is the async
   wrapper around it, not the probe itself. Keep probes; kill the promises.
5. `new ResponseFormatter(ctx, {...})` alloc per request; the wrap/no-wrap
   decision (`messageOptions`, `skipWrapping`, `responseConfig`) is boot-time
   knowable (`createHandler`, L166–175).
6. Eager `new RequestParser(context)` + `parser.createRequest()` in the
   request-context middleware for every route, including routes that never
   read the body (`MiddlewareService.createRequestContextMiddleware`).

None of this needs runtime information unavailable at boot.

---

## 2. Tier 1 — Boot-time route compilation (no architecture change)

Target: **~54µs → ~10–12µs/op** on the `/users/:id` shape → najm at
**65–80% of raw Hono** with full DI + guards. Decisively past Fastify and
NestJS; not yet past Elysia.

Work through the tasks in order; each is independently shippable. After EACH
task: rebuild, run tests, run `layers.bench.ts`, and record the numbers in
the progress log (§5).

### T1.1 Compiled route plan (RouterService)

**File:** `router/RouterService.ts`, `createHandler()` and `resolveArgs()`.

**Change:**

- At handler-creation time (runs during `activate()`, boot), look up the
  PARAMS injection ONCE:

  ```ts
  const [paramsInjection] = this.container.getInjectionsFor<ParamsInjection>(
     INJECTION_TYPES.PARAMS, target, methodName);
  const resolveArgs = paramsInjection?.resolve;   // may be undefined → []
  ```

  Capture `resolveArgs` in the closure; delete the per-request
  `this.resolveArgs(...)` method call and registry scan.

  ⚠️ Ordering: `ParamService.scan()` registers PARAMS injections and
  `RouterService` has `@Meta({ layer: 'plugin', order: 90 })`, so all
  injections exist before `RouterService.activate()` runs. Verify by
  asserting `paramsInjection` is found for a decorated test route.

- Singleton fast path, **lazy-once** (see boot constraint in §0):

  ```ts
  const isSingleton = getScope(target) === Scope.SINGLETON;   // diject export
  let cached: any;
  // per request:
  const instance = isSingleton
     ? (cached ??= await this.container.resolve(target))
     : await this.container.resolve(target);
  ```

  REQUEST/TRANSIENT-scoped controllers MUST keep per-request resolve.

- Response fast path: `messageOptions`, `skipWrapping`, `this.responseConfig`
  are already read at boot. Add: when there are no messageOptions, wrapping
  is skipped or autoWrap=false, and the handler result is a plain object
  (not `Response`, not null/undefined, not a stream), return
  `ctx.json(result)` directly without constructing `ResponseFormatter`.
  Anything else falls back to the existing formatter — do NOT reimplement
  its semantics. Check `ResponseFormatter.formatResponse` first to copy its
  exact plain-object condition.

**Risk:** singleton caching across requests leaking REQUEST state — cannot
happen for true singletons, but write the regression test in T1.7 anyway.

### T1.2 Compiled param extractors + sync fast path (ParamResolver)

**File:** `params/ParamResolver.ts` (+ tiny change in
`params/ParamService.ts`).

**Change:** add a `compile(handler): CompiledPlan` API next to
`resolveArgs`:

```ts
type Extractor = (ctx: Context) => unknown;              // sync
type AsyncExtractor = (ctx: Context) => Promise<unknown>; // body/file/…
interface CompiledPlan { extractors: (Extractor|AsyncExtractor)[]; allSync: boolean; }
```

- Build one extractor per `ParameterMetadata` by moving each `case` of the
  `extractParameterValue` switch into a factory that returns a closure
  specialized on `type` + `propertyKey`. Examples:
  - `params` + key: `(ctx) => { const v = this.container.get(VALIDATED_PARAMS); return v !== undefined ? v?.[key] : ctx.req.param(key); }`
    — note the VALIDATED probe stays (it's a sync ALS get; removing it
    breaks `najm-validation`), but there is no promise and no switch.
  - `query`/`headers`/`cookie`/`ip`/`path`/`url`/`method`/ALS tokens
    (`user`, `role`, …): all sync.
  - `body`, `file`, `json`, `text`, `arrayBuffer`, `blob`, `formData`:
    async (need `parser.parseBody()` etc.) — mark plan `allSync = false`.
- `resolveArgs` fast path: if a compiled plan exists and `allSync`, build the
  args in a plain `for` loop — **zero promises**. Mixed plans:
  loop sync extractors, `await` only the async ones.
- Keep the legacy path (undecorated params resolved by parameter NAME —
  `resolveLegacyParameter`) untouched: the compiled path applies only when
  `paramMetadata.length === handler.length`. Otherwise fall through to the
  existing generic `resolveArgs`.
- Cache plans in a `WeakMap<Function, CompiledPlan>` (mirror the existing
  `parameterMetadataCache`).
- Wire-up: in `ParamService.registerParamInjection`, keep
  `resolve: () => this.resolver.resolveArgs(handler)` (guards and any other
  consumers keep working — note `resolver` is created later in `configure()`,
  so the closure indirection must stay). `resolveArgs` itself gets the fast
  path internally, so RouterService needs no knowledge of plans.

**Note on guards:** `ParamService.scan()` also registers PARAMS injections
for `ScanType.GUARD` methods; they go through the same `resolveArgs` and get
the fast path for free. Do not special-case them.

### T1.3 Lazy RequestParser / request (MiddlewareService)

**File:** `middleware/MiddlewareService.ts`,
`createRequestContextMiddleware()`.

**Change:** stop paying `new RequestParser(context)` +
`parser.createRequest()` on every request.

⚠️ **VERIFIED CONSTRAINT:** `defineProperty` getters on the store object DO
NOT WORK with current diject. `AlsStore.run()`
(`Desktop/diject/src/container/AlsStore.ts`, ~L30) copies the data object
into a `Map` via `Object.entries(data)`, which **invokes getters eagerly**
during the copy — the laziness would be silently defeated. Options that do
work:

1. **No diject change (do this first):** put only `{ requestId, context }`
   in the ALS store. Make the `REQUEST`/`PARSER` consumers lazy at the
   consumer side: a module-level
   `getParser(ctx: Context): RequestParser` helper backed by
   `WeakMap<Context, RequestParser>` memoization; `ParamResolver`'s
   `getRequestData()`/body extractors call it with
   `container.get(CONTEXT)`. Grep first for every consumer of the `REQUEST`
   and `PARSER` ALS tokens across `packages/*/src` — all of them must
   migrate to the helper, otherwise they read `undefined` from the store.
2. **With a diject change (cleaner, we own diject —
   `Desktop/diject`):** add lazy store values, e.g.
   `store.set(key, lazyValue(() => ...))` where `AlsStore.get()` unwraps and
   memoizes thunks on first read. Then the middleware stores
   `request`/`parser` as thunks and no najm-core consumer changes at all.
   Requires a diject version bump + `bun update diject` in najm.

`RequestParser.createRequest()` already lazy-resolves params/query (see
`core-review-plan.test.ts` "lazily resolves route params"), so the win here
is skipping the two constructions entirely for routes that never touch
`@Body`/`@Req`/etc.

**Verify:** `@Body`, `@File`, `@Req`, `@Ctx` decorators still work (they are
covered by existing param tests — plus playground e2e if in doubt).

### T1.4 Cheap request IDs (MiddlewareService)

**File:** `middleware/MiddlewareService.ts` + `middleware/types.ts`.

`crypto.randomUUID()` costs most of the +5.7µs in layer C. Change:

- Add `requestId?: 'uuid' | 'fast' | ((ctx: Context) => string)` to
  `MiddlewareConfig` (default `'fast'`).
- `'fast'`: `` `${process.pid.toString(36)}-${(seq++).toString(36)}` `` with a
  module-level counter — unique per process, good enough for log correlation.
- `'uuid'`: current behavior. Incoming `x-request-id` header always wins
  (unchanged). The response echo (`c.header(headerName, requestId)`) stays —
  it is part of Phase 6 and asserted by `test/observability.test.ts`.
- Document the tradeoff (fast ids are not globally unique across restarts)
  in `packages/najm-core/README.md` § Request IDs.

### T1.5 Audit + drop the duplicate ALS enter

**Files:** `middleware/MiddlewareService.ts` (`registerCoreMiddleware`).

Hono's `contextStorage()` (order 1) and diject's `container.run` (order 2)
are two ALS enters per request (~1.5µs for the first). Before removing
`contextStorage()`:

```bash
grep -rn "context-storage\|getContext" packages/*/src apps/playground/src
```

If anything imports `getContext` from `hono/context-storage`, it depends on
the Hono ALS — either migrate it to `container.get(CONTEXT)` (the diject
store already carries `context`) or keep `contextStorage()` and skip this
task. Removing it silently while a plugin depends on it = broken plugin at
runtime with no boot error.

### T1.6 Micro passes (only after T1.1–T1.3 land)

- Stable ALS store shape: same keys in the same order for every request
  (hidden-class stability). No spreads on the hot path.
- `container.cleanupReq()`: check diject — if it allocates/awaits even when
  no REQUEST-scoped instance was created, guard it with a cheap "anything to
  clean?" check (may require a diject change; skip if not exposed).
- `Err.handle` / try-catch shape in `createHandler`: keep — correctness over
  µs here.

### T1.7 Regression tests (write BEFORE optimizing if practical)

Add `packages/najm-core/test/hotpath-scope.test.ts`:

1. REQUEST-scoped controller (`@Controller('/rs')` +
   `@Injectable(Scope.REQUEST)` or the equivalent scope mechanism used in
   core tests) returning `this`-identity marker → two sequential requests
   MUST see different instances (proves T1.1 didn't freeze scope).
2. Singleton controller → two requests, same instance observed (cache works).
3. Route with `@Body()` still parses JSON after T1.3 laziness.
4. Mixed decorated/undecorated parameters still resolve (legacy path).
5. Existing suites must stay green:
   `bun --cwd packages/najm-core test` (observability, core-review-plan,
   server-logging, boot-order, resolution, run-as).

### Diject touchpoints (we own it: `c:/Users/hdevlop/Desktop/diject`)

Tier 1 requires **no diject changes** if T1.3 uses the consumer-side helper
(option 1). Optional diject improvements, each a separate diject release:

| Task | Diject change | Win |
| --- | --- | --- |
| T1.3 opt. 2 | lazy store values (`get()` unwraps + memoizes thunks) | cleaner than the WeakMap helper; no consumer migration |
| T1.6 | `run()` fast path: skip `new Map(currentStore)` + `Object.entries` loop when there is no parent store and data has a known shape (or accept a prebuilt `Map`) | one Map alloc + iteration per request |
| T1.6 | sync `hasRequestScoped()` so `cleanupReq()` can be skipped without the async call chain when nothing REQUEST-scoped was created | micro |

Everything else uses existing diject exports only: `getScope`, `Scope`,
sync `container.get`, `container.resolve`, `getInjectionsFor`,
`container.run`. If a diject change ships, update `packages/najm-core/package.json`
dependency range and re-run the full suite.

### Tier 1 guard rails & done-when

- `bun benchmarks/layers.bench.ts` before/after each task; a regression =
  any layer delta grows. Log numbers in §5.
- Done when: najm `/users/:id` ≤ **12µs/op** in `layers.bench.ts` on the
  same machine; `bun run bench:frameworks` shows najm ≥ Fastify; full core
  suite green; T1.7 tests prove scope semantics.

---

## 3. Tier 2 — Bypass Hono dispatch (only path past Elysia)

Post-launch candidate; a dispatch-layer rewrite. Do only if the req/s crown
is worth it strategically.

1. **Native route table**: compile decorated routes into `Bun.serve`'s
   `routes` option (static route map, per-route handlers), falling back to
   Hono `fetch` for wildcards/middleware-heavy paths. This is how Elysia
   exceeds raw Hono. Entry point: `server/listener.ts` `createListener()`
   currently does `Bun.serve({ fetch, port })` — it would receive the
   compiled route table alongside the fallback fetch.
2. **Handler codegen** (Sucrose-style): generate per-route function bodies
   with `new Function` — inline extractor calls, no loops, no closures over
   arrays. ⚠️ `new Function` is banned on some serverless/edge targets
   (CSP): must be opt-in or build-time, never the only path.
3. **Middleware contract**: define which global middleware (metrics, CORS,
   request-context) must still wrap native-route handlers and compose them
   at boot into the generated function. The Phase 6 metrics/health/request-id
   behavior must be preserved on the native path (their tests are the spec).

**Done when:** najm ≥ raw Hono on `/json` and `/users/:id` in
`bench:frameworks`, with the Hono fallback path still passing the full suite.

---

## 4. Positioning (regardless of tier)

Do not sell a req/s crown we don't hold. The honest launch line after Tier 1:

> Full DI, guards, and 40+ param decorators at ~80% of raw Hono throughput —
> with ~2× faster cold start and ~30% less memory than NestJS, and faster
> cold start than Elysia.

Cold start (118ms vs Nest 698ms) and RSS (89MB vs Nest 130MB) are already
wins; Tier 1 adds "faster than Fastify with batteries included".

---

## 5. Progress log (fill in as you go)

| Date | Task | `/plain` µs | `/users/:id` µs | Core tests | Notes |
| --- | --- | --- | --- | --- | --- |
| 2026-07-07 | baseline | 28.1 | 53.9 | 58 pass | Bun 1.3.14, Win x64 |
| 2026-07-07 | T1.1 | 14.19 | 19.49 | 62 pass | `bun run build:core`; `bun run test:core`; `bun benchmarks/layers.bench.ts` |
| 2026-07-07 | T1.1 recheck | 14.91 | 21.23 | 62 pass | Fresh verification after report request; benchmark variance on Bun 1.3.14, Win x64 |
| 2026-07-07 | T1.1 review | 14.62 | 19.49 | 62 pass | Independent review: diff verified (bypass matches ResponseFormatter semantics; lazy-once singleton; T1.7 tests present). Remaining slices: params 4.9, parser/ALS 6.0, uuid 3.0, contextStorage 1.1. e2e `bench:frameworks`: najm 53%→56% of hono, `/users/:id` 11.7k→16.5k req/s |
| 2026-07-07 | T1.2 | 14.63 | 16.74 | 63 pass | Compiled param extractors + sync fast path; guard package direct-source test blocked by existing decorator load error before tests |
| 2026-07-07 | T1.2 recheck | 14.28 | 16.84 | 63 pass | Fresh status check for completed-work report; `bun run test:core`; `bun benchmarks/layers.bench.ts` |
| 2026-07-07 | T1.3 | 11.69 | 14.75 | 63 pass | Lazy RequestParser/request via Context WeakMap helper; `bun run build:core`; `bun run test:core`; `bun run build:validation`; `bun run build:rate`; `bun benchmarks/layers.bench.ts` |
| 2026-07-07 | T1.4 | 11.65 | 13.56 | 65 pass | Fast per-process request IDs by default, UUID/custom opt-in, echo preserved; `bun run build:core`; `bun run test:core`; `bun benchmarks/layers.bench.ts` |
| 2026-07-07 | T1.5 | 10.61 | 12.62 | 65 pass | Audited `hono/context-storage`/`getContext` consumers; no runtime consumers outside core middleware; removed duplicate Hono ALS enter; `bun run build:core`; `bun run test:core`; `bun benchmarks/layers.bench.ts` |
| 2026-07-07 | T1.6 | 10.31 | 11.97 | 66 pass | Store already fixed-shape `{ requestId, context }`; guarded `cleanupReq(requestId)` behind diject request-scope maps; added request-scope cache cleanup regression; `bun run build:core`; `bun run test:core`; `bun benchmarks/layers.bench.ts` |
| 2026-07-07 | Tier 1 final | 9.34 | 10.32 | 66 pass | Sync listener/route fast path; `bun run build:core`; `bun run test:core`; `bun benchmarks/layers.bench.ts`; `bun run bench:frameworks` showed najm 24,768 `/json` and 23,211 `/users/:id` req/s vs Fastify 23,953 and 22,574 |

## 6. Checklist

- [x] T1.1 compiled route plan (boot-time injection lookup, lazy-once
      singleton capture, response fast path)
- [x] T1.2 compiled param extractors + sync fast path (VALIDATED probes kept,
      legacy-name path untouched, guards covered)
- [x] T1.3 lazy RequestParser/request in request-context middleware
- [x] T1.4 fast request-id default (uuid opt-in), echo preserved, README note
- [x] T1.5 audit consumers, then drop duplicate `contextStorage()` ALS enter
- [x] T1.6 micro: stable store shape, cleanup fast path
- [x] T1.7 scope regression tests (REQUEST vs SINGLETON controller, body,
      legacy params)
- [x] Re-measure `layers.bench.ts` + `bench:frameworks`; update the table in
      `benchmarks/README.md` and any launch-post numbers
- [ ] (Tier 2, post-launch) native `Bun.serve` routes + codegen spike behind
      a flag

## 7. Current status report

Checked on 2026-07-07 after Tier 1 final:

- Done: T1.1 compiled route plan, T1.2 compiled param extractors/sync fast
  path, T1.3 lazy RequestParser/request creation, T1.4 fast request IDs, and
  T1.5 duplicate ALS removal, T1.6 micro cleanup guard, final listener/route
  sync fast path, and benchmark README update. T1.7 regression coverage is
  still green.
- Verified: `bun run test:core` passes with 66 tests; latest
  `layers.bench.ts` is `/plain` 9.34 us/op and `/users/:id` 10.32 us/op.
- Net movement from baseline: `/plain` 28.1 -> 9.34 us/op; `/users/:id`
  53.9 -> 10.32 us/op.
- Framework gate: latest `bun run bench:frameworks` showed najm ahead of
  Fastify on both routes (`/json` 24,768 vs 23,953 req/s; `/users/:id`
  23,211 vs 22,574 req/s). Raw-Hono rows were unstable in the Windows/Bun
  self-contained load-driver run, so do not publish raw-Hono ratios without an
  external-client cross-check.
- Known caveat: direct `bun test packages/najm-guard` still fails before tests
  load because of the existing direct-source decorator transform issue in
  `GuardService.ts`; core coverage for guard-shared resolver paths remains
  green through the rebuilt `najm-core` suite.
- Known caveat: direct `bun run test:validation` and `bun run test:rate`
  currently fail before test assertions load with the same direct-source
  decorator shape (`@DI()` receives no property target); package builds pass.
