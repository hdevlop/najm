// ============================================================================
// http.bench.ts — end-to-end HTTP throughput: najm vs raw Hono
//
// Boots each server on a real port, drives it with the closed-loop load
// generator, and prints req/s + latency percentiles. najm carries the full
// stack (DI, middleware, param resolution, response formatting); raw Hono is
// the floor. The gap is the framework's per-request overhead — report it
// honestly.
//
//   bun benchmarks/http.bench.ts
//   bun benchmarks/http.bench.ts --duration 10000 --connections 100
// ============================================================================

import 'reflect-metadata';
import { Hono } from 'hono';
import { Controller, Get, Server } from 'najm-core';
import { runLoad, printResult } from './lib/load';

function arg(name: string, fallback: number): number {
   const i = process.argv.indexOf(`--${name}`);
   return i >= 0 ? Number(process.argv[i + 1]) : fallback;
}

const DURATION = arg('duration', 5000);
const CONNECTIONS = arg('connections', 50);

// ---------------------------------------------------------------------------
// Raw Hono baseline
// ---------------------------------------------------------------------------

function rawHono(): Hono {
   const app = new Hono();
   app.get('/json', (c) => c.json({ ok: true, id: 42 }));
   app.get('/users/:id', (c) => c.json({ id: c.req.param('id') }));
   return app;
}

// ---------------------------------------------------------------------------
// najm equivalent
// ---------------------------------------------------------------------------

@Controller('/')
class BenchController {
   @Get('/json')
   json() {
      return { ok: true, id: 42 };
   }

   @Get('/users/:id')
   user(): unknown {
      return { id: 'x' };
   }
}

async function main() {
   console.log(
      `\nHTTP throughput — ${CONNECTIONS} connections × ${DURATION}ms ` +
      `(runtime: ${typeof Bun !== 'undefined' ? `bun ${Bun.version}` : `node ${process.version}`})\n`,
   );

   // --- Raw Hono ---
   const honoServer = Bun.serve({ fetch: rawHono().fetch, port: 0 });
   const honoBase = `http://localhost:${honoServer.port}`;
   const honoJson = await runLoad({ url: `${honoBase}/json`, connections: CONNECTIONS, duration: DURATION });
   printResult('raw-hono /json', honoJson);
   honoServer.stop();

   // --- najm ---
   const najm = new Server({ isolated: true, silent: true }).load(BenchController);
   await najm.listen(0);
   const najmBase = `http://localhost:${najm.port}`;
   const najmJson = await runLoad({ url: `${najmBase}/json`, connections: CONNECTIONS, duration: DURATION });
   printResult('najm /json', najmJson);
   const najmParam = await runLoad({ url: `${najmBase}/users/123`, connections: CONNECTIONS, duration: DURATION });
   printResult('najm /users/:id', najmParam);
   await najm.stop();

   // --- Summary ---
   const overhead = ((honoJson.rps - najmJson.rps) / honoJson.rps) * 100;
   console.log(
      `\nnajm /json is ${(najmJson.rps / honoJson.rps * 100).toFixed(1)}% of raw Hono ` +
      `(${overhead.toFixed(1)}% overhead for DI + middleware + param resolution + response formatting)\n`,
   );
}

main().catch((err) => {
   console.error(err);
   process.exit(1);
});
