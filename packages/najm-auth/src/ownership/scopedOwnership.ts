import { aliasedTable, and, eq, getTableColumns, is, sql, type SQL } from 'drizzle-orm';
import { PgTable, QueryBuilder as PgQueryBuilder } from 'drizzle-orm/pg-core';
import { SQLiteTable, QueryBuilder as SQLiteQueryBuilder } from 'drizzle-orm/sqlite-core';

// ── Types ──────────────────────────────────────────────────────────────────

export interface JoinStep  { type: 'join';  left: any; right: any; table: any; }
export interface OwnerStep { type: 'owner'; col: any; }
export type OwnershipStep = JoinStep | OwnerStep;

/** A condition on the owned row; a function receives the user id and the rule's role. */
export type RowRule = SQL | ((userId: string, role: string) => SQL);
export interface WhenStep  { type: 'when';  rules: RowRule[]; }

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

/**
 * Row-condition step — a condition on the owned row itself.
 *
 * After a join chain it narrows the rows the chain reaches ("…and the alert is
 * for parents"). On its own it is the whole rule, for rows that belong to an
 * audience rather than to one linked person ("every published notice for
 * parents"). Several rules in one step, and several steps, are AND-ed.
 *
 * @example
 * own(alerts)
 *   .for('parent', join(alerts.studentId, students.id), where(students.parentUserId),
 *     when(eq(alerts.audience, 'parents')))
 *   .for('teacher', when(isNull(alerts.studentId), (userId) => eq(alerts.createdBy, userId)))
 */
export function when(...rules: RowRule[]): WhenStep {
  return { type: 'when', rules };
}

const resolveWhen = (step: WhenStep, uid: string, role: string): SQL =>
  and(...step.rules.map((rule) => typeof rule === 'function' ? rule(uid, role) : rule))!;

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
  /** Resource name (default: the table's name), e.g. for permission and policy names. */
  name?: string;
}

export class OwnershipToken {
  readonly symbol: symbol;
  readonly name:   string;
  readonly table:  any;

  private _rules: Record<string, (uid: string, query: any) => ScopeResult> = Object.create(null);
  private _writeScopeCol?: any;
  private _adminRoles?: string[];

  constructor(table: any, opts?: OwnershipTokenOptions) {
    const name =
      opts?.name                        ??
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

  /**
   * Define the scope rule for a role: a join chain ending in `where()`, and/or
   * `when()` row conditions. A chain with conditions reaches the rows the
   * chain reaches that also satisfy them; conditions alone are the whole rule.
   */
  for(role: string, ...steps: Array<OwnershipStep | WhenStep>): this {
    const chain = steps.filter((step): step is OwnershipStep => step.type !== 'when');
    const conditions = steps.filter((step): step is WhenStep => step.type === 'when');
    if (!conditions.length) {
      this._rules[role] = compile(chain);
      return this;
    }

    const joined = chain.length ? compile(chain) : undefined;
    this._rules[role] = (uid: string, query: any): ScopeResult => {
      const narrowing = and(...conditions.map((condition) => resolveWhen(condition, uid, role)));
      if (!joined) return { query, condition: narrowing };
      const scoped = joined(uid, query);
      return { query: scoped.query, condition: and(scoped.condition, narrowing) };
    };
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

// ── Subquery ───────────────────────────────────────────────────────────────

/**
 * The ids of `token`'s rows that a `role` user owns, as a subquery — for a
 * `when()` condition on another resource: "one of the classes this parent's
 * children are in". A role that bypasses scoping gets every id; a role with no
 * rule gets none.
 *
 * @example
 * own(announcements).for('parent', when((userId, role) =>
 *   inArray(announcements.classId, ownedIds(Class, role, userId))))
 */
export function ownedIds(token: OwnershipToken, role: string, userId: string): any {
  const table = token.table;
  if (!table?.id) throw new Error(`ownedIds(): ${token.name} has no id column.`);
  const builder = is(table, SQLiteTable) ? new SQLiteQueryBuilder()
    : is(table, PgTable) ? new PgQueryBuilder()
    : null;
  if (!builder) throw new Error(`ownedIds(): ${token.name} is not a pg or sqlite table.`);

  const rows = (builder as PgQueryBuilder).select({ id: table.id }).from(table);
  const { query, condition } = token.applyScopeSplit(userId, role, rows);
  return condition === null ? query : query.where(condition);
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
 *
 * // With a resource name other than the table's:
 * export const Report = own(reportRows, { name: 'reports' });
 */
export function own(table: any, opts?: OwnershipTokenOptions): OwnershipToken {
  return new OwnershipToken(table, opts);
}
