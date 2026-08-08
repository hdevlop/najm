/**
 * Public entry for `najm-kit/person-images`.
 *
 * Reusable person-image resolution, framework-neutral: no React, no Next,
 * no DOM. The built-in resolver and the `createPersonImageResolver` factory
 * accept role names an application declares, and the built-in map ships
 * assets for `child`, `adult`, `parent`, and `family`. Real uploaded
 * images take precedence over every fallback; the `noavatar.png` sentinel,
 * blanks, and missing values resolve to the configured default.
 */
export {
  createPersonImageResolver,
  getPersonImage,
} from "./resolver";
export type {
  BuiltInPersonImageRole,
  PersonImageGender,
  PersonImageInput,
  PersonImageResolver,
  PersonImageRoleDefinition,
  PersonImageRoleMap,
} from "./types";
export { BUILT_IN_PERSON_IMAGE_ROLES } from "./builtIn";
