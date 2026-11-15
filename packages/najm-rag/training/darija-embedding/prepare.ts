/**
 * Writes work/colab-input.json for the Colab notebook:
 *   inputs  — every text the routing benchmark embeds on the comparison sets,
 *             prompts included, so Colab can embed them with any model;
 *   exclude — every benchmark test message, kept out of the training data.
 *
 *   bun packages/najm-rag/training/darija-embedding/prepare.ts
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DARIJA_SETS } from './prepare-sets';

const HERE = import.meta.dir;
const ROOT = resolve(HERE, '../../../..');
const BENCH = join(ROOT, 'apps/playground/bench/routing');
const BENCHMARK = join(ROOT, 'packages/najm-rag/scripts/routing-benchmark.ts');

const work = join(HERE, 'work');
mkdirSync(work, { recursive: true });
const dumpFile = join(work, 'inputs.tmp.json');
rmSync(dumpFile, { force: true });

const runs: string[][] = [
  [],                                              // main set, every variant
  ...DARIJA_SETS.map((set) => ['--darija', '--cases', set, '--combo', '{}']),
];
for (const extra of runs) {
  const res = spawnSync('bun', [BENCHMARK, ...extra], { env: { ...process.env, DUMP_INPUTS: dumpFile }, encoding: 'utf8' });
  if (res.status !== 0) throw new Error(`benchmark ${extra.join(' ') || '(main)'} failed:\n${res.stderr}`);
}
const inputs: string[] = JSON.parse(readFileSync(dumpFile, 'utf8'));
rmSync(dumpFile);

const exclude = new Set<string>();
for (const file of readdirSync(BENCH).filter((f) => /^cases.*\.json$/.test(f))) {
  for (const c of JSON.parse(readFileSync(join(BENCH, file), 'utf8')).cases) {
    for (const text of [c.query, ...(c.history ?? [])]) exclude.add(text);
  }
}

const out = join(work, 'colab-input.json');
writeFileSync(out, JSON.stringify({ createdAt: new Date().toISOString(), inputs, exclude: [...exclude] }));
console.log(`${inputs.length} texts to embed, ${exclude.size} test messages to exclude`);
console.log(`wrote ${out}${existsSync(out) ? '' : ' (missing!)'}`);
