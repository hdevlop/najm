// ============================================================================
// najm-storage/client-db - Postgres in the browser (PGlite + drizzle)
// ============================================================================
// Optional module: requires the `@electric-sql/pglite` peer dependency
// (`bun add @electric-sql/pglite`). Kept as a separate entry so the ~3.7 MB
// WASM binary is only bundled by apps that import it.
//
// Reuse the same pg-dialect drizzle schema files as your server — PGlite is
// real Postgres compiled to WASM, not an emulation.

import { PGlite, type PGliteOptions } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';

export type ClientDbPersistence = 'idb' | 'opfs' | 'memory';

export interface ClientDbConfig<TSchema extends Record<string, unknown>> {
  /** Database name, used to derive the storage location (default: 'najm-app'). */
  name?: string;
  /** Drizzle schema — pass the same pg schema object your server uses. */
  schema?: TSchema;
  /**
   * Where PGlite persists data (default: 'idb'):
   * - 'idb'    — IndexedDB filesystem; works on the main thread, zero setup
   * - 'opfs'   — OPFS access-handle pool; faster, but requires running in a Web Worker
   * - 'memory' — no persistence (tests, ephemeral data)
   */
  persistence?: ClientDbPersistence;
  /** Explicit PGlite dataDir (e.g. 'opfs-ahp://my-db'). Overrides name/persistence. */
  dataDir?: string;
  /** Extra PGlite options (extensions, relaxedDurability, ...). */
  pglite?: PGliteOptions;
}

export interface ClientDb<TSchema extends Record<string, unknown>> {
  /** Drizzle instance — full pg dialect query builder. */
  db: PgliteDatabase<TSchema>;
  /** Underlying PGlite client for raw SQL (`client.query`, `client.exec`). */
  client: PGlite;
  close(): Promise<void>;
}

function resolveDataDir(config: ClientDbConfig<Record<string, unknown>>): string {
  if (config.dataDir) return config.dataDir;
  const name = config.name ?? 'najm-app';
  switch (config.persistence ?? 'idb') {
    case 'memory': return 'memory://';
    case 'opfs': return `opfs-ahp://${name}`;
    default: return `idb://${name}`;
  }
}

export function createClientDb<TSchema extends Record<string, unknown> = Record<string, never>>(
  config: ClientDbConfig<TSchema> = {},
): ClientDb<TSchema> {
  const client = new PGlite(resolveDataDir(config), config.pglite);
  const db = drizzle(client, config.schema ? { schema: config.schema } : undefined) as PgliteDatabase<TSchema>;
  return { db, client, close: () => client.close() };
}
