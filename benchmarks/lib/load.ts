// ============================================================================
// load.ts — dependency-free HTTP load driver
//
// A small, reproducible closed-loop load generator: N virtual clients each
// fire requests back-to-back for `duration` ms. Reports throughput and latency
// percentiles. No external deps (autocannon/k6) so `bun benchmarks/*.ts` runs
// anywhere Bun does.
// ============================================================================

export interface LoadOptions {
   url: string;
   /** Concurrent virtual clients (closed-loop). Default 50. */
   connections?: number;
   /** Test duration in milliseconds. Default 5000. */
   duration?: number;
   /** Warmup duration in milliseconds (not measured). Default 500. */
   warmup?: number;
   init?: RequestInit;
}

export interface LoadResult {
   requests: number;
   errors: number;
   durationMs: number;
   rps: number;
   latency: { p50: number; p90: number; p99: number; max: number; mean: number };
}

function percentile(sorted: number[], p: number): number {
   if (sorted.length === 0) return 0;
   const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
   return sorted[idx];
}

export async function runLoad(opts: LoadOptions): Promise<LoadResult> {
   const connections = opts.connections ?? 50;
   const duration = opts.duration ?? 5000;
   const warmup = opts.warmup ?? 500;

   const latencies: number[] = [];
   let requests = 0;
   let errors = 0;
   let measuring = false;
   let stop = false;

   async function client() {
      while (!stop) {
         const start = performance.now();
         try {
            const res = await fetch(opts.url, opts.init);
            await res.arrayBuffer(); // drain body
            const elapsed = performance.now() - start;
            if (measuring) {
               if (res.ok) {
                  latencies.push(elapsed);
                  requests++;
               } else {
                  errors++;
               }
            }
         } catch {
            if (measuring) errors++;
         }
      }
   }

   const clients = Array.from({ length: connections }, () => client());

   await new Promise((r) => setTimeout(r, warmup));
   measuring = true;
   const measureStart = performance.now();
   await new Promise((r) => setTimeout(r, duration));
   const measuredMs = performance.now() - measureStart;
   measuring = false;
   stop = true;
   await Promise.all(clients);

   latencies.sort((a, b) => a - b);
   const mean = latencies.reduce((s, v) => s + v, 0) / (latencies.length || 1);

   return {
      requests,
      errors,
      durationMs: measuredMs,
      rps: requests / (measuredMs / 1000),
      latency: {
         p50: percentile(latencies, 50),
         p90: percentile(latencies, 90),
         p99: percentile(latencies, 99),
         max: latencies[latencies.length - 1] ?? 0,
         mean,
      },
   };
}

export function printResult(name: string, r: LoadResult): void {
   const f = (n: number) => n.toFixed(2);
   console.log(
      `${name.padEnd(22)} ${f(r.rps).padStart(10)} req/s  ` +
      `p50=${f(r.latency.p50)}ms  p90=${f(r.latency.p90)}ms  p99=${f(r.latency.p99)}ms  ` +
      `err=${r.errors}`,
   );
}
