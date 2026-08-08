/**
 * The placeholder an avatar source may carry instead of being absent.
 *
 * Backends that seed a default rather than a null return this path, so "no
 * picture" arrives as a string and the usual empty check passes it through —
 * the application then renders a stock file where it meant to render its own
 * fallback. Matched as a path segment with an optional query or fragment, since
 * it shows up as `noavatar.png`, `/uploads/noavatar.png` and `…?v=3` alike.
 */
const PLACEHOLDER_AVATAR = /(^|\/)noavatar\.png(?:$|[?#])/i;

/** True when `src` is absent, blank, or the seeded placeholder. */
export function isPlaceholderAvatar(src: string | null | undefined): boolean {
  const trimmed = src?.trim() ?? "";
  return !trimmed || PLACEHOLDER_AVATAR.test(trimmed);
}

/**
 * The image to render, or `fallback` when there is no real one.
 *
 * ```ts
 * resolveAvatarSrc(child.image, childPlaceholder(child.gender))
 * ```
 *
 * The fallback is a parameter rather than a package default because which stock
 * image belongs to a record is the application's to decide — a child, a family
 * and a sponsor do not share one. What is shared is the question of whether the
 * stored value counts as an image at all, which is all this answers.
 */
export function resolveAvatarSrc<Fallback extends string | null | undefined>(
  src: string | null | undefined,
  fallback: Fallback,
): string | Fallback {
  const trimmed = src?.trim() ?? "";
  return trimmed && !PLACEHOLDER_AVATAR.test(trimmed) ? trimmed : fallback;
}
