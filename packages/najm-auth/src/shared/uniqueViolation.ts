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

/**
 * The `users_email_or_phone` check: a write that would leave an account with
 * neither an email nor a phone. The service refuses that first; this is the
 * database answering a write that raced past it.
 */
export function isMissingIdentityViolation(error: unknown): boolean {
  const visited = new Set<unknown>();
  while (error && typeof error === 'object' && !visited.has(error)) {
    visited.add(error);
    const candidate = error as { code?: unknown; message?: unknown; constraint?: unknown; constraint_name?: unknown; cause?: unknown };
    const constraint = candidate.constraint ?? candidate.constraint_name;
    if (constraint === 'users_email_or_phone') return true;
    if (typeof candidate.message === 'string' && candidate.message.includes('users_email_or_phone')) return true;
    error = candidate.cause;
  }
  return false;
}
