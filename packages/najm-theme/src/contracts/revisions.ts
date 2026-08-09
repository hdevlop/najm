// ============================================================================
// najm-theme/contracts — revisions
// ============================================================================
//
// Appearance and branding each carry a revision that increments by exactly one
// per committed mutation. A client sends back the revision it was editing, and
// the write commits only if that is still the current one.
//
// This is not optimistic locking for its own sake. Two administrators with the
// settings sheet open are the normal case, not the exotic one, and without a
// revision the second save silently discards the first — including a preset the
// first one just applied. With it, the second save fails cleanly and the UI can
// offer to reload.
//
// Appearance and branding hold separate revisions on purpose. Replacing a logo
// has nothing to do with editing a colour token, and one shared counter would
// make each mutation invalidate the other's open editor.
// ============================================================================

/** Every scope starts here, whether or not a row exists yet. */
export const INITIAL_THEME_REVISION = 1;

export function isThemeRevision(value: unknown): value is number {
  return (
    typeof value === "number"
    && Number.isSafeInteger(value)
    && value >= INITIAL_THEME_REVISION
  );
}

export function assertThemeRevision(value: unknown, label = "revision"): number {
  if (!isThemeRevision(value)) {
    throw new TypeError(`${label} must be a positive safe integer`);
  }
  return value;
}

/**
 * The next revision, or a throw at the safe-integer ceiling.
 *
 * Unreachable in practice — it is ~9e15 saves — but the alternative is silently
 * producing a value that compares equal to its predecessor, which is exactly
 * the comparison the conflict check depends on.
 */
export function nextThemeRevision(current: number): number {
  const next = assertThemeRevision(current) + 1;
  if (!Number.isSafeInteger(next)) {
    throw new RangeError("theme revision exceeded the safe integer range");
  }
  return next;
}

/** Which resource a conflict came from, so a UI can reload only that editor. */
export type ThemeRevisionResource = "appearance" | "branding";

/**
 * Raised inside the transaction, before any write.
 *
 * Carries both numbers because the client needs them: the difference between
 * "you are one save behind" and "you are looking at something ancient" changes
 * whether reloading is a courtesy or a requirement.
 */
export class ThemeRevisionConflictError extends Error {
  readonly resource: ThemeRevisionResource;
  readonly expectedRevision: number;
  readonly actualRevision: number;
  /** Consumed by the controller layer to answer 409 rather than 500. */
  readonly code = "THEME_REVISION_CONFLICT" as const;

  constructor(
    resource: ThemeRevisionResource,
    expectedRevision: number,
    actualRevision: number,
  ) {
    super(
      `${resource} was modified by someone else (expected revision ${expectedRevision}, found ${actualRevision})`,
    );
    this.name = "ThemeRevisionConflictError";
    this.resource = resource;
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

export function isThemeRevisionConflict(
  error: unknown,
): error is ThemeRevisionConflictError {
  return (
    error instanceof Error
    && (error as { code?: string }).code === "THEME_REVISION_CONFLICT"
  );
}
