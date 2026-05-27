export type Resolved<T> =
  | { kind: 'found'; entity: T }
  | { kind: 'not_found'; query: string }
  | { kind: 'ambiguous'; query: string; matches: Array<{ id: string; label: string }> };

export function normalizeResolutionQuery(query: string): string {
  return query.trim();
}

export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function pickSingle<T extends { id: string }>(
  rows: T[],
  query: string,
  labelFn: (row: T) => string,
): Resolved<T> {
  if (rows.length === 0) return { kind: 'not_found', query };
  if (rows.length === 1) return { kind: 'found', entity: rows[0] };
  return {
    kind: 'ambiguous',
    query,
    matches: rows.map((r) => ({ id: r.id, label: labelFn(r) })),
  };
}

export async function resolveBy<T extends { id: string }>(
  query: string,
  options: {
    findById?: (id: string) => Promise<T | undefined>;
    findExact?: (query: string) => Promise<T | undefined>;
    search: (query: string) => Promise<T[]>;
    label: (entity: T) => string;
  },
): Promise<Resolved<T>> {
  const trimmed = normalizeResolutionQuery(query);
  if (!trimmed) return { kind: 'not_found', query };

  const byId = await options.findById?.(trimmed);
  if (byId) return { kind: 'found', entity: byId };

  const exact = await options.findExact?.(trimmed);
  if (exact) return { kind: 'found', entity: exact };

  const results = await options.search(trimmed);
  return pickSingle(results, trimmed, options.label);
}
