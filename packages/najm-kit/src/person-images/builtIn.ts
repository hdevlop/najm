import adultFemale from "./assets/adult-female.webp";
import adultMale from "./assets/adult-male.webp";
import childFemale from "./assets/child-female.webp";
import childMale from "./assets/child-male.webp";
import family from "./assets/family.webp";
import parentFemale from "./assets/parent-female.webp";
import parentMale from "./assets/parent-male.webp";

import type { PersonImageRoleDefinition, PersonImageRoleMap } from "./types";

/**
 * The default person-image map packaged with najm-kit.
 *
 * Each role is required to have a `default` so a resolver never has to invent
 * a path on the fly: gender is a refinement, not a prerequisite. Female and
 * male variants are optional — when a role is genderless (a household, a
 * neutral family) the same default is used for every gender.
 *
 * The sponsor artwork is intentionally reused as the generic adult artwork:
 * sponsors, staff, applicants, teachers without custom assets, and delivery
 * staff all share the same neutral adult portrait, and the public contract
 * names the role `adult` rather than `sponsor` so other applications can
 * adopt it without re-importing Kafil's vocabulary.
 */
export const BUILT_IN_PERSON_IMAGE_ROLES: PersonImageRoleMap = {
  child: {
    default: childMale,
    female: childFemale,
    male: childMale,
  },
  adult: {
    default: adultMale,
    female: adultFemale,
    male: adultMale,
  },
  parent: {
    default: parentMale,
    female: parentFemale,
    male: parentMale,
  },
  family: {
    default: family,
  },
} as const satisfies Record<string, PersonImageRoleDefinition>;
