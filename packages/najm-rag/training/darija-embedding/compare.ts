/**
 * Scores each embedding model on the main routing set and the Darija sets.
 * Models whose name contains `-st-` are read only from the benchmark cache
 * (embedded in Colab); others are called through Ollama.
 *
 *   bun packages/najm-rag/training/darija-embedding/compare.ts
 *   bun packages/najm-rag/training/darija-embedding/compare.ts embeddinggemma-st-base embeddinggemma-st-darija
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DARIJA_SETS } from './prepare-sets';

const ROOT = resolve(import.meta.dir, '../../../..');
const BENCH = join(ROOT, 'apps/playground/bench/routing');
const BENCHMARK = join(ROOT, 'packages/najm-rag/scripts/routing-benchmark.ts');
const models = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['embeddinggemma', 'embeddinggemma-st-base', 'embeddinggemma-st-darija'];

function run(model: string, extra: string[]): string {
  const offline = model.includes('-st-');
  const res = spawnSync('bun', [BENCHMARK, '--model', model, ...(offline ? ['--offline'] : []), ...extra], { encoding: 'utf8' });
  if (res.status !== 0) return `failed: ${(res.stderr || res.stdout).trim().split('\n').slice(-1)[0]}`;
  return res.stdout;
}

for (const model of models) {
  const cache = join(BENCH, '.cache', `embeddings-${model.replace(/[^a-z0-9.-]/gi, '_')}.json`);
  if (model.includes('-st-') && !existsSync(cache)) {
    console.log(`\n${model}: no cache at ${cache}; copy the Colab output there`);
    continue;
  }
  console.log(`\n== ${model}`);
  const main = run(model, []);
  const lines = main.split('\n');
  const at = lines.findIndex((l) => l.startsWith('playground'));
  console.log(at >= 0 ? `  main set: ${lines[at + 1].trim()}\n            ${lines[at + 2].trim()}` : `  main set: ${main.trim()}`);
  for (const set of DARIJA_SETS) {
    const out = run(model, ['--darija', '--cases', set, '--combo', '{}']);
    const line = out.split('\n').find((l) => l.startsWith('combo')) ?? out.trim();
    console.log(`  ${set.replace(/^cases-|\.json$/g, '').padEnd(15)} ${line.replace(/^combo: \{\}\s*/, '')}`);
  }
}
