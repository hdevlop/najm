// ============================================================================
// najm-core/env - Readers for environment variables
// ============================================================================

/**
 * The caller reads `process.env.NAME` literally and passes the value in, with
 * the name for the error message. A reader never looks a name up itself, so
 * every variable an application uses stays a plain, greppable read the
 * bundler can see.
 *
 * Unset and blank mean "use the default". A value that is set but malformed
 * throws an error naming the variable, instead of reaching a plugin as `NaN`
 * or a silently ignored typo.
 *
 * This module has no imports, so it is safe in any server entrypoint,
 * including one a bundler evaluates at build time.
 */

export const isProduction = (): boolean => process.env.NODE_ENV === 'production';

/** The trimmed value, or `undefined` when unset or blank. */
export function envString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

/**
 * The trimmed value; throws `${name} is required ${reason}.` when it is unset
 * or blank. `reason` completes the sentence, e.g. `'when EMAIL_PROVIDER is resend'`.
 */
export function requireEnv(name: string, value: string | undefined, reason: string): string {
  const resolved = envString(value);
  if (!resolved) throw new Error(`${name} is required ${reason}.`);
  return resolved;
}

/** `1` and `true` (any case) turn a flag on; anything else leaves it off. */
export function envFlag(value: string | undefined): boolean {
  const resolved = envString(value)?.toLowerCase();
  return resolved === '1' || resolved === 'true';
}

export interface EnvIntOptions {
  /** Returned when the variable is unset or blank. */
  fallback: number;
  /** Smallest accepted value (default 0). Negative values are never accepted. */
  min?: number;
  /** Largest accepted value (default `Number.MAX_SAFE_INTEGER`). */
  max?: number;
}

/** A non-negative decimal integer within `[min, max]`, or `fallback` when unset or blank. */
export function envInt(
  name: string,
  value: string | undefined,
  { fallback, min = 0, max = Number.MAX_SAFE_INTEGER }: EnvIntOptions,
): number {
  const resolved = envString(value);
  if (resolved === undefined) return fallback;

  const parsed = /^\d+$/.test(resolved) ? Number(resolved) : NaN;
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    const range = max === Number.MAX_SAFE_INTEGER ? `${min} or more` : `from ${min} to ${max}`;
    throw new Error(`${name} must be an integer ${range}.`);
  }
  return parsed;
}

/** One of `choices`, compared lower-cased, or `fallback` when unset or blank. */
export function envChoice<const T extends string>(
  name: string,
  value: string | undefined,
  choices: readonly T[],
  fallback: T,
): T {
  const resolved = envString(value)?.toLowerCase();
  if (resolved === undefined) return fallback;
  if (!(choices as readonly string[]).includes(resolved)) {
    throw new Error(`${name} must be one of: ${choices.join(', ')}. Got '${resolved}'.`);
  }
  return resolved as T;
}
