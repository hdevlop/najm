import { Service, Inject, Meta } from 'najm-core';
import { DatabaseService } from 'najm-database';
import { RAG_CONFIG } from '../tokens';
import type { RagMergedConfig } from '../config';
import { loadSqliteVec } from './sqliteVecLoader';

@Service()
@Meta({ layer: 'plugin', order: 54 })
export class SqliteVecBootService {
  constructor(
    @Inject(RAG_CONFIG) private config: RagMergedConfig,
    @Inject() private databases: DatabaseService,
  ) {}

  async configure() {
    const ragEnabled = this.config.rag?.enabled === true;
    const routingEnabled = this.config.toolRouting?.enabled === true;

    // Load sqlite-vec when rag is enabled on sqlite dialect
    // (backward compatibility: also load when toolRouting is enabled)
    const shouldLoad = (ragEnabled || routingEnabled) && this.config.dialect === 'sqlite';
    if (!shouldLoad) return;

    const db = this.databases.get('default');
    const rawClient = db?.$client;
    if (!rawClient) {
      throw new Error(
        'najm-rag tool routing on sqlite requires a local sqlite adapter with $client. ' +
          'drizzle-orm/bun-sqlite and drizzle-orm/better-sqlite3 are supported. ' +
          'HTTP/D1/libsql-style adapters without a local $client are not supported for sqlite-vec.',
      );
    }
    await loadSqliteVec(rawClient);
  }
}
