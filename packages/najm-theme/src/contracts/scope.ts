// ============================================================================
// najm-theme/contracts — scope
// ============================================================================
//
// Every stored row is keyed by a scope. A single-platform application has
// exactly one — `"platform"` — and never thinks about this again. An
// application that later grows tenants resolves a tenant identifier here
// instead, and no table, index, or route changes: the column already exists and
// is already part of the preset uniqueness constraint.
//
// That is the whole reason scope is in the contract from the first release
// rather than added when it is needed. Retrofitting a discriminator onto
// deployed rows means a migration, a backfill, and a window where two
// deployments disagree about which rows are whose.
// ============================================================================

/** The scope every single-platform application uses. */
export const DEFAULT_THEME_SCOPE_ID = "platform";

/**
 * Longer than any sane tenant key and short enough to index. Also bounds what
 * can reach a storage path, since assets are namespaced per scope.
 */
export const THEME_SCOPE_ID_MAX_LENGTH = 64;

/**
 * Deliberately narrower than "any string": a scope identifier ends up in a
 * storage namespace and a URL path, so `.`, `/`, and `\` are excluded rather
 * than escaped at each of the several places they would otherwise travel.
 */
const SCOPE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

export interface ThemeScopeContext {
  /**
   * The inbound request, as the web standard type.
   *
   * Enough for the two things a resolver actually needs — a header and a host —
   * without pulling Hono, Node, or a framework context into a universal entry.
   */
  request: Request;
  /** The authenticated actor, when the application resolved one. */
  actorId?: string | null;
}

/**
 * Answers "whose theme is this request asking about?".
 *
 * Sync or async; async so a resolver may look a subdomain up. It runs on every
 * themed request, so a resolver that queries a database should cache.
 */
export type ThemeScopeResolver = (
  context: ThemeScopeContext,
) => string | Promise<string>;

export function isThemeScopeId(value: unknown): value is string {
  return (
    typeof value === "string"
    && value.length > 0
    && value.length <= THEME_SCOPE_ID_MAX_LENGTH
    && SCOPE_ID_PATTERN.test(value)
  );
}

/**
 * Throws rather than coercing.
 *
 * A scope that silently normalizes is a scope that can collide: `acme/` and
 * `acme` becoming one key means one tenant reading another's branding.
 */
export function assertThemeScopeId(value: unknown, label = "scopeId"): string {
  if (!isThemeScopeId(value)) {
    throw new TypeError(
      `${label} must be 1-${THEME_SCOPE_ID_MAX_LENGTH} characters of [A-Za-z0-9_-], starting with a letter or digit`,
    );
  }
  return value;
}

/** The resolver a single-platform application gets without configuring one. */
export const platformScope: ThemeScopeResolver = () => DEFAULT_THEME_SCOPE_ID;
