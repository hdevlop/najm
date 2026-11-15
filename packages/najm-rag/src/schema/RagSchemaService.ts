import { Service, Inject, Meta, LoggerService, DI, type Container } from 'najm-core';
import { DatabaseService } from 'najm-database';
import { getTableColumns, getTableName, sql } from 'drizzle-orm';
import { RAG_CONFIG, RAG_SCHEMA } from '../tokens';
import type { RagMergedConfig } from '../config';
import { ToolIndexRepository } from '../toolIndex/ToolIndexRepository';
import { RoutingSettingsRepository } from '../routingSettings/RoutingSettingsRepository';
import { UnmatchedQueryRepository } from '../unmatched/UnmatchedQueryRepository';
import { RoutingTestsRepository } from '../routingTests/RoutingTestsRepository';

/** A repository that can bring its own tables and columns up to date. */
export interface RagSchemaEnsurer {
  ensureSchema(): Promise<void>;
}

export interface RagSchemaStatus {
  /** Whether najm-rag adds missing tables and columns itself (`ensureSchema`). */
  ensureSchema: boolean;
  /** True once the boot check has run. */
  checked: boolean;
  /** `table` or `table.column` entries the database lacks. Empty when the schema is complete. */
  missing: string[];
  /** Why adding a table or column failed, when it did. */
  error?: string;
  /** One line for people: what is wrong and what to do. Absent when nothing is missing. */
  message?: string;
}

/** Schema keys read by tool routing, and by the knowledge base. */
const ROUTING_TABLES = ['chatbotToolEmbeddings', 'chatbotToolSemantics', 'chatbotRoutingSettings', 'chatbotUnmatchedQueries', 'chatbotRoutingTests'];
const KNOWLEDGE_TABLES = ['chatbotDocumentSources', 'chatbotDocumentChunks', 'chatbotDocumentEmbeddings'];

/** Repositories that add their own missing tables and columns. Only the registered ones run. */
const ENSURERS = [ToolIndexRepository, RoutingSettingsRepository, UnmatchedQueryRepository, RoutingTestsRepository];

/**
 * Brings najm-rag's tables up to date once, at boot, before the first read.
 *
 * Repositories used to add new columns lazily, on the first query that called
 * their check. A read that did not call it, or a check that ran inside a host
 * request transaction that later rolled back, left the column missing while
 * every later `select` named it, so `/semantics`, `/settings`, `/status` and
 * `/tools/list` failed with a bare "Failed query". Running all checks in
 * `activate` (outside any request) and then comparing the live columns with
 * the drizzle schema makes the result visible: `missing` names what is still
 * absent, with or without `ensureSchema`.
 */
@Service()
@Meta({ layer: 'plugin', order: 54 })
export class RagSchemaService {
  @DI() private container!: Container;

  private state: RagSchemaStatus;

  constructor(
    @Inject(RAG_CONFIG) private config: RagMergedConfig,
    @Inject(RAG_SCHEMA) private schema: Record<string, any>,
    @Inject() private databases: DatabaseService,
    @Inject(LoggerService) private log: LoggerService,
  ) {
    this.state = { ensureSchema: config.ensureSchema !== false, checked: false, missing: [] };
  }

  async activate(): Promise<void> {
    await this.check();
  }

  /** Current schema state. Re-checks while something is missing, so a migration run clears it without a restart. */
  async status(): Promise<RagSchemaStatus> {
    if (!this.state.checked || this.state.missing.length > 0) await this.check({ quiet: true });
    return { ...this.state, missing: [...this.state.missing] };
  }

  /** Runs every repository's own schema check, then lists what the database still lacks. */
  async check(options: { quiet?: boolean } = {}): Promise<RagSchemaStatus> {
    let error: string | undefined;
    if (this.state.ensureSchema) {
      for (const ensurer of await this.ensurers()) {
        try {
          await ensurer.ensureSchema();
        } catch (err) {
          error ??= err instanceof Error ? err.message : String(err);
        }
      }
    }

    let missing: string[] = [];
    try {
      missing = await this.findMissing();
    } catch (err) {
      error ??= err instanceof Error ? err.message : String(err);
    }

    this.state = {
      ensureSchema: this.state.ensureSchema,
      checked: true,
      missing,
      ...(error ? { error } : {}),
      ...(missing.length ? { message: missingMessage(missing, this.state.ensureSchema, error) } : {}),
    };
    if (missing.length && !options.quiet) this.log?.error?.(`[najm-rag] ${this.state.message}`);
    return this.state;
  }

  /** Registered repositories, resolved (and built if needed: this runs before they boot). */
  private async ensurers(): Promise<RagSchemaEnsurer[]> {
    const found: RagSchemaEnsurer[] = [];
    for (const token of ENSURERS) {
      if (!this.container?.has?.(token)) continue;
      const instance = await this.container.resolve(token as any) as Partial<RagSchemaEnsurer>;
      if (typeof instance?.ensureSchema === 'function') found.push(instance as RagSchemaEnsurer);
    }
    return found;
  }

  /** `table` / `table.column` entries in najm-rag's drizzle schema that the live database lacks. */
  async findMissing(): Promise<string[]> {
    const db = this.databases.get('default') as any;
    if (!db) return [];
    const keys = [
      ...(this.config.toolRouting?.enabled ? ROUTING_TABLES : []),
      ...((this.config as any).knowledge?.enabled ? KNOWLEDGE_TABLES : []),
    ];
    const expected = new Map<string, string[]>();
    for (const key of keys) {
      const table = this.schema?.[key];
      if (!table) continue;
      expected.set(getTableName(table), Object.values(getTableColumns(table)).map((column: any) => column.name));
    }
    if (expected.size === 0) return [];

    const live = await liveColumns(db, this.config.dialect, [...expected.keys()]);
    if (!live) return [];

    const missing: string[] = [];
    for (const [table, columns] of expected) {
      const present = live.get(table);
      if (!present) { missing.push(table); continue; }
      for (const column of columns) if (!present.has(column)) missing.push(`${table}.${column}`);
    }
    return missing;
  }
}

function missingMessage(missing: string[], ensureSchema: boolean, error?: string): string {
  const list = missing.join(', ');
  if (ensureSchema) {
    return `database is missing ${list}: najm-rag could not add ${missing.length === 1 ? 'it' : 'them'}`
      + `${error ? ` (${error})` : ''}. Run your migrations.`;
  }
  return `database is missing ${list}: run your migrations (ensureSchema is off).`;
}

function rowsOf(result: any): any[] {
  if (Array.isArray(result)) return result;
  return result?.rows ?? [];
}

/** Columns of each table that exists, or null when the dialect cannot be inspected. */
async function liveColumns(db: any, dialect: string | undefined, tables: string[]): Promise<Map<string, Set<string>> | null> {
  const result = new Map<string, Set<string>>();
  if (dialect === 'sqlite' && typeof db.all === 'function') {
    for (const table of tables) {
      const columns = rowsOf(await db.all(sql.raw(`PRAGMA table_info(${JSON.stringify(table)})`)));
      if (columns.length) result.set(table, new Set(columns.map((c: any) => String(c.name))));
    }
    return result;
  }
  if ((dialect === 'pg' || dialect === undefined) && typeof db.execute === 'function') {
    const rows = rowsOf(await db.execute(sql`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = ANY (current_schemas(false))
        AND table_name IN (${sql.join(tables.map((t) => sql`${t}`), sql`, `)})
    `));
    for (const row of rows) {
      const table = String(row.table_name);
      if (!result.has(table)) result.set(table, new Set());
      result.get(table)!.add(String(row.column_name));
    }
    return result;
  }
  return null;
}
