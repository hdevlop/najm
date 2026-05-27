// ============================================================================
// najm-storage - Audit Service (Studio feature)
// ============================================================================

import { Service, Meta, DI, Container, LoggerService } from 'najm-core';
import { Inject } from 'najm-core';
import { STORAGE_CONFIG } from './tokens';
import type { StorageConfig, StorageSchema, StorageDialect } from './types';
import { storageSchema as pgSchema } from './schema/pg';
import { storageSchema as sqliteSchema } from './schema/sqlite';
import { storageSchema as mysqlSchema } from './schema/mysql';

function detectDialect(db: any): StorageDialect {
  const name: string = db?.dialect?.constructor?.name?.toLowerCase() ?? '';
  if (name.includes('mysql')) return 'mysql';
  if (name.includes('pg') || name.includes('postgres')) return 'pg';
  return 'sqlite';
}

function schemaForDialect(dialect: StorageDialect): StorageSchema {
  if (dialect === 'pg') return pgSchema;
  if (dialect === 'mysql') return mysqlSchema;
  return sqliteSchema;
}

@Service()
@Meta({ layer: 'plugin' })
export class AuditService {
  @DI() private container!: Container;
  @Inject(STORAGE_CONFIG) private config!: StorageConfig;
  @Inject(LoggerService) private log!: LoggerService;

  private db!: any;
  private auditLog!: any;

  async configure(): Promise<void> {
    const dbName = this.config.database ?? 'default';
    this.db = this.container.get(`Database:${dbName}`);
    const dialect = this.config.dialect ?? detectDialect(this.db);
    const schema = this.config.schema ?? schemaForDialect(dialect);

    if (!schema.auditLog) {
      this.log.warn('Storage Studio: auditLog table not found in schema — audit logging disabled');
      return;
    }

    this.auditLog = schema.auditLog;
  }

  async write(entry: { actor: string; action: string; namespace: string; path?: string; meta?: Record<string, unknown> }) {
    if (!this.auditLog) return;
    await this.db.insert(this.auditLog).values({
      ...entry,
      meta: entry.meta ? JSON.stringify(entry.meta) : null,
    });
  }

  async list(opts?: { namespace?: string; limit?: number; since?: Date }) {
    if (!this.auditLog) return [];

    const { eq, and, gte, desc } = await import('drizzle-orm');
    const cond = [];
    if (opts?.namespace) cond.push(eq(this.auditLog.namespace, opts.namespace));
    if (opts?.since) cond.push(gte(this.auditLog.ts, opts.since.toISOString()));

    return this.db
      .select()
      .from(this.auditLog)
      .where(and(...cond))
      .orderBy(desc(this.auditLog.ts))
      .limit(opts?.limit ?? 50);
  }
}
