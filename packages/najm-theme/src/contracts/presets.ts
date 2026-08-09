// ============================================================================
// najm-theme/contracts — theme presets
// ============================================================================
//
// A named, complete design an administrator can restore later. Presets are not
// patches: applying one replaces the whole design, because a preset that merged
// would produce a different result depending on what was already stored, and
// "restore the theme we agreed on in March" is the only thing anybody wants
// from this feature.
// ============================================================================

import type { NajmDesignConfig } from "najm-kit/server";

import { isThemeScopeId } from "./scope";

export interface PublicThemePreset {
  id: string;
  scopeId: string;
  slug: string;
  name: string;
  designConfig: NajmDesignConfig;
  /** Marks a preset the application shipped rather than one a user created. */
  isBuiltIn: boolean;
  /** ISO 8601. */
  createdAt: string;
}

export interface CreateThemePresetInput {
  name: string;
  designConfig: NajmDesignConfig;
}

export const THEME_PRESET_NAME_MAX_LENGTH = 80;
export const THEME_PRESET_SLUG_MAX_LENGTH = 96;

/**
 * How many presets one scope may hold.
 *
 * A ceiling rather than a preference: the list is read on every settings open
 * and each row carries a whole design, so an unbounded library turns one screen
 * into a multi-megabyte response.
 */
export const DEFAULT_MAX_THEME_PRESETS = 50;
export const MAX_THEME_PRESETS_CEILING = 500;

export function assertThemePresetName(value: unknown, label = "name"): string {
  if (typeof value !== "string") throw new TypeError(`${label} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new TypeError(`${label} must not be blank`);
  if (trimmed.length > THEME_PRESET_NAME_MAX_LENGTH) {
    throw new TypeError(`${label} must be at most ${THEME_PRESET_NAME_MAX_LENGTH} characters`);
  }
  return trimmed;
}

/**
 * A stable, URL-safe key for a preset name — in any script.
 *
 * The naive `[^a-z0-9]` slug is why so many systems turn "مظهر الشتاء" and
 * "Тёмная тема" into the same empty string, and then into `preset-1` and
 * `preset-2` with no relation to what anybody typed. Here `\p{L}` and `\p{N}`
 * keep every alphabet, so Arabic, Cyrillic, and CJK names slug to themselves.
 *
 * NFKC first, so two names that look identical — a composed `é` and an `e` plus
 * a combining accent — cannot both be inserted past the unique index and then
 * be indistinguishable in the list.
 *
 * Case folding is `toLowerCase()` only. Locale-aware lowercasing would make the
 * same name slug differently depending on the server's locale, which is exactly
 * the kind of drift a stored key must not have.
 */
export function themePresetSlug(name: string): string {
  const normalized = name.normalize("NFKC").toLowerCase();

  const slug = Array.from(normalized)
    .map((character) => (/[\p{L}\p{N}]/u.test(character) ? character : "-"))
    .join("")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, THEME_PRESET_SLUG_MAX_LENGTH)
    // A trailing dash can reappear after the slice.
    .replace(/-+$/u, "");

  // Reachable — a name of nothing but punctuation ("!!!") normalizes away
  // entirely. The caller disambiguates; returning an empty string here and
  // letting it hit the unique index would surface as a database error.
  return slug;
}

export function isThemePresetSlug(value: unknown): value is string {
  return (
    typeof value === "string"
    && value.length > 0
    && value.length <= THEME_PRESET_SLUG_MAX_LENGTH
  );
}

/**
 * Appends `-2`, `-3`, … until the slug is free within its scope.
 *
 * Also the fallback for a name that slugs to nothing: `themePresetSlug("!!!")`
 * is `""`, and `"preset"` is a better key than a database constraint error.
 *
 * Advisory, not the guarantee. The unique index is the guarantee — two requests
 * can both pass this check and only one insert survives, which is the correct
 * outcome and why the service retries rather than trusting the pre-check.
 */
export function uniqueThemePresetSlug(
  base: string,
  taken: ReadonlySet<string>,
): string {
  const root = base || "preset";
  if (!taken.has(root)) return root;

  for (let suffix = 2; suffix < 1_000; suffix += 1) {
    const candidate = `${root.slice(0, THEME_PRESET_SLUG_MAX_LENGTH - 5)}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }

  throw new RangeError(`could not derive a unique slug for "${base}"`);
}

/** Narrows one row of a presets response. Used by transport and tests alike. */
export function isPublicThemePreset(value: unknown): value is PublicThemePreset {
  if (typeof value !== "object" || value === null) return false;
  const preset = value as Record<string, unknown>;
  return (
    typeof preset.id === "string"
    && isThemeScopeId(preset.scopeId)
    && isThemePresetSlug(preset.slug)
    && typeof preset.name === "string"
    && typeof preset.isBuiltIn === "boolean"
    && typeof preset.createdAt === "string"
    && typeof preset.designConfig === "object"
    && preset.designConfig !== null
  );
}
