import 'reflect-metadata';
import { sql, and }          from 'drizzle-orm';
import { Injectable, Inject, DI, Container, REQUEST_ID } from 'najm-core';
import { USER }              from 'najm-guard';
import { OwnershipToken }    from './scopedOwnership';

export const OWNED_META = Symbol.for('najm:owned');

// ── Interface ──────────────────────────────────────────────────────────────

export interface OwnedMethods<T = any> {
  /** Scoped findMany with optional extra WHERE / orderBy / limit. */
  findMany(opts?: { where?: any; orderBy?: any; limit?: number }): Promise<T[]>;
  /** Scoped findOne — returns null if missing or not owned. */
  findOne(opts: { where: any }): Promise<T | null>;
  /** Raw scoped Drizzle query builder — for advanced custom queries. */
  scopedQuery(): any;
}

// ── Scope helper ───────────────────────────────────────────────────────────

/**
 * ScopeContext is injected into every @Owned repository.
 * It reads the current user from the ALS container set by AuthGuard.
 * User is cached per request (keyed by REQUEST_ID) to avoid repeated ALS lookups.
 */
@Injectable()
export class ScopeContext {
  @DI() private container!: Container;
  private _cachedRequestId: string | null = null;
  private _cachedUser: { id: string; role: string } | null = null;

  hasActiveContext(): boolean {
    try {
      return this.container?.isActive?.() ?? false;
    } catch {
      return false;
    }
  }

  getUser(): { id: string; role: string } | null {
    try {
      if (!this.hasActiveContext()) return null;
      const requestId = this.container?.get?.(REQUEST_ID) ?? null;
      if (requestId && requestId === this._cachedRequestId) return this._cachedUser;
      const user = this.container?.get?.(USER) ?? null;
      this._cachedRequestId = requestId;
      this._cachedUser = user;
      return user;
    } catch {
      return null;
    }
  }
}


export function Owned(token: OwnershipToken) {
  return function (target: Function) {
    Reflect.defineMetadata(OWNED_META, token, target);

    const proto = target.prototype;

    // ── Inject ScopeContext ──────────────────────────────────────────────
    Inject(ScopeContext)(proto, '_scopeCtx');

    // ── Shared user resolution ──────────────────────────────────────────
    function getUser(self: any): { id: string; role: string } | null {
      return (self._scopeCtx as ScopeContext | undefined)?.getUser() ?? null;
    }

    function hasActiveContext(self: any): boolean {
      return (self._scopeCtx as ScopeContext | undefined)?.hasActiveContext() ?? false;
    }

    function combineConditions(...conditions: any[]): any {
      const filtered = conditions.filter(Boolean);
      if (!filtered.length) return null;
      if (filtered.length === 1) return filtered[0];
      return and(...filtered);
    }

    function applyQueryOptions(
      query: any,
      opts: { where?: any; orderBy?: any; limit?: number } = {},
      whereCondition?: any,
    ) {
      let result = whereCondition ? query.where(whereCondition) : query;
      if (opts.orderBy) result = result.orderBy(opts.orderBy);
      if (opts.limit)   result = result.limit(opts.limit);
      return result;
    }

    // ── this.scope(query) ────────────────────────────────────────────────
    // Kept for backward compat — applies JOINs + WHERE in one shot.
    Object.defineProperty(proto, 'scope', {
      get(this: any) {
        return (query: any): any => {
          if (!hasActiveContext(this)) return query;
          const user = getUser(this);
          if (!user) return query.where(sql`1 = 0`);
          return token.applyScope(user.id, user.role, query);
        };
      },
      configurable: true,
      enumerable:   false,
    });

    // ── this.findMany(opts?) ─────────────────────────────────────────────
    if (!proto.findMany) {
      proto.findMany = async function (
        this: any,
        opts: { where?: any; orderBy?: any; limit?: number } = {},
      ) {
        if (!hasActiveContext(this)) {
          const base = this.db.select().from(token.table);
          return applyQueryOptions(base, opts, combineConditions(opts.where));
        }

        const user = getUser(this);
        if (!user) return [];

        const base = this.db.select().from(token.table);
        const { query: q, condition: scopeCondition } = token.applyScopeSplit(user.id, user.role, base);
        return applyQueryOptions(q, opts, combineConditions(scopeCondition, opts.where));
      };
    }

    // ── this.findOne(opts) ───────────────────────────────────────────────
    if (!proto.findOne) {
      proto.findOne = async function (
        this: any,
        opts: { where: any },
      ): Promise<any> {
        const rows = await this.findMany({ where: opts.where, limit: 1 });
        return rows[0] ?? null;
      };
    }

    // ── this.scopedQuery() ───────────────────────────────────────────────
    if (!proto.scopedQuery) {
      proto.scopedQuery = function (this: any) {
        return this.scope(this.db.select().from(token.table));
      };
    }
  };
}
