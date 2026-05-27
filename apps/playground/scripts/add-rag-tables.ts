import { Database } from 'bun:sqlite';

const dbPath = import.meta.dirname + '/../playground.db';
const d = new Database(dbPath);

const statements = [
  `CREATE TABLE IF NOT EXISTS chatbot_tool_embeddings (id TEXT PRIMARY KEY, tool_name TEXT NOT NULL UNIQUE, description TEXT NOT NULL, "group" TEXT, local_name TEXT, arg_names TEXT, annotations TEXT, fingerprint TEXT NOT NULL, embedding BLOB, created_at TEXT, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS chatbot_tool_semantics (id TEXT PRIMARY KEY, tool_name TEXT NOT NULL, phrase TEXT NOT NULL, lang TEXT NOT NULL DEFAULT 'und', source TEXT, source_file TEXT, embedding BLOB, created_at TEXT, updated_at TEXT)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS semantics_tool_phrase_lang_idx ON chatbot_tool_semantics(tool_name, phrase, lang)`,
  `CREATE INDEX IF NOT EXISTS semantics_tool_lang_idx ON chatbot_tool_semantics(tool_name, lang)`,
  `CREATE TABLE IF NOT EXISTS chatbot_routing_settings (id TEXT PRIMARY KEY, enable_knowledge INTEGER NOT NULL DEFAULT 1, max_tools INTEGER, top_semantic_hits INTEGER, similarity_threshold TEXT, fallback_on_router_error TEXT, fallback_on_no_match TEXT, dependencies TEXT, dangerous_intent_keywords TEXT, tools_override TEXT, context_override TEXT, created_at TEXT, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS chatbot_document_sources (id TEXT PRIMARY KEY, namespace TEXT NOT NULL DEFAULT 'rag', source_type TEXT NOT NULL, original_path TEXT NOT NULL, ext TEXT NOT NULL DEFAULT '', mime TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending', error TEXT, ingested_at TEXT, metadata TEXT, created_at TEXT, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS chatbot_document_chunks (id TEXT PRIMARY KEY, document_id TEXT NOT NULL, ordinal INTEGER NOT NULL, page INTEGER, text TEXT NOT NULL, tokens INTEGER NOT NULL DEFAULT 0, enabled INTEGER NOT NULL DEFAULT 1, metadata TEXT, created_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS chatbot_document_embeddings (id TEXT PRIMARY KEY, chunk_id TEXT NOT NULL UNIQUE, embedding BLOB, model TEXT NOT NULL DEFAULT '', dimensions INTEGER NOT NULL DEFAULT 768, created_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS chatbot_studio_audit_logs (id TEXT PRIMARY KEY, action TEXT NOT NULL, user_id TEXT, details TEXT NOT NULL DEFAULT '', created_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS chatbot_interaction_logs (id TEXT PRIMARY KEY, session_key TEXT, user_query TEXT NOT NULL, query_lang TEXT, routing_enabled INTEGER NOT NULL DEFAULT 0, routing_status TEXT NOT NULL, routed_tools TEXT, actual_tool_names TEXT, model_tool_calls TEXT, model_answer TEXT, steps_count TEXT, success INTEGER, error TEXT, metadata TEXT, created_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS storage_files (id TEXT PRIMARY KEY, namespace TEXT NOT NULL, path TEXT NOT NULL, filename TEXT NOT NULL, mime TEXT, size INTEGER, metadata TEXT, created_at TEXT, updated_at TEXT)`,
];

for (const sql of statements) {
  d.exec(sql);
}

const routingColumns = d.prepare('PRAGMA table_info(chatbot_routing_settings)').all() as Array<{ name: string }>;
if (!routingColumns.some((column) => column.name === 'enable_knowledge')) {
  d.exec('ALTER TABLE chatbot_routing_settings ADD COLUMN enable_knowledge INTEGER NOT NULL DEFAULT 1');
}

const semanticsColumns = d.prepare('PRAGMA table_info(chatbot_tool_semantics)').all() as Array<{ name: string }>;
if (!semanticsColumns.some((column) => column.name === 'source_file')) {
  d.exec('ALTER TABLE chatbot_tool_semantics ADD COLUMN source_file TEXT');
}
d.exec('CREATE INDEX IF NOT EXISTS semantics_tool_lang_idx ON chatbot_tool_semantics(tool_name, lang)');

const tables = d.prepare('SELECT name FROM sqlite_master WHERE type = ? ORDER BY name').all('table');
console.log('Tables:');
for (const r of tables) console.log(' ', r.name);

d.close();
