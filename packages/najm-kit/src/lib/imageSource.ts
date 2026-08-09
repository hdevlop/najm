/**
 * Source selection for the three components that display a remote image with a
 * fallback: `NAvatar`, `NImage`, and `NNextImage` in `najm-kit/next`.
 *
 * Kept pure and framework-neutral on purpose. It knows nothing about Next, the
 * storage layer, authentication, or which routes an application protects — only
 * how to stamp a cache version onto a URL and which candidate to try next. The
 * React state that goes with it is `useImageChain`.
 *
 * The alternative was three components each maintaining a slightly different
 * fallback algorithm, which is exactly how one of them ended up never trying its
 * fallback at all.
 */

/**
 * `data:` and `blob:` URLs carry their bytes inline. A cache-busting query on
 * one is meaningless at best, and appending to a data URL changes the payload.
 */
const INLINE_SOURCE = /^(?:data|blob):/i;

/**
 * `src` with `?v=<version>` appended, or `src` unchanged for an absent version
 * or an inline source.
 *
 * `0` counts as a version. Only `null`, `undefined`, and the empty string mean
 * "no version" — a revision counter that starts at zero is a real thing, and
 * treating it as absent silently serves a stale image.
 */
export function withSrcVersion(
  src: string,
  version?: string | number | null,
): string {
  if (version === null || version === undefined || version === "") return src;
  if (INLINE_SOURCE.test(src)) return src;
  const separator = src.includes("?") ? "&" : "?";
  return `${src}${separator}v=${encodeURIComponent(String(version))}`;
}

/**
 * The candidates in preference order: blanks dropped, each version-stamped, and
 * duplicates collapsed.
 *
 * Collapsing matters. When a caller passes the same URL as both source and
 * fallback — which happens the moment a placeholder resolver is used for both —
 * an uncollapsed list would retry the identical failed URL instead of falling
 * through to the initials.
 */
export function normalizeImageSources(
  candidates: readonly (string | null | undefined)[],
  version?: string | number | null,
): string[] {
  const sources: string[] = [];
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (!trimmed) continue;
    const stamped = withSrcVersion(trimmed, version);
    if (!sources.includes(stamped)) sources.push(stamped);
  }
  return sources;
}

/** The first source not known to have failed, or `undefined` when all have. */
export function selectImageSource(
  sources: readonly string[],
  failed: readonly string[],
): string | undefined {
  return sources.find((source) => !failed.includes(source));
}
