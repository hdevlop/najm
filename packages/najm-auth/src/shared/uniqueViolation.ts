/** Drivers may wrap SQL errors in one or more Drizzle errors. */
export function isUniqueViolation(error: unknown): boolean {
  const visited = new Set<unknown>();
  while (error && typeof error === 'object' && !visited.has(error)) {
    visited.add(error);
    const candidate = error as { code?: unknown; message?: unknown; cause?: unknown };
    if (candidate.code === '23505' || candidate.code === 'SQLITE_CONSTRAINT_UNIQUE'
      || candidate.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') return true;
    if (typeof candidate.message === 'string' && /unique constraint failed/i.test(candidate.message)) return true;
    error = candidate.cause;
  }
  return false;
}
