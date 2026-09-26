import { inArray, or, sql, type SQL } from 'drizzle-orm';
import type { OwnershipToken } from './scopedOwnership';

/** Request context consumed by ownershipCondition; ScopeContext implements it. */
export interface OwnershipReadContext {
  hasActiveContext(): boolean;
  getUser(): { id: string; role: string } | null;
}

/** Additional custom-query method installed by @Owned. */
export interface OwnershipConditionMethods {
  ownershipCondition(): SQL | undefined;
}

export function validateOwnershipAlternatives(tokens: readonly OwnershipToken[]): void {
  if (!tokens.length) throw new Error('Ownership requires at least one token');
  const table = tokens[0].table;
  if (tokens.some((token) => token.table !== table)) {
    throw new Error('Ownership alternatives must refer to the same table');
  }
}

/**
 * Compose this predicate with application filters in ONE .where(and(...)).
 * Each token grants alternative access to the same table through an ID
 * subquery, so joins cannot duplicate outer rows or collide with outer joins.
 * The table must expose an `id` column. Roles and ownership rules remain
 * application-owned. Unknown roles and anonymous active requests deny all.
 * Outside a request, reads remain unscoped for seed/job compatibility.
 */
export function ownershipCondition(
  db: any,
  tokens: readonly OwnershipToken[],
  context: OwnershipReadContext | undefined,
): SQL | undefined {
  validateOwnershipAlternatives(tokens);
  const idColumn = tokens[0].table.id;
  if (!idColumn) throw new Error('ownershipCondition requires a table with an id column');
  if (!context?.hasActiveContext()) return undefined;
  const user = context.getUser();
  if (!user) return sql`1 = 0`;

  const conditions: SQL[] = [];
  for (const token of tokens) {
    const { query, condition } = token.applyScopeSplit(
      user.id, user.role, db.select({ id: idColumn }).from(token.table),
    );
    if (condition === null) return undefined;
    if (!Object.prototype.hasOwnProperty.call(token.getRules(), user.role)) continue;
    conditions.push(inArray(idColumn, query.where(condition)));
  }
  if (!conditions.length) return sql`1 = 0`;
  return conditions.length === 1 ? conditions[0] : or(...conditions);
}
