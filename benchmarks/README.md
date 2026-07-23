# Benchmarks

Reproducible performance benchmarks for the najm framework. These back the
performance claims in the README and act as the regression guard for the
framework's hot path (route dispatch, param resolution, response formatting,
and the per-request AsyncLocalStorage store).

> **Honesty policy.** najm is a batteries-included framework layered on Hono.
> It will never beat *raw* Hono — every request pays for DI resolution, the
> middleware chain, decorator-driven param resolution, and response wrapping.
> The point of these benchmarks is to measure that overhead and keep it from
> regressing, not to hide it. Report the raw-Hono baseline alongside najm.

## Running

Requires the workspace to be built first (benchmarks import the built
`najm-core`):

```bash
bun run build:core        # from the repo root
```

Then, from the repo root:

```bash
# End-to-end HTTP throughput (real sockets): najm vs raw Hono
bun benchmarks/http.bench.ts
bun benchmarks/http.bench.ts --duration 10000 --connections 100

# In-process dispatch micro-benchmark (no sockets): isolates framework overhead
bun benchmarks/hotpath.bench.ts
bun benchmarks/hotpath.bench.ts --iterations 200000

# Competitive comparison: najm vs Elysia, Fastify, NestJS, raw Hono
bun benchmarks/frameworks.bench.ts
bun benchmarks/frameworks.bench.ts --duration 10000 --connections 100
```

Or via the root scripts:

```bash
bun run bench            # http.bench.ts
bun run bench:hotpath    # hotpath.bench.ts
bun run bench:frameworks # frameworks.bench.ts (needs the peer deps installed)
```

> The framework comparison needs the peer frameworks installed (`elysia`,
> `fastify`, `@nestjs/*`) — they are dev-dependencies of the `benchmarks`
> workspace, pulled in by `bun install` at the repo root. Any framework that
> fails to boot is reported as `FAILED` and never aborts the run.

To protect the Node fallback story, also measure a server started under Node.
The bench scripts are written for Bun; for Node, boot the playground (or any
app) with `@hono/node-server` and point an external HTTP client at it:

```bash
# terminal 1 — run an app under Node
node your-app.mjs
# terminal 2 — drive it with a standard tool
autocannon -c 100 -d 10 http://localhost:3000/json
```

## What each benchmark measures

| File | Isolates | Use it to answer |
| --- | --- | --- |
| `http.bench.ts` | Full stack incl. OS/HTTP, sockets, JSON serialization | "What throughput will users actually see?" |
| `hotpath.bench.ts` | Framework overhead only (`server.fetch()` in a loop, no network) | "Did a change regress dispatch/param resolution?" |
| `frameworks.bench.ts` | najm vs peer frameworks, runtime held constant | "Why pick najm over Elysia/Fastify/NestJS?" |
| `lib/load.ts` | — | Shared closed-loop load generator (no external deps) |
| `frameworks/servers/*` | — | One tiny server per framework, same two routes |

`hotpath.bench.ts` is the sensitive one for regression detection: because it
removes socket and kernel noise, a change that adds work per request (e.g. an
extra store spread or an always-on middleware) shows up as a clear ops/s drop.

## Latest Local Results

Measured on 2026-07-07 with Bun 1.3.14 on Windows x64 after the Tier 1 hot-path
passes. Treat these as local regression anchors, not portable headline numbers.

### Layer Breakdown

`bun benchmarks/layers.bench.ts`

| Route | Baseline | Latest | Change |
| --- | ---: | ---: | ---: |
| `najm /plain` | 28.1 us/op | 9.34 us/op | 3.0x faster |
| `najm /users/:id` | 53.9 us/op | 10.32 us/op | 5.2x faster |

#### diject 0.1.6 hot-path pass (2026-07-08)

Adopted `diject@0.1.6` (run() no-parent fast path, alias/get lookup collapse,
`hasRequestScope()` cleanup early-out). Measured as a same-machine A/B against
`diject@0.1.5`, best-of-3 — the machine ran hotter this session, so absolute
µs are inflated vs the 2026-07-07 anchor above; the **A/B delta** is the signal,
not the absolutes.

| Metric (best-of-3) | 0.1.5 | 0.1.6 | Change |
| --- | ---: | ---: | ---: |
| Layer D (parser + container.run + cleanup) | 19.77 us/op | 17.15 us/op | 13% faster |
| `najm /plain` | 12.16 us/op | 11.22 us/op | 8% faster |
| `najm /users/:id` | 14.27 us/op | 12.24 us/op | 14% faster |

Cross-repo verification also green: 6 najm suites (najm-core/rate/validation/
guard/cookies/auth) = 179 tests, 0 failures against the published 0.1.6.

### Framework Comparison

`bun run bench:frameworks` (50 connections, 5000ms per route)

| Framework | `/json` req/s | `/users/:id` req/s | Cold start | RSS |
| --- | ---: | ---: | ---: | ---: |
| Fastify | 23,953 | 22,574 | 312 ms | 156.5 MB |
| Najm | 24,768 | 23,211 | 122 ms | 85.4 MB |
| NestJS | 18,325 | 16,009 | 654 ms | 158.1 MB |

Najm cleared the Tier 1 gate against Fastify in this run while keeping much
lower cold start and RSS. The raw-Hono row in the same Windows/Bun
self-contained load-driver run was unstable; keep raw-Hono visible when
benchmarking, but cross-check with an external client before publishing
raw-Hono ratios.

### The framework comparison (`frameworks.bench.ts`)

Each framework runs as its **own subprocess on the same runtime (Bun)**, binds a
random port, and serves the identical route contract (`GET /json`,
`GET /users/:id`). The orchestrator boots it, waits for `READY <port>`, drives
it with the shared load generator, records **cold start** (spawn → listening)
and **RSS**, then kills it.

Holding the runtime constant is deliberate: it isolates *framework* overhead. It
does **not** answer "how does najm's Node fallback compare to Fastify on Node" —
that is a runtime-vs-runtime question; use the external-tool recipe above with
each server launched under Node.

najm is a batteries-included framework (DI, guards, decorator param
resolution), so raw Hono and AOT/native routers remain the ceiling. After the
Tier 1 hot-path work it can compete with Fastify on these small routes while
keeping stronger cold-start and memory numbers. Its wins to highlight are
**cold start**, **memory footprint**, and DX; do not claim a raw-router crown
without external-client confirmation.

## Methodology

- **Closed-loop load** — `connections` virtual clients each fire requests
  back-to-back for `duration` ms; there is a short warmup that is not measured.
- **Latency percentiles** — p50/p90/p99 computed from per-request wall time.
- **Warmup** — the micro-benchmark warms the JIT (10% of iterations) before
  timing. `frameworks.bench.ts` additionally **primes the load generator**
  against a throwaway server before the first framework, so target ordering
  doesn't penalise whoever runs first (the parent's `fetch`/JSON JIT is hot for
  everyone).
- **Baseline first** — every run prints raw Hono so the overhead ratio is
  visible in the same output.
- **Isolation** — each framework runs in its own process, so one framework's
  GC/allocation never contaminates another's measurement.

## Interpreting results

- Compare **ratios**, not absolute numbers — absolute req/s depends heavily on
  the machine, runtime version, and background load.
- Watch **p99**, not just mean — tail latency is where per-request allocation
  and GC pressure surface.
- A regression is a *relative* drop vs. the raw-Hono baseline in the same run,
  or vs. a previously recorded ratio on the same machine.

## Caveats

- Numbers are **not** portable across machines; record the machine + runtime
  version next to any published figure.
- The self-contained load driver is deliberately simple. For publishable
  headline numbers, cross-check with `autocannon`/`k6`/`bombardier` against the
  same routes — they use a real HTTP client pool and are the community-standard
  reference.
- These benches cover core dispatch. Plugin-specific costs (auth, storage,
  transactions) should be measured with their own scenarios before being
  quoted.
