// ============================================================================
// safeRedirect — open-redirect guard for `?next=` parameters
// ============================================================================

const DEFAULT_BLOCKED_PREFIXES = ['/api', '/login', '/_next'];

const ASSET_EXTENSIONS =
  /\.(?:css|gif|ico|jpe?g|js|json|map|png|svg|webmanifest|webp)$/i;

export interface SafeRedirectOptions {
  /** Where to send anything rejected. Defaults to `/dashboard`. */
  fallback?: string;
  /**
   * Path prefixes that are never a valid destination. Defaults to `/api`,
   * `/login` and `/_next`.
   *
   * `/login` is on the list because bouncing back to it is the redirect loop
   * this parameter causes most often: a user who just authenticated is sent
   * straight back to the form they came from.
   */
  blockedPrefixes?: string[];
}

/**
 * Reduces an untrusted `?next=` value to a path that is safe to redirect to.
 *
 * Only same-origin *paths* survive. An absolute URL is rejected outright rather
 * than parsed and compared, because the comparison is where this goes wrong:
 * `//evil.test` is a protocol-relative URL that browsers resolve off-site while
 * a naive `startsWith('/')` check reads it as local. Anything that is not a
 * single leading slash followed by a path is refused.
 *
 * ```ts
 * redirect(getSafeRedirectPath(searchParams.next, { fallback: '/home' }));
 * ```
 */
export function getSafeRedirectPath(
  value: string | string[] | undefined | null,
  options: SafeRedirectOptions | string = {},
): string {
  // A bare string keeps the common `getSafeRedirectPath(next, '/home')` call
  // short; the object form is for anything else.
  const {
    fallback = '/dashboard',
    blockedPrefixes = DEFAULT_BLOCKED_PREFIXES,
  } = typeof options === 'string' ? { fallback: options } : options;

  const path = Array.isArray(value) ? value[0] : value;

  if (
    !path ||
    !path.startsWith('/') ||
    // Protocol-relative: the browser treats `//host/x` as off-site.
    path.startsWith('//') ||
    // A backslash is normalized to a forward slash by some browsers, so
    // `/\evil.test` is another way to spell the case above.
    path.startsWith('/\\') ||
    blockedPrefixes.some((prefix) => path.startsWith(prefix)) ||
    ASSET_EXTENSIONS.test(path.split('?')[0] ?? path)
  ) {
    return fallback;
  }

  return path;
}
