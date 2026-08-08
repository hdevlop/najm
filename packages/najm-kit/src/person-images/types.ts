/**
 * Person-image role contract.
 *
 * Resolver factories take a role map (`PersonImageRoleMap`) and return a
 * resolver that accepts a `PersonImageInput<Role>`. Roles are typed as a
 * generic string so each application declares its own role names and
 * TypeScript catches unknown role strings at the call site.
 */

/** The gender hint a caller attaches to a record. */
export type PersonImageGender = "F" | "M" | null;

/**
 * Per-role image configuration.
 *
 * `default` is required because the resolver must always return a string —
 * a role that has no female/male variant is valid, but a role that has no
 * default would force the resolver to invent a path at runtime.
 */
export interface PersonImageRoleDefinition {
  default: string;
  female?: string;
  male?: string;
}

/** A map of role name to its image definition. Keys are the role identifiers. */
export type PersonImageRoleMap = Record<string, PersonImageRoleDefinition>;

/** The roles najm-kit ships out of the box. */
export type BuiltInPersonImageRole = "child" | "adult" | "parent" | "family";

/**
 * The input a resolver takes.
 *
 * `image` is the value the record actually carries — typically a managed
 * storage URL or `null`/`undefined`. `role` selects which configured map entry
 * applies. `gender` selects the variant inside the role. `fallback` overrides
 * the per-call default and is itself overridden by a real `image`.
 */
export interface PersonImageInput<Role extends string> {
  image?: string | null;
  role: Role;
  gender?: PersonImageGender;
  fallback?: string | null;
}

/**
 * A resolver is a function from input to a usable image string.
 *
 * Built around the same input contract as `getPersonImage` so a custom
 * factory returned by `createPersonImageResolver` is interchangeable with the
 * built-in resolver at call sites.
 */
export type PersonImageResolver<Role extends string> = (
  input: PersonImageInput<Role>,
) => string;
