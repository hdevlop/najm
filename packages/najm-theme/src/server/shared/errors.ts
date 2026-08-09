// ============================================================================
// najm-theme/server — domain errors as HTTP answers
// ============================================================================

import { BaseError, Err } from "najm-core";

import { isThemeRevisionConflict } from "../../contracts/revisions";

/** The response `code` a client matches on to know it must reload and retry. */
export const THEME_CONFLICT_CODE = "THEME_REVISION_CONFLICT";

/**
 * A resource that is genuinely absent — or absent *from this scope*, which the
 * caller must not be able to tell apart. `findInScope` returning nothing means
 * the preset does not exist here; whether it exists for some other tenant is
 * not something a 404 should disclose.
 */
export class ThemeNotFoundError extends Error {
  readonly code = "THEME_NOT_FOUND" as const;
  constructor(message: string) {
    super(message);
    this.name = "ThemeNotFoundError";
  }
}

/**
 * The request was well-formed, the caller was authorized, and the package still
 * refuses — deleting a built-in preset when the installation disallows it.
 *
 * Distinct from a guard denial: nothing about the caller's identity would make
 * this succeed, so it is not something to re-authenticate for.
 */
export class ThemePolicyError extends Error {
  readonly code = "THEME_POLICY" as const;
  constructor(message: string) {
    super(message);
    this.name = "ThemePolicyError";
  }
}

/**
 * Maps a domain failure onto a status a client can act on.
 *
 * The three outcomes are genuinely different actions, which is why they are
 * three statuses rather than one 400:
 *
 * - 409: the payload was fine, the world moved. Reload and try again.
 * - 400: the payload was not fine. Retrying it changes nothing.
 * - anything else: not ours. Rethrown untouched so a database outage stays a
 *   500 instead of being mislabelled as the client's fault.
 *
 * The conflict body carries `code` but not the two revision numbers. A client
 * that hit a conflict has to re-read the resource anyway — the revision it
 * would learn here is already stale by the time it acts on it — so the useful
 * signal is "reload", and shipping the numbers would only invite a client to
 * skip the reload and patch its local state.
 */
export function toThemeHttpError(error: unknown): never {
  if (isThemeRevisionConflict(error)) {
    throw new BaseError(THEME_CONFLICT_CODE, error.message, 409);
  }

  if (error instanceof ThemeNotFoundError) return Err.notFound(error.message);
  if (error instanceof ThemePolicyError) return Err.forbidden(error.message);

  // Every validation failure in this package throws `TypeError` with a path, or
  // `RangeError` for a bound. Both are the caller's problem.
  if (error instanceof TypeError || error instanceof RangeError) {
    return Err.badRequest(error.message);
  }

  throw error;
}

/**
 * Runs a domain call and translates whatever it throws.
 *
 * Wrapping at the controller keeps services free of transport concerns: a
 * service raises `ThemeRevisionConflictError`, and the MCP tools and the REST
 * controllers each decide what that means in their own protocol.
 */
export async function asHttp<T>(body: () => Promise<T>): Promise<T> {
  try {
    return await body();
  } catch (error) {
    return toThemeHttpError(error);
  }
}
