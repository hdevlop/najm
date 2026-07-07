// ============================================================================
// frameworks.bench.ts — najm vs peer frameworks (competitive positioning)
//
// Runs each framework as its own subprocess on the SAME runtime (Bun), so the
// comparison isolates framework overhead with the runtime held constant. Each
// server binds a random port and prints `READY <port>`; the orchestrator then
// drives it with the shared closed-loop load generator.
//
//   bun benchmarks/frameworks.bench.ts
//   bun benchmarks/frameworks.bench.ts --duration 10000 --connections 100
//
// A framework that fails to boot is reported as "n/a" and never aborts the run.
// ============================================================================

import { runLoad, type LoadResult } from './lib/load';

function arg(name: string, fallback: number): number {
   const i = process.argv.indexOf(`--${name}`);
   return i >= 0 ? Number(process.argv[i + 1]) : fallback;
}

const DURATION = arg('duration', 5000);
const CONNECTIONS = arg('connections', 50);
const HERE = import.meta.dir;

interface Target {
   name: string;
   file: string;
}

// Order: raw floor first, then peers, then najm — easy to read the ratios.
const TARGETS: Target[] = [
   { name: 'raw-hono', file: 'frameworks/servers/hono.ts' },
   { name: 'elysia', file: 'frameworks/servers/elysia.ts' },
   { name: 'fastify', file: 'frameworks/servers/fastify.ts' },
   { name: 'nestjs', file: 'frameworks/servers/nest.ts' },
   { name: 'najm', file: 'frameworks/servers/najm.ts' },
];

interface Row {
   name: string;
   ok: boolean;
   coldStartMs?: number;
   rssMb?: number;
   json?: LoadResult;
   param?: LoadResult;
   note?: string;
}

async function readUntilReady(proc: ReturnType<typeof Bun.spawn>): Promise<number> {
   const reader = proc.stdout.getReader();
   const decoder = new TextDecoder();
   let buffer = '';
   while (true) {
      const { value, done } = await reader.read();
      if (done) throw new Error('process exited before READY');
      buffer += decoder.decode(value, { stream: true });
      const match = buffer.match(/READY\s+(\d+)/);
      if (match) {
         reader.releaseLock();
         return Number(match[1]);
      }
   }
}

async function startServer(file: string, timeoutMs = 20000) {
   const startedAt = performance.now();
   const proc = Bun.spawn(['bun', 'run', file], {
      cwd: HERE,
      env: process.env,
      stdout: 'pipe',
      stderr: 'pipe',
   });

   let port: number;
   try {
      port = await Promise.race([
         readUntilReady(proc),
         new Promise<number>((_, reject) =>
            setTimeout(() => reject(new Error(`did not become ready within ${timeoutMs}ms`)), timeoutMs),
         ),
      ]);
   } catch (err) {
      proc.kill();
      const stderr = await new Response(proc.stderr).text().catch(() => '');
      throw new Error(`${(err as Error).message}${stderr ? `\n  ${stderr.trim().split('\n').slice(-3).join('\n  ')}` : ''}`);
   }

   return { proc, port, coldStartMs: performance.now() - startedAt };
}

async function stopServer(proc: ReturnType<typeof Bun.spawn>) {
   proc.kill();
   await proc.exited.catch(() => {});
}

async function fetchRss(port: number): Promise<number | undefined> {
   try {
      const res = await fetch(`http://localhost:${port}/__rss`);
      const body = (await res.json()) as { rss?: number };
      return body.rss ? body.rss / (1024 * 1024) : undefined;
   } catch {
      return undefined;
   }
}

async function benchTarget(target: Target): Promise<Row> {
   let handle: Awaited<ReturnType<typeof startServer>> | undefined;
   try {
      handle = await startServer(target.file);
   } catch (err) {
      return { name: target.name, ok: false, note: (err as Error).message };
   }

   try {
      const base = `http://localhost:${handle.port}`;
      const json = await runLoad({ url: `${base}/json`, connections: CONNECTIONS, duration: DURATION });
      const param = await runLoad({ url: `${base}/users/123`, connections: CONNECTIONS, duration: DURATION });
      const rssMb = await fetchRss(handle.port);
      return { name: target.name, ok: true, coldStartMs: handle.coldStartMs, rssMb, json, param };
   } finally {
      await stopServer(handle.proc);
   }
}

/**
 * Warm the load generator (this process) before measuring anything, so the
 * first framework in the list isn't penalised by the parent's cold fetch/JSON
 * JIT. Hammers a throwaway in-process server and discards the result.
 */
async function primeGenerator() {
   const server = Bun.serve({
      port: 0,
      fetch: () =>
         new Response(JSON.stringify({ ok: true }), {
            headers: { 'content-type': 'application/json' },
         }),
   });
   await runLoad({
      url: `http://localhost:${server.port}/`,
      connections: CONNECTIONS,
      duration: 1000,
      warmup: 200,
   });
   server.stop();
}

function fmt(n: number | undefined, digits = 0): string {
   return n === undefined ? '—' : n.toFixed(digits);
}

function printTable(rows: Row[]) {
   const baseline = rows.find((r) => r.name === 'raw-hono' && r.ok)?.json?.rps;

   const header = [
      'framework'.padEnd(10),
      '/json req/s'.padStart(12),
      'p99 ms'.padStart(8),
      '/:id req/s'.padStart(11),
      'cold ms'.padStart(9),
      'rss MB'.padStart(8),
      'vs hono'.padStart(9),
   ].join('  ');
   console.log('\n' + header);
   console.log('-'.repeat(header.length));

   for (const r of rows) {
      if (!r.ok) {
         console.log(`${r.name.padEnd(10)}  ${'FAILED — ' + (r.note ?? 'unknown')}`);
         continue;
      }
      const vs = baseline && r.json ? `${((r.json.rps / baseline) * 100).toFixed(0)}%` : '—';
      console.log(
         [
            r.name.padEnd(10),
            fmt(r.json?.rps).padStart(12),
            fmt(r.json?.latency.p99, 2).padStart(8),
            fmt(r.param?.rps).padStart(11),
            fmt(r.coldStartMs).padStart(9),
            fmt(r.rssMb, 1).padStart(8),
            vs.padStart(9),
         ].join('  '),
      );
   }
}

async function main() {
   console.log(
      `\nFramework comparison — ${CONNECTIONS} connections × ${DURATION}ms per route, ` +
      `runtime held constant at bun ${Bun.version}\n` +
      `(raw Hono = floor; ratios are framework overhead with runtime fixed)`,
   );

   process.stdout.write('\nwarming load generator … ');
   await primeGenerator();
   process.stdout.write('done');

   const rows: Row[] = [];
   for (const target of TARGETS) {
      process.stdout.write(`\n▶ ${target.name} … `);
      const row = await benchTarget(target);
      process.stdout.write(row.ok ? 'done' : `failed (${row.note?.split('\n')[0]})`);
      rows.push(row);
   }

   printTable(rows);
   console.log('\nNote: all frameworks run on Bun to isolate framework overhead. For a');
   console.log('Node-deployment comparison, run each server under Node + an external');
   console.log('load tool (autocannon/k6) — see benchmarks/README.md.\n');
}

main().catch((err) => {
   console.error(err);
   process.exit(1);
});
