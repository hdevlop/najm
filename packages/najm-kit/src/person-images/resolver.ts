import { resolveAvatarSrc } from "../lib/avatar";
import { BUILT_IN_PERSON_IMAGE_ROLES } from "./builtIn";
import type {
  BuiltInPersonImageRole,
  PersonImageInput,
  PersonImageGender,
  PersonImageResolver,
  PersonImageRoleMap,
} from "./types";

/**
 * Pick a variant out of a role definition.
 *
 * Female → `female`; male → `male`; missing or null → `default`. If the chosen
 * variant is absent, fall back to the role's required `default` — never
 * throw, never return a partial path.
 */
function pickVariant(
  definition: { default: string; female?: string; male?: string },
  gender: PersonImageGender,
): string {
  if (gender === "F") return definition.female ?? definition.default;
  if (gender === "M") return definition.male ?? definition.default;
  return definition.default;
}

/**
 * The shared resolution contract.
 *
 * Both the built-in `getPersonImage` and every factory-returned resolver go
 * through this. Precedence is the package's and the plan's:
 *
 * 1. A real `image` (passes `resolveAvatarSrc`).
 * 2. A per-call `fallback` that is not a `noavatar.png` sentinel.
 * 3. The role's gender variant, defaulting to the role's `default` when the
 *    variant or the gender is missing.
 *
 * The per-call fallback is treated like a real image: an empty string, the
 * `noavatar.png` sentinel, or a blank trimmed value all fall through to the
 * role's default. That keeps a call site that wants to opt out of its own
 * fallback (a card that prefers the package default over a partial record)
 * honest.
 */
function resolvePersonImage<Role extends string>(
  input: PersonImageInput<Role>,
  map: PersonImageRoleMap,
): string {
  const trimmedImage = input.image?.trim() ?? "";
  if (trimmedImage) {
    const preserved = resolveAvatarSrc(trimmedImage, null);
    if (preserved) return preserved;
  }

  const trimmedFallback = input.fallback?.trim() ?? "";
  if (trimmedFallback) {
    const preserved = resolveAvatarSrc(trimmedFallback, null);
    if (preserved) return preserved;
  }

  const definition = map[input.role];
  if (definition) {
    return pickVariant(definition, input.gender ?? null);
  }

  const trimmedImageForReturn = trimmedImage || trimmedFallback;
  if (trimmedImageForReturn) return trimmedImageForReturn;

  const family = map["family"];
  if (family) return pickVariant(family, input.gender ?? null);

  for (const value of Object.values(map)) {
    if (value) return pickVariant(value, input.gender ?? null);
  }

  return "";
}

/**
 * The built-in resolver, typed against the four roles najm-kit ships.
 *
 * ```ts
 * const src = getPersonImage({
 *   image: child.image,
 *   role: "child",
 *   gender: child.gender,
 * });
 * ```
 *
 * The four built-in roles are `child`, `adult`, `parent`, and `family`. Any
 * other role string is a type error — applications that need more roles
 * compose their own resolver with `createPersonImageResolver`.
 */
export const getPersonImage: PersonImageResolver<BuiltInPersonImageRole> = (
  input,
) => resolvePersonImage(input, BUILT_IN_PERSON_IMAGE_ROLES);

/**
 * Build a resolver that accepts an application-extended set of role names.
 *
 * The custom map is merged on top of the built-in map, so a key like
 * `teacher` is added while a key like `child` is replaced when the
 * application wants to override the built-in asset. The role union of the
 * returned resolver is the union of the custom keys and the built-in keys
 * that the custom map did not override, so TypeScript still flags unknown
 * role strings at the call site.
 */
export function createPersonImageResolver<
  Custom extends Record<string, { default: string; female?: string; male?: string }>,
>(
  custom: Custom,
): PersonImageResolver<keyof Custom & string | Exclude<BuiltInPersonImageRole, keyof Custom>> {
  const map: PersonImageRoleMap = {
    ...BUILT_IN_PERSON_IMAGE_ROLES,
    ...custom,
  };
  const resolver = ((input: PersonImageInput<string>) =>
    resolvePersonImage(input, map)) as PersonImageResolver<
    keyof Custom & string | Exclude<BuiltInPersonImageRole, keyof Custom>
  >;
  return resolver;
}
