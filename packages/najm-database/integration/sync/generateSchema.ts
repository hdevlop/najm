import { readFile } from 'node:fs/promises';

const child = Bun.spawn([process.execPath, 'x', 'drizzle-kit', 'generate', '--config', 'integration/sync/drizzle.config.ts'],
  { stdout: 'pipe', stderr: 'pipe' });
const [stdout, stderr, code] = await Promise.all([
  new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
]);
process.stdout.write(stdout); process.stderr.write(stderr);
// Some generator failures print a stack trace but return exit status zero.
// Never migrate a stale previous output and call that a generation proof.
if (code !== 0 || /(?:^|\n)(?:[A-Za-z]*Error):/.test(stdout + '\n' + stderr)) throw Error('Schema generation failed');
const meta = new URL('./.output/schema-generation/meta/', import.meta.url);
const journal = JSON.parse(await readFile(new URL('_journal.json', meta), 'utf8'));
const latest = journal.entries.at(-1);
if (!latest) throw Error('Schema generation produced no migration');
const snapshot = JSON.parse(await readFile(new URL(String(latest.idx).padStart(4, '0') + '_snapshot.json', meta), 'utf8'));
if (Object.keys(snapshot.tables ?? {}).length !== 7) throw Error('Expected all seven package metadata tables');
