import type { QueryKey } from "@tanstack/react-query";

export type EntityKeyId = string | number;
export type EntityKeyFilters = Readonly<Record<string, unknown>>;

/** Shared, deterministic key shapes for entity-backed query caches. */
export const entityKeys = {
  all(entity: string): QueryKey {
    return [entity];
  },
  list(entity: string, filters?: EntityKeyFilters): QueryKey {
    return filters ? [entity, "list", filters] : [entity, "list"];
  },
  detail(entity: string, id: EntityKeyId): QueryKey {
    return [entity, "detail", id];
  },
};

/** Binds the entity namespace once while leaving feature-specific keys local. */
export function createEntityKeys(entity: string) {
  if (!entity.trim()) {
    throw new TypeError("najm-kit/query/keys: entity must not be empty");
  }

  return Object.freeze({
    all: entityKeys.all(entity),
    list: (filters?: EntityKeyFilters) => entityKeys.list(entity, filters),
    detail: (id: EntityKeyId) => entityKeys.detail(entity, id),
  });
}
