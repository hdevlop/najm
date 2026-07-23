// ============================================================================
// hotpath.bench.ts — in-process request dispatch micro-benchmark
//
// Calls `server.fetch(request)` in a tight loop (no sockets, no network) to
// isolate framework overhead from the OS/HTTP layer. This is the regression
// guard for Phase 7.2: route dispatch, param resolution, and the ALS store
// spread per request.
//
//   bun benchmarks/hotpath.bench.ts
//   bun benchmarks/hotpath.bench.ts --iterations 200000
// ============================================================================

import 'reflect-metadata';
import { Hono } from 'hono';
import { Body, Controller, Get, Params, Post, Query, Server } from 'najm-core';

function arg(name: string, fallback: number): number {
   const i = process.argv.indexOf(`--${name}`);
   return i >= 0 ? Number(process.argv[i + 1]) : fallback;
}

const ITERATIONS = arg('iterations', 100_000);
const WARMUP = Math.min(10_000, Math.floor(ITERATIONS / 10));

type Handler = (req: Request) => Response | Promise<Response>;

async function bench(name: string, fetch: Handler, makeReq: () => Request): Promise<number> {
   // Warmup so the JIT settles before we measure.
   for (let i = 0; i < WARMUP; i++) await fetch(makeReq());

   const start = performance.now();
   for (let i = 0; i < ITERATIONS; i++) await fetch(makeReq());
   const elapsed = performance.now() - start;

   const opsPerSec = ITERATIONS / (elapsed / 1000);
   console.log(
      `${name.padEnd(28)} ${opsPerSec.toFixed(0).padStart(10)} ops/s  ` +
      `${(elapsed / ITERATIONS * 1000).toFixed(2)} µs/op`,
   );
   return opsPerSec;
}

// ---------------------------------------------------------------------------
// Raw Hono baseline
// ---------------------------------------------------------------------------

function rawHono(): Handler {
   const app = new Hono();
   app.get('/users/:id', (c) => c.json({ id: c.req.param('id') }));
   return (req) => app.fetch(req);
}

// ---------------------------------------------------------------------------
// najm: plain route, param route, and body+query route
// ---------------------------------------------------------------------------

@Controller('/')
class HotController {
   @Get('/json')
   json() {
      return { ok: true, id: 42 };
   }

   @Get('/users/:id')
   user(@Params('id') id: string) {
      return { id };
   }

   @Post('/search/:id')
   search(@Params('id') id: string, @Query('q') q: string, @Body() body: unknown) {
      return { id, q, body };
   }
}

async function main() {
   console.log(
      `\nHot-path dispatch — ${ITERATIONS.toLocaleString()} iterations ` +
      `(runtime: ${typeof Bun !== 'undefined' ? `bun ${Bun.version}` : `node ${process.version}`})\n`,
   );

   const najm = new Server({ isolated: true, silent: true }).load(HotController);
   await najm.init();
   const najmFetch: Handler = (req) => najm.fetch(req);

   const origin = 'http://localhost';
   const honoRps = await bench('raw-hono /users/:id', rawHono(), () => new Request(`${origin}/users/123`));
   await bench('najm /json (no params)', najmFetch, () => new Request(`${origin}/json`));
   const najmRps = await bench('najm /users/:id', najmFetch, () => new Request(`${origin}/users/123`));
   await bench('najm /search (body+query)', najmFetch, () =>
      new Request(`${origin}/search/1?q=x`, {
         method: 'POST',
         headers: { 'content-type': 'application/json' },
         body: JSON.stringify({ term: 'najm' }),
      }),
   );

   console.log(
      `\nnajm param dispatch is ${(najmRps / honoRps * 100).toFixed(1)}% of raw Hono ` +
      `(overhead = DI resolution + middleware chain + param resolution + response formatting).\n`,
   );

   await najm.stop();
}

main().catch((err) => {
   console.error(err);
   process.exit(1);
});
