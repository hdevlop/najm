import type { ZodSchema } from 'zod';

// ============================================================================
// Conflict Strategy
// ============================================================================

/** How to handle rows that already exist in the database */
export type ConflictStrategy = 'skip' | 'replace' | 'fail';

// ============================================================================
// Seed Entry Types
// ============================================================================

/** Link resolver function — receives previously seeded rows, returns new rows */
export type SeedResolver =
  | ((seeded: Record<string, any[]>) => Record<string, any>[])
  | ((seeded: Record<string, any[]>) => Promise<Record<string, any>[]>);

/** Full seed entry with all options */
export interface SeedEntryObject {
  /** Rows to seed — array or resolver function */
  rows: Record<string, any>[] | SeedResolver;
  /** Zod schema for validation before insert (optional) */
  schema?: ZodSchema;
  /** Custom unique key columns for conflict detection (auto-detected if omitted) */
  by?: string[];
  /** Conflict strategy override for this entry */
  onConflict?: ConflictStrategy;
}

/** A seed entry: raw array, resolver function, or full object */
export type SeedEntry =
  | Record<string, any>[]   // Raw rows
  | SeedResolver            // Link resolver
  | SeedEntryObject;        // Full entry with options

/** Seed definition — keys are table names, values are seed entries */
export type SeedDefinition = Record<string, SeedEntry>;

// ============================================================================
// Seed Options
// ============================================================================

export interface SeedOptions {
  /** Database name to use (default: auto-detect) */
  database?: string;
  /** Global conflict strategy (default: 'skip') */
  onConflict?: ConflictStrategy;
  /** Wrap in transaction (default: true) */
  transaction?: boolean;
  /** No writes, just log (default: false) */
  dryRun?: boolean;
  /** Log progress (default: false) */
  verbose?: boolean;
  /** Stop on first error (default: true) */
  failFast?: boolean;
}

// ============================================================================
// Seed Report
// ============================================================================

export interface SeedItemReport {
  table: string;
  operation: 'insert' | 'update' | 'skip' | 'error';
  count: number;
  reason?: string;
}

export interface SeedReport {
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  items: SeedItemReport[];
}