import { Service, Meta, Inject, DI, Container } from 'najm-core';
import { Err, LoggerService } from 'najm-core';
import { DatabaseService } from './DatabaseService';
import { TransactionService } from './TransactionService';
import type {
  SeedDefinition,
  SeedOptions,
  SeedReport,
  SeedItemReport,
  ConflictStrategy,
  SeedEntry,
  SeedEntryObject,
  SeedResolver,
} from './seed.types';
import { sql, eq, and, isTable, getTableColumns } from 'drizzle-orm';
import type { ZodSchema } from 'zod';

type Dialect = 'sqlite' | 'pg' | 'mysql';

interface NormalizedEntry {
  rows: Record<string, any>[] | SeedResolver;
  schema?: ZodSchema;
  by?: string[];
  onConflict: ConflictStrategy;
}

@Service()
@Meta({ layer: 'plugin' })
export class SeedService {
  @DI() private container!: Container;
  @Inject(DatabaseService) private dbService!: DatabaseService;
  @Inject(TransactionService) private txService!: TransactionService;
  @Inject(LoggerService) private log!: LoggerService;

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  public async run(
    definition: SeedDefinition,
    options?: SeedOptions
  ): Promise<SeedReport> {
    const opts = this.normalizeOptions(options);
    const db = this.getDatabase(opts);
    const dialect = this.detectDialect(db);

    const preResolvedRows = new Map<string, Record<string, any>[]>();

    if (opts.transaction) {
      const previewSeeded: Record<string, any[]> = {};

      for (const [tableName, entry] of Object.entries(definition)) {
        const normalized = this.normalizeEntry(entry, opts.onConflict!);
        this.resolveTable(db, tableName);

        const rows =
          typeof normalized.rows === 'function'
            ? await Promise.resolve(normalized.rows(previewSeeded))
            : normalized.rows;

        if (normalized.schema) {
          this.validateRows(rows, normalized.schema, tableName);
        }

        preResolvedRows.set(tableName, rows);
        previewSeeded[tableName] = rows;
      }
    }

    const executeSeed = async (executorDb: any): Promise<SeedReport> => {
      const seeded: Record<string, any[]> = {};
      const items: SeedItemReport[] = [];
      let totalInserted = 0;
      let totalUpdated = 0;
      let totalSkipped = 0;
      let totalFailed = 0;

      for (const [tableName, entry] of Object.entries(definition)) {
        try {
          const normalized = this.normalizeEntry(entry, opts.onConflict!);
          const table = this.resolveTable(db, tableName);

          // Resolve rows (call function if needed)
          const cached = preResolvedRows.get(tableName);
          let rows: Record<string, any>[];
          if (cached) {
            rows = cached;
          } else if (typeof normalized.rows === 'function') {
            rows = await Promise.resolve(normalized.rows(seeded));
          } else {
            rows = normalized.rows;
          }

          if (rows.length === 0) {
            items.push({ table: tableName, operation: 'skip', count: 0 });
            seeded[tableName] = [];
            continue;
          }

          // Validate rows if schema provided
          if (normalized.schema) {
            this.validateRows(rows, normalized.schema, tableName);
          }

          // Dry run mode — skip actual DB writes
          if (opts.dryRun) {
            if (opts.verbose) {
              this.log.info(`[DRY RUN] Would seed ${rows.length} row(s) into ${tableName}`);
            }
            items.push({ table: tableName, operation: 'skip', count: rows.length });
            totalSkipped += rows.length;
            seeded[tableName] = [];
            continue;
          }

          // Detect unique keys
          const uniqueKeys = normalized.by ?? this.detectUniqueKeys(table, tableName);

          // Execute insert with conflict strategy
          const { insertResult, allRows } = await this.insertRows(
            executorDb,
            table,
            rows,
            uniqueKeys,
            normalized.onConflict,
            dialect
          );

          // Store ALL rows (inserted + existing) for downstream resolvers.
          // When query-back cannot match (e.g. generated primary keys not present in input rows),
          // fall back to inserted rows returned by the dialect.
          seeded[tableName] = allRows.length > 0 ? allRows : insertResult;

          // Compute report counts
          const inserted = insertResult.length;
          const skipped = rows.length - inserted;

          totalInserted += inserted;
          totalSkipped += skipped;

          const operation = normalized.onConflict === 'replace' ? 'update' : 'insert';
          items.push({ table: tableName, operation, count: inserted });

          if (opts.verbose) {
            this.log.info(
              `Seeded ${tableName}: ${inserted} inserted, ${skipped} skipped`
            );
          }
        } catch (error: any) {
          totalFailed++;
          items.push({
            table: tableName,
            operation: 'error',
            count: 0,
            reason: error.message,
          });

          if (opts.failFast) {
            throw error;
          }

          this.log.error(`Failed to seed ${tableName}: ${error.message}`);
        }
      }

      return {
        inserted: totalInserted,
        updated: totalUpdated,
        skipped: totalSkipped,
        failed: totalFailed,
        items,
      };
    };

    if (opts.transaction) {
      return this.txService.run(async (trx) => executeSeed(trx), { database: opts.database });
    }

    return executeSeed(db);
  }

  // ============================================================================
  // OPTIONS & NORMALIZATION
  // ============================================================================

  private normalizeOptions(options?: SeedOptions): Required<SeedOptions> {
    return {
      database: options?.database,
      onConflict: options?.onConflict ?? 'skip',
      transaction: options?.transaction ?? true,
      dryRun: options?.dryRun ?? false,
      verbose: options?.verbose ?? false,
      failFast: options?.failFast ?? true,
    };
  }

  private normalizeEntry(entry: SeedEntry, globalConflict: ConflictStrategy): NormalizedEntry {
    // Raw array
    if (Array.isArray(entry)) {
      return {
        rows: entry,
        onConflict: globalConflict,
      };
    }

    // Function resolver
    if (typeof entry === 'function') {
      return {
        rows: entry,
        onConflict: globalConflict,
      };
    }

    // Full entry object
    return {
      rows: entry.rows,
      schema: entry.schema,
      by: entry.by,
      onConflict: entry.onConflict ?? globalConflict,
    };
  }

  // ============================================================================
  // DATABASE AUTO-DETECTION
  // ============================================================================

  private getDatabase(options: SeedOptions): any {
    const dbName = options.database;

    // 1. Explicit database in options
    if (dbName) {
      if (!this.dbService.has(dbName)) {
        const available = this.dbService.getNames();
        throw Err.notFound(
          `Database '${dbName}' not found. Available: ${available.join(', ')}`
        );
      }
      return this.dbService.get(dbName);
    }

    // 2. Try 'default' first
    if (this.dbService.has('default')) {
      return this.dbService.get('default');
    }

    // 3. Use first available database
    const names = this.dbService.getNames();
    if (names.length > 0) {
      return this.dbService.get(names[0]);
    }

    // 4. No databases configured
    throw Err.notFound(
      'No databases configured. Register at least one database with the database plugin.'
    );
  }

  // ============================================================================
  // TABLE RESOLUTION
  // ============================================================================

  private resolveTable(db: any, tableName: string): any {
    // Try fullSchema first (actual Drizzle table objects), then fallback schema
    const fullSchema = db?._?.fullSchema;
    const schema = db?._?.schema;
    const table = fullSchema?.[tableName] ?? schema?.[tableName];

    if (!table) {
      const available = Object.keys(fullSchema || schema || {});
      throw Err.notFound(
        `Table '${tableName}' not found in schema. Available: ${available.join(', ')}`
      );
    }

    // Drizzle >=0.45 uses Symbol metadata, older versions may still expose table._
    if (!isTable(table) && (!table._ || typeof table._ !== 'object')) {
      throw Err.invalidConfig(
        tableName,
        `Table has invalid structure. Expected Drizzle table object. Got: ${typeof table}`
      );
    }

    return table;
  }

  // ============================================================================
  // UNIQUE KEY DETECTION
  // ============================================================================

  private detectUniqueKeys(table: any, tableName: string): string[] {
    const columns = isTable(table)
      ? getTableColumns(table)
      : (table?._?.columns ?? {});

    const primaryKeys: string[] = [];

    // Check for primary key columns
    for (const [colName, col] of Object.entries<any>(columns)) {
      if (col.primary) {
        primaryKeys.push(colName);
      }
    }

    if (primaryKeys.length > 0) {
      return primaryKeys;
    }

    // Fallback to unique columns when no primary key exists
    const uniqueKeys = Object.entries<any>(columns)
      .filter(([, col]) => Boolean(col?.isUnique))
      .map(([colName]) => colName);

    if (uniqueKeys.length > 0) {
      return uniqueKeys;
    }

    // Legacy fallback: check old table config for composite keys/unique constraints
    const config = table?._?.config;
    if (config?.primaryKeys?.length > 0) {
      return config.primaryKeys.map((pk: any) => pk.columns.map((c: any) => c.name)).flat();
    }

    throw Err.invalidConfig(
      'seed',
      `No unique key detected for table '${tableName}'. Specify unique columns with 'by' option.`
    );
  }

  // ============================================================================
  // DIALECT DETECTION
  // ============================================================================

  private detectDialect(db: any): Dialect {
    const dialectName = db._.session?.dialect?.constructor?.name?.toLowerCase() || '';

    if (dialectName.includes('sqlite')) return 'sqlite';
    if (dialectName.includes('postgres') || dialectName.includes('pg')) return 'pg';
    if (dialectName.includes('mysql')) return 'mysql';

    // Fallback: check db methods
    if (typeof db.run === 'function') return 'sqlite';
    if (typeof db.query === 'function') return 'pg';

    throw Err.invalidConfig(
      'dialect',
      `Unsupported database dialect: ${dialectName || 'unknown'}`
    );
  }

  // ============================================================================
  // VALIDATION
  // ============================================================================

  private validateRows(rows: Record<string, any>[], schema: ZodSchema, tableName: string): void {
    for (let i = 0; i < rows.length; i++) {
      const result = schema.safeParse(rows[i]);
      if (!result.success) {
        // Use Err.fromZod from najm-core ValidationError
        throw Err.fromZod(result.error, `${tableName}[${i}]`);
      }
    }
  }

  // ============================================================================
  // CONFLICT-AWARE INSERT
  // ============================================================================

  private async insertRows(
    db: any,
    table: any,
    rows: Record<string, any>[],
    targets: string[],
    strategy: ConflictStrategy,
    dialect: Dialect
  ): Promise<{ insertResult: any[]; allRows: any[] }> {
    if (rows.length === 0) {
      return { insertResult: [], allRows: [] };
    }

    // MySQL uses different API
    if (dialect === 'mysql') {
      return this.insertRowsMySQL(db, table, rows, targets, strategy);
    }

    // SQLite / PostgreSQL
    let insertResult: any[] = [];

    if (strategy === 'fail') {
      // Raw insert — throws on conflict
      insertResult = await db.insert(table).values(rows).returning();
    } else if (strategy === 'skip') {
      // Insert new, ignore existing
      insertResult = await db
        .insert(table)
        .values(rows)
        .onConflictDoNothing({ target: targets.map((k) => table[k]) })
        .returning();
    } else {
      // Replace — upsert, overwrite existing
      const updateSet = this.buildUpdateSet(table, targets, dialect);
      insertResult = await db
        .insert(table)
        .values(rows)
        .onConflictDoUpdate({
          target: targets.map((k) => table[k]),
          set: updateSet,
        })
        .returning();
    }

    // Query back ALL matching rows (inserted + existing)
    const allRows = await this.queryBackRows(db, table, rows, targets);

    return { insertResult, allRows };
  }

  // ============================================================================
  // MYSQL VARIANT
  // ============================================================================

  private async insertRowsMySQL(
    db: any,
    table: any,
    rows: Record<string, any>[],
    targets: string[],
    strategy: ConflictStrategy
  ): Promise<{ insertResult: any[]; allRows: any[] }> {
    if (rows.length === 0) {
      return { insertResult: [], allRows: [] };
    }

    if (strategy === 'fail') {
      await db.insert(table).values(rows);
    } else if (strategy === 'skip') {
      // MySQL: use INSERT IGNORE via onDuplicateKeyUpdate with first target = itself (no-op)
      const firstTarget = targets[0];
      await db
        .insert(table)
        .values(rows)
        .onDuplicateKeyUpdate({ set: { [firstTarget]: sql.raw(`\`${firstTarget}\``) } });
    } else {
      // Replace
      const updateSet = this.buildUpdateSet(table, targets, 'mysql');
      await db.insert(table).values(rows).onDuplicateKeyUpdate({ set: updateSet });
    }

    // MySQL doesn't support .returning() — always query back
    const allRows = await this.queryBackRows(db, table, rows, targets);
    return { insertResult: allRows, allRows };
  }

  // ============================================================================
  // BUILD UPDATE SET
  // ============================================================================

  private buildUpdateSet(table: any, excludeKeys: string[], dialect: Dialect): Record<string, any> {
    const updateSet: Record<string, any> = {};
    const quote = dialect === 'mysql' ? '`' : '"';
    const columns = isTable(table)
      ? getTableColumns(table)
      : (table?._?.columns ?? table ?? {});

    for (const [propName, column] of Object.entries<any>(columns)) {
      if (propName === '_' || excludeKeys.includes(propName)) {
        continue;
      }

      const dbColumnName =
        typeof column?.name === 'string' && column.name.length > 0
          ? column.name
          : propName;

        // MySQL uses VALUES(), SQLite/PG use excluded
      if (dialect === 'mysql') {
        updateSet[propName] = sql.raw(`VALUES(${quote}${dbColumnName}${quote})`);
      } else {
        updateSet[propName] = sql.raw(`excluded.${quote}${dbColumnName}${quote}`);
      }
    }

    return updateSet;
  }

  // ============================================================================
  // QUERY BACK (ensures seeded[key] contains ALL rows)
  // ============================================================================

  private async queryBackRows(
    db: any,
    table: any,
    rows: Record<string, any>[],
    uniqueKeys: string[]
  ): Promise<any[]> {
    const results: any[] = [];

    for (const row of rows) {
      const conditions = uniqueKeys.map((key) => eq(table[key], row[key]));
      const result = await db.select().from(table).where(and(...conditions)).limit(1);
      if (result[0]) {
        results.push(result[0]);
      }
    }

    return results;
  }
}
