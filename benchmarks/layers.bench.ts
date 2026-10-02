// ============================================================================
// layers.bench.ts — where do najm's µs/request go?
//
// Rebuilds najm's request pipeline on raw Hono one layer at a time, then runs
// the real thing. Layer E mirrors MiddlewareService's request-context
// middleware, so `najm /plain` should land within noise of E; if it does not,
// this file has drifted from the framework and the deltas are not to be
// trusted.
//
//   bun benchmarks/layers.bench.ts
//   bun benchmarks/layers.bench.ts --iterations 200000
// ============================================================================

import 'reflect-metadata';
import { Hono, type Context, type Next } from 'hono';
import { Container } from 'diject';
import { Body, Controller, Get, Params, Post, Query, Server } from 'najm-core';

function arg(name: string, fallback: number): number {
   const i = process.argv.indexOf(`--${name}`);
   return i >= 0 ? Number(process.argv[i + 1]) : fallback;
}

const ITER = arg('iterations', 100_000);
const WARM = Math.min(10_000, Math.floor(ITER / 10));

type H = (req: Request) => Response | Promise<Response>;

async function bench(name: string, fetch: H, makeReq: () => Request): Promise<number> {
   for (let i = 0; i < WARM; i++) await fetch(makeReq());
   const t0 = performance.now();
   for (let i = 0; i < ITER; i++) await fetch(makeReq());
   const us = ((performance.now() - t0) / ITER) * 1000;
   console.log(`${name.padEnd(44)} ${us.toFixed(2).padStart(7)} µs/op`);
   return us;
}

const HEADER = 'x-request-id';
let seq = 0;
const fastId = () => `${process.pid.toString(36)}-${(seq++).toString(36)}`;

function withUserRoute(app: Hono): Hono {
   app.get('/users/:id', (c) => c.json({ id: c.req.param('id') }));
   return app;
}

function echoRequestId(context: Context, requestId: string): void {
   const headers = context.res.headers;
   if (!headers.has(HEADER)) headers.set(HEADER, requestId);
}

// A. raw hono
const a = withUserRoute(new Hono({ strict: false }));

// B. + one async global middleware (Hono compose instead of the direct path)
const b = new Hono({ strict: false });
b.use('*', async (_c, next) => { await next(); });
withUserRoute(b);

// C. + request id: read or generate, echo on the final response
const c = new Hono({ strict: false });
c.use('*', async (context, next) => {
   const requestId = context.req.header(HEADER) || fastId();
   await next();
   echoRequestId(context, requestId);
});
withUserRoute(c);

// D. + container.run (the per-request AsyncLocalStorage store)
const containerD = new Container();
const d = new Hono({ strict: false });
d.use('*', async (context, next) => {
   const requestId = context.req.header(HEADER) || fastId();
   return containerD.run({ requestId, context }, async () => {
      await next();
      echoRequestId(context, requestId);
   });
});
withUserRoute(d);

// E. + request-scope cleanup and request-cache eviction in `finally`
const containerE = new Container();
const parserCache = new WeakMap<Context, unknown>();
const requestCache = new WeakMap<Context, unknown>();
const e = new Hono({ strict: false });
e.use('*', async (context: Context, next: Next) => {
   const requestId = context.req.header(HEADER) || fastId();
   return containerE.run({ requestId, context }, async () => {
      try {
         await next();
         echoRequestId(context, requestId);
      } finally {
         try {
            if (containerE.hasRequestScope(requestId)) await containerE.cleanupReq(requestId);
         } finally {
            parserCache.delete(context);
            requestCache.delete(context);
         }
      }
   });
});
withUserRoute(e);

// Raw hono equivalent of najm's POST /search route
const rawSearch = new Hono({ strict: false });
rawSearch.post('/search/:id', async (ctx) => ctx.json({
   id: ctx.req.param('id'),
   q: ctx.req.query('q'),
   body: await ctx.req.json(),
}));

// F/G/T. full najm
@Controller('/')
class LayersController {
   @Get('/plain')
   plain() {
      return { ok: true };
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

const najm = new Server({ isolated: true, silent: true }).load(LayersController);
await najm.init();
const najmFetch: H = (req) => najm.fetch(req);

const userReq = () => new Request('http://localhost/users/123');
const searchReq = () => new Request('http://localhost/search/1?q=x', {
   method: 'POST',
   headers: { 'content-type': 'application/json' },
   body: JSON.stringify({ term: 'najm' }),
});

console.log(`\nLayer breakdown — ${ITER.toLocaleString()} iterations, bun ${Bun.version}\n`);
const va = await bench('A raw hono', (r) => a.fetch(r), userReq);
const vb = await bench('B + async global middleware', (r) => b.fetch(r), userReq);
const vc = await bench('C + request id read/echo', (r) => c.fetch(r), userReq);
const vd = await bench('D + container.run (ALS)', (r) => d.fetch(r), userReq);
const ve = await bench('E + finally cleanup (= najm request context)', (r) => e.fetch(r), userReq);
const vf = await bench('F najm /plain', najmFetch, () => new Request('http://localhost/plain'));
const vg = await bench('G najm /users/:id', najmFetch, userReq);
const vs = await bench('S raw hono POST body+query+param', (r) => rawSearch.fetch(r), searchReq);
const vt = await bench('T najm POST body+query+param', najmFetch, searchReq);

const delta = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(2)} µs`;
console.log('\nCost of each layer (GET /users/:id):');
console.log(`  Hono compose (1 async mw):   ${delta(vb - va)}`);
console.log(`  request id read/echo:        ${delta(vc - vb)}`);
console.log(`  ALS container.run:           ${delta(vd - vc)}`);
console.log(`  finally cleanup:             ${delta(ve - vd)}`);
console.log(`  najm dispatch + params:      ${delta(vg - ve)}`);
console.log(`  najm total vs raw hono:      ${delta(vg - va)}`);
console.log(`\n  model check (najm /plain - E): ${delta(vf - ve)}  (should be within noise)`);
console.log(`  POST body route vs raw hono:   ${delta(vt - vs)}\n`);

await najm.stop();
