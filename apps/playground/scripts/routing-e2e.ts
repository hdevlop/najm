/**
 * End-to-end routing check on the real playground stack: SQLite with
 * sqlite-vec, the tool indexer, the semantics import, "reindex semantics" and
 * the chat router, against a live Ollama model. It runs on a copy of the
 * database (or a fresh path), never on playground.db itself.
 *
 *   bun scripts/routing-e2e.ts [--db <copy path>] [--from <source db>]
 *
 * Prints the upgrade path (stale phrases before and after a reindex) and the
 * benchmark cases' results, in the same terms as
 * packages/najm-rag/scripts/routing-benchmark.ts.
 */
import 'reflect-metadata';
import { copyFileSync, existsSync, readFileSync, rmSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';

const args = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const here = import.meta.dirname;
const source = resolve(arg('from', resolve(here, '../playground.db')));
const target = resolve(arg('db', resolve(tmpdir(), `playground-routing-e2e-${process.pid}.db`)));
if (target === source) throw new Error('Refusing to run on the source database; pass a copy path.');
if (existsSync(target)) rmSync(target);
copyFileSync(source, target);
process.env.DATABASE_URL = target; // read when the database config is imported

// The playground's own wiring, so this checks what the app runs.
const { server } = await import('../src/server/index');
const { SemanticPhraseService, ToolRouterService, ToolIndexerService } = await import('najm-rag');

await server.listen(0);
const step = (label: string, value: unknown) => console.log(`${label.padEnd(34)} ${typeof value === 'string' ? value : JSON.stringify(value)}`);

try {
  const phrases = await server.container.resolve(SemanticPhraseService);
  const indexer = await server.container.resolve(ToolIndexerService);
  const router = await server.container.resolve(ToolRouterService);
  console.log(`database copy ${target}\n`);

  const before = await phrases.getStatus();
  step('before: phrases / stale', `${before.semanticPhraseCount} / ${before.staleSemanticCount}`);
  step('embedder', `${before.embeddingModel}, threshold ${before.effectiveSettings?.similarityThreshold ?? '?'}`);

  step('index tools', await indexer.indexTools());

  const seed = JSON.parse(readFileSync(resolve(here, '../src/server/config/chatbot/semantics.json'), 'utf8'));
  const imported = await phrases.importSemantics(seed);
  const tally: Record<string, number> = {};
  for (const r of imported.results) tally[r.status] = (tally[r.status] ?? 0) + 1;
  step('import semantics.json', tally);
  const errors = imported.results.filter((r: any) => r.error);
  if (errors.length) step('import errors', errors.slice(0, 3).map((e: any) => e.error));

  const mid = await phrases.getStatus();
  step('after import: phrases / stale', `${mid.semanticPhraseCount} / ${mid.staleSemanticCount}`);
  step('reindex semantics', await phrases.reindexSemantics());
  const after = await phrases.getStatus();
  step('after reindex: phrases / stale', `${after.semanticPhraseCount} / ${after.staleSemanticCount}`);
  step('second reindex (expect none)', await phrases.reindexSemantics());

  const { cases } = JSON.parse(readFileSync(resolve(here, '../bench/routing/cases.json'), 'utf8'));
  let primary = 0, positives = 0, falsePositives = 0, errorsCount = 0, wrongWrites = 0;
  const byLang: Record<string, { ok: number; n: number }> = {};
  const wrong: string[] = [];
  for (const c of cases) {
    const routingText = [...(c.history ?? []), c.query].slice(-3).join('\n---\n');
    const result = await router.findRelevantTools(routingText, { latestUserText: c.query });
    const names = result.tools.map((t: any) => t.name);
    if (result.status === 'router_error') errorsCount++;
    // A write tool first that the message did not ask for.
    if (result.tools[0] && names[0] !== c.expected[0] && result.tools[0].annotations?.readOnlyHint !== true) wrongWrites++;
    if (c.expected.length === 0) {
      if (names.length > 0) { falsePositives++; wrong.push(`  small talk "${c.query}" → ${names[0]}`); }
      continue;
    }
    positives++;
    const ok = names[0] === c.expected[0];
    if (ok) primary++;
    else wrong.push(`  ${c.lang.padEnd(12)} "${c.query}" want ${c.expected[0]}, got ${names[0] ?? 'none'}`);
    const g = (byLang[c.lang] ??= { ok: 0, n: 0 });
    g.n++;
    if (ok) g.ok++;
  }
  await router.settled();
  console.log();
  step('right primary', `${primary}/${positives} (${Math.round((100 * primary) / positives)}%)`);
  step('small talk given tools', `${falsePositives}/${cases.length - positives}`);
  step('wrong write tool first', wrongWrites);
  step('router errors', errorsCount);
  step('by language', Object.fromEntries(Object.entries(byLang).map(([l, g]) => [l, `${g.ok}/${g.n}`])));
  console.log(`\nwrong:\n${wrong.join('\n')}`);
} finally {
  await server.stop();
  if (!args.includes('--keep')) {
    try { rmSync(target); } catch { /* still open on Windows; it is in the temp folder */ }
  }
}
