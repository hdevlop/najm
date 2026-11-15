/**
 * One-off cleanup for rows written before najm-rag recorded only the latest
 * user message in the unmatched inbox. Those entries hold several turns
 * joined by "\n---\n", and "Map to tool" copied some into semantic phrases.
 *
 * SQLite: bun packages/najm-rag/scripts/cleanup-multiturn-routing-rows.ts <db-file> [--apply]
 *   Lists the rows; deletes them only with --apply. Back up the file first.
 * PostgreSQL: run with --print-sql and review the statements before running them.
 */
import { Database } from 'bun:sqlite';

const SEPARATOR = '\n---\n';
const TABLES = [
  { table: 'chatbot_unmatched_queries', column: 'query' },
  { table: 'chatbot_tool_semantics', column: 'phrase' },
] as const;

const args = process.argv.slice(2);

if (args.includes('--print-sql')) {
  for (const { table, column } of TABLES) {
    console.log(`SELECT id, ${column} FROM ${table} WHERE position(E'\\n---\\n' in ${column}) > 0;`);
    console.log(`-- DELETE FROM ${table} WHERE position(E'\\n---\\n' in ${column}) > 0;`);
  }
  process.exit(0);
}

const file = args.find((arg) => !arg.startsWith('--'));
if (!file) {
  console.error('Usage: cleanup-multiturn-routing-rows.ts <sqlite-file> [--apply] | --print-sql');
  process.exit(1);
}

const apply = args.includes('--apply');
const db = new Database(file, { readonly: !apply });
const existing = new Set((db.query("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>).map((row) => row.name));

for (const { table, column } of TABLES) {
  if (!existing.has(table)) {
    console.log(`${table}: table not found, skipped`);
    continue;
  }
  const rows = db.query(`SELECT id, ${column} AS text FROM ${table} WHERE instr(${column}, ?) > 0`).all(SEPARATOR) as Array<{ id: string; text: string }>;
  console.log(`${table}: ${rows.length} multi-turn row(s)`);
  for (const row of rows) console.log(`  ${row.id}: ${JSON.stringify(row.text.slice(0, 120))}`);
  if (apply && rows.length > 0) {
    db.query(`DELETE FROM ${table} WHERE instr(${column}, ?) > 0`).run(SEPARATOR);
    console.log(`  deleted ${rows.length}`);
  }
}

if (!apply) console.log('\nDry run. Re-run with --apply to delete the rows listed above.');
