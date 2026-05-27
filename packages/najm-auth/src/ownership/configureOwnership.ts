import { Injectable, Inject, User, Body, Params } from 'najm-core';
import { createGuard, composeGuards, type GuardResult } from 'najm-guard';
import { Can } from '../permissions';
import { isAdmin } from '../roles';
import { OwnershipToken } from './scopedOwnership';

// ── Types ─────────────────────────────────────────────────────────────────

export interface OwnershipProvider {
  canAccess(user: any, resourceType: string, resourceId: string): Promise<boolean>;
  getAccessibleIds(user: any, resourceType: string): Promise<string[] | 'ALL'>;
}

export interface ResourceGuardsOptions {
  adminGuard?: () => ClassDecorator & MethodDecorator;
  singular?: string;
}

export interface ResourceGuards {
  canRead: () => ClassDecorator & MethodDecorator;
  canUpdate: () => ClassDecorator & MethodDecorator;
  canCreate: () => ClassDecorator & MethodDecorator;
  canDelete: () => ClassDecorator & MethodDecorator;
  canList: () => ClassDecorator & MethodDecorator;
}

export type OwnershipResolver = (userId: string) => Promise<string[]>;
export type OwnershipRule = OwnershipResolver | OwnershipToken;
export type OwnershipRules = Record<string, Record<string, OwnershipRule>>;

export interface OwnershipConfig {
  adminRoles: string[];
  adminGuard?: () => ClassDecorator & MethodDecorator;
  rules: OwnershipRules;
  cacheTtl?: number;
  cacheMax?: number;
  db?: any | (() => any);
}

export type ChainableGuard = {
  (): ClassDecorator & MethodDecorator;
  body(type: string, field: string, optional?: boolean): ChainableGuard;
  and(guard: () => ClassDecorator & MethodDecorator): ChainableGuard;
};

export interface ResourceAccessor {
  readonly read:   ChainableGuard;
  readonly update: ChainableGuard;
  readonly create: ChainableGuard;
  readonly delete: ChainableGuard;
  readonly list:   ChainableGuard;
}

export interface ConfiguredOwnership {
  Service: new (...args: any[]) => OwnershipProvider & { clearCache(userId?: string): void };
  for(resource: string, options?: ResourceGuardsOptions): ResourceAccessor;
  guards(resource: string, options?: ResourceGuardsOptions): ResourceGuards;
  bodyGuard(resourceType: string, bodyField: string, optional?: boolean): () => ClassDecorator & MethodDecorator;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function toSingular(plural: string): string {
  if (plural.endsWith('ies')) return plural.slice(0, -3) + 'y';
  if (plural.endsWith('ses') || plural.endsWith('xes') || plural.endsWith('zes') || plural.endsWith('ches') || plural.endsWith('shes')) {
    return plural.slice(0, -2);
  }
  if (plural.endsWith('s') && !plural.endsWith('ss')) return plural.slice(0, -1);
  return plural;
}

function createResourceGuards<T extends new (...args: any[]) => OwnershipProvider>(
  ownershipClass: T,
  resourceType: string,
  resource: string,
  options?: ResourceGuardsOptions,
): ResourceGuards {
  const writeGuard = options?.adminGuard ?? isAdmin;

  @Injectable()
  class AccessGuard {
    @Inject(ownershipClass) private ownership!: OwnershipProvider;

    async canActivate(
      @User() user: any,
      @Params('id') id: string,
    ): Promise<GuardResult | false> {
      const allowed = await this.ownership.canAccess(user, resourceType, id);
      return allowed ? { owner: user } : false;
    }
  }

  @Injectable()
  class ListGuard {
    @Inject(ownershipClass) private ownership!: OwnershipProvider;

    async canActivate(@User() user: any): Promise<GuardResult | false> {
      const ids = await this.ownership.getAccessibleIds(user, resourceType);
      return { filter: ids };
    }
  }

  const access = createGuard(AccessGuard);
  const list = createGuard(ListGuard);

  return {
    canRead:   composeGuards(Can(`read:${resource}`),   access()),
    canUpdate: composeGuards(Can(`update:${resource}`), access()),
    canCreate: composeGuards(Can(`create:${resource}`), writeGuard()),
    canDelete: composeGuards(Can(`delete:${resource}`), writeGuard()),
    canList:   composeGuards(Can(`read:${resource}`),   list()),
  };
}

// ── Factory ───────────────────────────────────────────────────────────────

export function configureOwnership(config: OwnershipConfig): ConfiguredOwnership {
  const { adminRoles, rules, cacheTtl = 60_000, cacheMax = 10_000, adminGuard: defaultAdminGuard = isAdmin } = config;

  const normalizedRules: Record<string, Record<string, OwnershipResolver>> = {};

  for (const [role, resources] of Object.entries(rules)) {
    normalizedRules[role] = {};
    for (const [resource, rule] of Object.entries(resources)) {
      if (rule instanceof OwnershipToken) {
        const token = rule;
        normalizedRules[role][resource] = async (userId: string) => {
          if (!config.db) {
            throw new Error(
              `configureOwnership: OwnershipToken "${token.name}" used as a rule requires the 'db' config option. ` +
              `Either provide a Drizzle database instance, or use a resolver function instead.`
            );
          }
          const db = typeof config.db === 'function' ? config.db() : config.db;
          const idCol = token.table.id;
          if (!idCol) {
            throw new Error(
              `configureOwnership: OwnershipToken "${token.name}" table must have an 'id' column to be used as a rule.`
            );
          }
          const scoped = token.applyScope(userId, role, db.select({ id: idCol }).from(token.table));
          const rows: { id: any }[] = await scoped;
          return rows.map(r => String(r.id));
        };
      } else {
        normalizedRules[role][resource] = rule;
      }
    }
  }

  type CacheEntry = { ids: Set<string> | 'ALL'; timestamp: number };

  @Injectable()
  class GeneratedOwnershipService implements OwnershipProvider {
    // Two-level cache: userId → (role\0resource → entry) for O(1) user invalidation
    private cache = new Map<string, Map<string, CacheEntry>>();
    private cacheSize = 0;

    async getAccessibleIds(user: any, resourceType: string): Promise<string[] | 'ALL'> {
      if (adminRoles.includes(user.role)) return 'ALL';

      const subKey = `${user.role}\0${resourceType}`;
      const cached = this.getCache(user.id, subKey);
      if (cached) return cached === 'ALL' ? 'ALL' : [...cached];

      const resolver = normalizedRules[user.role]?.[resourceType];
      if (!resolver) return [];

      const ids = await resolver(user.id);
      const idSet = new Set(ids.map(String));
      this.setCache(user.id, subKey, idSet);
      return ids;
    }

    async canAccess(user: any, resourceType: string, resourceId: string): Promise<boolean> {
      if (adminRoles.includes(user.role)) return true;

      const subKey = `${user.role}\0${resourceType}`;
      const cached = this.getCache(user.id, subKey);
      if (cached) return cached === 'ALL' || cached.has(String(resourceId));

      // Resolve and cache, then do O(1) Set lookup
      const resolver = normalizedRules[user.role]?.[resourceType];
      if (!resolver) return false;

      const ids = await resolver(user.id);
      const idSet = new Set(ids.map(String));
      this.setCache(user.id, subKey, idSet);
      return idSet.has(String(resourceId));
    }

    clearCache(userId?: string): void {
      if (userId) {
        const userMap = this.cache.get(userId);
        if (userMap) {
          this.cacheSize -= userMap.size;
          this.cache.delete(userId);
        }
      } else {
        this.cache.clear();
        this.cacheSize = 0;
      }
    }

    private getCache(userId: string, subKey: string): Set<string> | 'ALL' | null {
      const userMap = this.cache.get(userId);
      if (!userMap) return null;
      const entry = userMap.get(subKey);
      if (!entry) return null;
      if (Date.now() - entry.timestamp > cacheTtl) {
        userMap.delete(subKey);
        this.cacheSize--;
        if (userMap.size === 0) this.cache.delete(userId);
        return null;
      }
      // LRU: refresh position in user map
      userMap.delete(subKey);
      userMap.set(subKey, entry);
      return entry.ids;
    }

    private setCache(userId: string, subKey: string, ids: Set<string> | 'ALL'): void {
      if (this.cacheSize >= cacheMax) this.evictOldest();
      let userMap = this.cache.get(userId);
      if (!userMap) {
        userMap = new Map();
        this.cache.set(userId, userMap);
      }
      if (!userMap.has(subKey)) this.cacheSize++;
      userMap.set(subKey, { ids, timestamp: Date.now() });
    }

    private evictOldest(): void {
      for (const [userId, userMap] of this.cache) {
        const firstKey = userMap.keys().next().value;
        if (firstKey !== undefined) {
          userMap.delete(firstKey);
          this.cacheSize--;
          if (userMap.size === 0) this.cache.delete(userId);
          return;
        }
      }
    }
  }

  function bodyGuard(resourceType: string, bodyField: string, optional = false) {
    @Injectable()
    class BodyAccessGuard {
      @Inject(GeneratedOwnershipService) private ownership!: GeneratedOwnershipService;

      async canActivate(@User() user: any, @Body() body: any): Promise<boolean> {
        const id = body[bodyField];
        if (!id) return optional;
        return this.ownership.canAccess(user, resourceType, id);
      }
    }

    return createGuard(BodyAccessGuard);
  }

  function makeChainable(decorators: (ClassDecorator & MethodDecorator)[]): ChainableGuard {
    return Object.assign(
      () => composeGuards(...decorators)(),
      {
        body(type: string, field: string, optional = false): ChainableGuard {
          return makeChainable([...decorators, bodyGuard(type, field, optional)()]);
        },
        and(guard: () => ClassDecorator & MethodDecorator): ChainableGuard {
          return makeChainable([...decorators, guard()]);
        },
      },
    ) as ChainableGuard;
  }

  function guards(resource: string, options?: ResourceGuardsOptions): ResourceGuards {
    const merged: ResourceGuardsOptions = { adminGuard: defaultAdminGuard, ...options };
    const singular = merged.singular ?? toSingular(resource);
    return createResourceGuards(GeneratedOwnershipService as any, singular, resource, merged);
  }

  function for_(resource: string, options?: ResourceGuardsOptions): ResourceAccessor {
    const base = guards(resource, options);
    return {
      get read()   { return makeChainable([base.canRead()]); },
      get update() { return makeChainable([base.canUpdate()]); },
      get create() { return makeChainable([base.canCreate()]); },
      get delete() { return makeChainable([base.canDelete()]); },
      get list()   { return makeChainable([base.canList()]); },
    };
  }

  return {
    Service: GeneratedOwnershipService,
    for: for_,
    guards,
    bodyGuard,
  };
}
