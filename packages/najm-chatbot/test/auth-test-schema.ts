import type { Database } from 'bun:sqlite';

export function createCredentialSetupTables(sqlite: Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS credential_setup_sessions (
      id TEXT PRIMARY KEY,
      created_at TEXT,
      updated_at TEXT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      purpose TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      consumed_at TEXT,
      revoked_at TEXT
    );
    CREATE TABLE IF NOT EXISTS credential_setup_requirements (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      purpose TEXT NOT NULL,
      temporary_credential_kind TEXT,
      required INTEGER NOT NULL DEFAULT 1,
      completed_at TEXT,
      created_at TEXT,
      updated_at TEXT,
      PRIMARY KEY (user_id, purpose)
    );
  `);
}
