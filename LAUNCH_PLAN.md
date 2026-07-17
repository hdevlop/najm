# Najm — Launch Plan

The road from "framework works and is fast" to "framework is published,
documented, and announced". Supersedes `HOT_PATH_PERF_PLAN.md` (Tier 1
complete, see git `bc3594d`) and the earlier production-readiness plan.

This document is written to be executable by an autonomous coding agent with
no prior context. Read the whole file before changing code.

---

## 0. Current state (verified 2026-07-07)

**Done — do not redo, do not regress:**

- **Performance (Tier 1)**: dispatch overhead 47µs → ~8µs vs raw Hono;
  `/users/:id` 53.9 → ~10–13µs/op. e2e: Fastify parity, ~30% more req/s than
  NestJS, cold start 120ms (Nest 654–840ms), RSS ~84MB (Nest ~130MB).
  Regression anchors + benches live in `benchmarks/` (`layers.bench.ts`,
  `hotpath.bench.ts`, `frameworks.bench.ts`). **Tier 2 (bypass Hono via
  native `Bun.serve` routes + codegen) is deliberately parked post-launch**
  — spec is in git history (`HOT_PATH_PERF_PLAN.md` §3 at `bc3594d`).
- **Observability (old Phase 6)**: first-party `health()` + `metrics()`
  plugins in najm-core, `x-request-id` echo, graceful-shutdown drain
  (`shutdownTimeout`). Documented in `packages/najm-core/README.md`
  § Observability & Operations. Tests: `test/observability.test.ts`.
- **Test/runtime confidence (old Phase 3)**: playground e2e, serverless
  smoke, soak, Node runtime smoke scripts wired in root `package.json`.
- **Security items landed**: JWT secret strength enforcement (najm-auth),
  wildcard+credentials rejection (najm-cors), production error redaction
  (najm-core).
- **Rate-limit key scoping** (fixed during Tier 1 review): method-level
  `rl:<METHOD>:<routePath>:<key>`, controller-level `rl:ctrl:<Name>:<key>`,
  global `rl:global:<key>`. Documented in `CLAUDE.md`.

**Verified missing (this plan):** L3 still has strict-mode and broader
`export *` pruning follow-up work; launch verification still needs fresh-machine
cold-start checks and publish-readiness dry runs.

### Rules for any agent working this plan

1. **Rebuild before testing** — package tests import `../dist/index.mjs`:
   `bun run build:core && bun --cwd packages/najm-core test`.
2. **Core changes require the cross-package sweep** (Tier 1 review caught a
   mass failure the core suite could not see):

   ```bash
   for p in najm-core najm-rate najm-validation najm-guard najm-cookies najm-auth; do
     bun --cwd packages/$p test; done
   ```

3. **Perf guard**: after touching request-path code, run
   `bun benchmarks/layers.bench.ts` and compare against the anchors in
   `benchmarks/README.md` § Latest Local Results. A >15% regression on
   `/plain` or `/users/:id` blocks the change.
4. Don't invent style — 3-space indent in package src, banner comments,
   match neighbors.

---

## L1 — Release engineering (BLOCKING, do first)

1. **LICENSE**: MIT at repo root; add `"license": "MIT"` to every
   publishable `packages/*/package.json` (audit:
   `grep -L '"license"' packages/*/package.json`). Private packages
   (`benchmarks`, apps) exempt.
2. **CI** (`.github/workflows/ci.yml`):
   - PR/push: install → `bun run build` → test matrix.
   - Matrix: Bun latest on ubuntu + windows; Node 20/22 job running
     `bun run test:node-runtime` + playground e2e under Node.
   - Storage dialects: sqlite in-process; Postgres + MySQL via services.
   - Perf smoke (non-blocking report): `bun benchmarks/layers.bench.ts`.
3. **Versioning**: adopt Changesets; **lockstep all publishable packages on
   a single `2.0.0` line** (kills the 0.0.18-mcp / 1.1.22-storage /
   `storage()` builder `version('2.0.0')` drift in one move — simplest
   launch story). Write `COMPATIBILITY.md` (Bun/Node/Hono supported ranges).
4. **SECURITY.md** with a private disclosure channel (email or GitHub
   private vulnerability reporting).
5. Issue/PR templates, protect `main` (CI required).

**Done when:** a PR cannot merge without green CI on all matrices and
`npx changeset publish --dry-run` produces a coherent lockstep release.

## L2 — Security close-out (BLOCKING)

Remaining from the old sweep (three items already landed — see §0):

1. `/security-review` pass over **najm-auth** (JWT lifecycle, revocation
   cache, reset flows, timing), **najm-mcp** (auth on tool invocation,
   stdio/SSE), **najm-storage** re-verify, **najm-rate**, **najm-cookies**.
2. Storage: require explicit `guards: []` to opt INTO public routes
   (currently warn-and-continue).
3. Auth default rate limits: when `najm-rate` is registered, `/auth/login`,
   `/auth/register`, `/auth/forgot-password` must ship sane defaults —
   verify or add.
4. `bun audit`/osv-scanner job in CI (L1 pipeline).

**Done when:** every finding fixed or accepted in writing; each outward
package README states its security defaults.

## L3 — API freeze & deprecations

**Status:** advanced and passed forward, but not fully closed. All publishable
package `tsconfig.json` files still have `"strict": false`, and the broader
`export *` pruning is a larger follow-up beyond the storage narrowing already
landed.

1. Per-package `index.ts` export review — stop `export *` that leaks
   internals (storage validator exports were narrowed; finish the rest).
   Snapshot the public API per package (even a checked-in `api.md` from
   `bun x tsup --dts` output diff) so breaks become visible in PRs.
2. Execute deprecations: remove `@Annotations` from najm-mcp (slated; still
   present in `packages/najm-mcp/src/decorator.ts`), purge deprecated CLI
   aliases from code + docs.
3. `strict: true` everywhere; no `any` on public signatures.
4. Semver + deprecation-window policy in `CONTRIBUTING.md`.

**Done when:** "no breaking changes within a major" is an honest promise.

## L4 — Docs, OpenAPI, DX (the adoption moat)

**Status:** implementation closed. Core now exposes `server.openapi()` for
OpenAPI 3.1 route/schema emission, docs include the OpenAPI guide, and the
existing docs/benchmark surfaces cover the adoption story. Before launch, run
the release verification checklist below on fresh machines and keep L3's
strict-mode/export cleanup tracked above.

1. **OpenAPI 3.1 generation** — table stakes vs NestJS. Route metadata +
   `@Validate` zod schemas are emitted by `server.openapi()`. v1 scope:
   paths, methods, params/query/header/body schemas from zod-like validation
   metadata, plus explicit auth security schemes.
2. **Docs site** (`apps/website`): 10-minute quickstart (scaffold → CRUD +
   auth + storage), per-plugin guide with security defaults, architecture
   page (boot lifecycle, DI scopes, plugin authoring), deployment guides
   (Bun, Node, Next.js, Docker) + env-var reference.
3. **Benchmarks page**: publish the honest numbers (Fastify parity, cold
   start, RSS; Elysia leads raw req/s — say so) with reproduction
   instructions; cross-check headline numbers with autocannon before
   publishing.
4. **`najm-api create` cold-start test** on clean Windows + Linux + macOS.
5. Error-message audit: every framework error says what to do next.

**Done when:** a stranger goes zero → deployed CRUD API with auth in under
an hour without reading framework source.

## L5 — Launch

1. **Positioning**: "batteries-included Bun/edge framework with MCP-native
   APIs". Lead with `@McpTool()` on HTTP controllers, auth+storage+studio
   out of the box, serverless story, and the honest perf line:
   *"Fastify-class throughput with full DI, guards, and 40+ decorators —
   2.7× faster cold start and ~35% less memory than NestJS."*
2. Root README rewrite: hero example (~20 lines: controller with
   HTTP+MCP+guard+validate), feature matrix, benchmark link.
3. Example repos: CRUD+auth starter, Next.js integration, MCP server demo.
4. `npm publish` via the L1 pipeline (`latest` tag), docs site release tag.
5. Announce (Show HN, r/typescript, Bun Discord); be responsive for the
   first 72h.

### Go / No-Go checklist (day before)

- [ ] CI green: Bun + Node, Linux + Windows, all storage dialects
- [ ] Security findings closed; `SECURITY.md` live
- [ ] LICENSE at root + every published package
- [ ] Lockstep versions; `COMPATIBILITY.md`; changelogs generated
- [ ] Quickstart tested cold on a clean machine
- [ ] OpenAPI generation works on the playground
- [ ] Soak: flat RSS 30 min, stable p99 (`bun run test:soak`)
- [ ] `npm pack` dry-run inspected per package (files, exports map, types
      resolve in a fresh consumer)
- [ ] Playground e2e green against packed tarballs (verdaccio/local
      registry, not workspace links)
- [ ] Perf anchors re-measured and README table current

---

## Parked (post-launch backlog)

- **Tier 2 dispatch bypass** (beat Elysia): native `Bun.serve` route table +
  Sucrose-style codegen behind a flag. Full spec: `HOT_PATH_PERF_PLAN.md`
  §3 at commit `bc3594d`. Trigger: real users hitting throughput ceilings,
  or benchmarks costing adoption.
- Diject optimizations: lazy store values, `run()` fast path, sync
  `hasRequestScope()`, per-get alias-check alloc — full agent-executable
  plan at `c:/Users/hdevlop/Desktop/diject/DIJECT_OPT_PLAN.md`.
- Full OpenTelemetry exporter package (the `metrics()` `onRequest` hook is
  the seam).
- NestJS/Elysia rows in a public benchmarks CI job.
