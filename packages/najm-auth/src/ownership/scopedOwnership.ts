import { aliasedTable, eq, getTableColumns, sql } from 'drizzle-orm';

// ── Types ──────────────────────────────────────────────────────────────────

export interface JoinStep  { type: 'join';  left: any; right: any; table: any; }
export interface OwnerStep { type: 'owner'; col: any; }
export type OwnershipStep = JoinStep | OwnerStep;

// ── Default admin roles (used when OwnershipToken has no explicit adminRoles) ──

const DEFAULT_ADMIN_ROLES: string[] = ['admin'];
const DRIZZLE_NAME = Symbol.for('drizzle:Name');
const DRIZZLE_BASE_NAME = Symbol.for('drizzle:BaseName');
const DRIZZLE_IS_ALIAS = Symbol.for('drizzle:IsAlias');

// ── Builders ───────────────────────────────────────────────────────────────

/**
 * JOIN step — links two columns across tables.
 * The target table is inferred from the right column.
 * Raw tables are auto-aliased when needed; already-aliased tables are preserved.
 *
 * @example join(grades.studentId, students.id)
 */
export function join(left: any, right: any): JoinStep {
  const table = (right as any).table;
  if (!table) throw new Error('join(): cannot infer table from right column.');
  return { type: 'join', left, right, table };
}

/**
 * WHERE step — terminal column that holds the user id.
 * @example where(teachers.userId)
 */
export function where(col: any): OwnerStep {
  return { type: 'owner', col };
}

// ── Compiler ───────────────────────────────────────────────────────────────

export type ScopeResult = { query: any; condition: any };

function isAliased(table: any): boolean {
  return table?.[DRIZZLE_IS_ALIAS] === true;
}

function autoAlias(table: any, suffix: number): any {
  if (isAliased(table)) return table;

  const name =
    table?.[DRIZZLE_BASE_NAME] ??
    table?.[DRIZZLE_NAME] ??
    'table';

  return aliasedTable(table, `_sc_${String(name)}_${suffix}`);
}

function getColumns(table: any): Record<string, any> | null {
  try {
    return getTableColumns(table) ?? null;
  } catch {
    return null;
  }
}

function buildColumnMap(rawTable: any, aliased: any): Map<any, any> {
  const rawCols = getColumns(rawTable);
  const aliasedCols = getColumns(aliased);
  const map = new Map<any, any>();

  if (!rawCols || !aliasedCols) return map;

  for (const key of Object.keys(rawCols)) {
    map.set(rawCols[key], aliasedCols[key]);
  }

  return map;
}

function compile(steps: OwnershipStep[]): (uid: string, query: any) => ScopeResult {
  const tableMap = new Map<any, any>();
  const colMap = new Map<any, any>();
  let aliasIndex = 0;

  for (const step of steps) {
    if (step.type !== 'join') continue;

    const rawTable = step.right.table;
    if (isAliased(rawTable) || tableMap.has(rawTable) || !getColumns(rawTable)) continue;

    const aliased = autoAlias(rawTable, ++aliasIndex);
    tableMap.set(rawTable, aliased);

    for (const [rawCol, aliasedCol] of buildColumnMap(rawTable, aliased)) {
      colMap.set(rawCol, aliasedCol);
    }
  }

  const remapped = steps.map(step => {
    if (step.type === 'join') {
      return {
        ...step,
        left: colMap.get(step.left) ?? step.left,
        right: colMap.get(step.right) ?? step.right,
        table: tableMap.get(step.right.table) ?? step.right.table,
      };
    }

    if (step.type === 'owner') {
      return {
        ...step,
        col: colMap.get(step.col) ?? step.col,
      };
    }

    return step;
  });

  const joins  = remapped.filter((s): s is JoinStep  => s.type === 'join');
  const owner  = remapped.find ((s): s is OwnerStep => s.type === 'owner');
  if (!owner) throw new Error('Ownership chain must end with where()');

  return (uid: string, query: any) => {
    let q = query;
    for (const j of joins) q = q.innerJoin(j.table, eq(j.left, j.right));
    return { query: q, condition: eq(owner.col, uid) };
  };
}

// ── OwnershipToken ─────────────────────────────────────────────────────────

export interface OwnershipTokenOptions {
  /** Admin roles that bypass all scoping. Falls back to global admin roles if not set. */
  adminRoles?: string[];
}

export class OwnershipToken {
  readonly symbol: symbol;
  readonly name:   string;
  readonly table:  any;

  private _rules: Record<string, (uid: string, query: any) => ScopeResult> = {};
  private _writeScopeCol?: any;
  private _adminRoles?: string[];

  constructor(table: any, opts?: OwnershipTokenOptions) {
    const name =
      table[DRIZZLE_NAME]               ??
      (table as any)?._.baseName       ??
      (table as any)?._.name           ??
      'resource';

    this.name   = name;
    this.table  = table;
    this.symbol = Symbol(name);
    this._adminRoles = opts?.adminRoles;
  }

  private isAdmin(role: string): boolean {
    return (this._adminRoles ?? DEFAULT_ADMIN_ROLES).includes(role);
  }

  /** Define scope rules for a role. */
  for(role: string, ...steps: OwnershipStep[]): this {
    this._rules[role] = compile(steps);
    return this;
  }

  /**
   * Column to verify ownership before write operations (create/update).
   * @example .writeBy(grades.studentId)
   */
  writeBy(col: any): this {
    this._writeScopeCol = col;
    return this;
  }

  getRules()   { return this._rules; }
  getWriteBy() { return this._writeScopeCol; }

  /** Apply scope to a Drizzle query based on the current user's role. */
  applyScope(uid: string, role: string, query: any): any {
    if (this.isAdmin(role))       return query;
    const rule = this._rules[role];
    if (!rule)                    return query.where(sql`1 = 0`);
    const { query: q, condition } = rule(uid, query);
    return q.where(condition);
  }

  /**
   * Like applyScope but returns JOINed query + ownership condition separately,
   * so callers can AND it with additional WHERE clauses in a single .where() call.
   * Returns `null` condition for admin roles (no filter needed).
   * Returns `sql\`1 = 0\`` condition for roles without rules (deny all).
   */
  applyScopeSplit(uid: string, role: string, query: any): ScopeResult {
    if (this.isAdmin(role))       return { query, condition: null };
    const rule = this._rules[role];
    if (!rule)                    return { query, condition: sql`1 = 0` };
    return rule(uid, query);
  }
}

// ── Entry point ────────────────────────────────────────────────────────────

/**
 * Start an ownership definition chain.
 *
 * @example
 * export const Grade = own(grades)
 *   .for('teacher', join(grades.studentId, students.id), where(teachers.userId))
 *   .for('parent',  join(grades.studentId, students.id), where(parents.userId))
 *   .writeBy(grades.studentId);
 *
 * // With explicit admin roles (avoids global state):
 * export const Grade = own(grades, { adminRoles: ['admin', 'principal'] })
 *   .for('teacher', join(grades.studentId, students.id), where(teachers.userId));
 */
export function own(table: any, opts?: OwnershipTokenOptions): OwnershipToken {
  return new OwnershipToken(table, opts);
}
