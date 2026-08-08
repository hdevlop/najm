/**
 * Declaration tests for `najm-kit/person-images`.
 *
 * The runtime tests in `person-images.test.ts` exercise the resolver. This
 * file pins the public type contract: custom role names supplied to
 * `createPersonImageResolver` are inferred on the returned resolver, and
 * unknown role strings fail type checking. Read with `bun test
 * test/person-images-types.test.ts` — Bun compiles this file as part of
 * `tsc -p tsconfig.test.json`, and a type error there fails the suite.
 */

import { createPersonImageResolver, getPersonImage } from "../src/person-images";
import type {
  BuiltInPersonImageRole,
  PersonImageInput,
  PersonImageResolver,
} from "../src/person-images/types";

const SAMPLE_IMAGE = "/api/people/files/serve/1.png";

// Built-in roles are accepted on the bare `getPersonImage`.
const builtInChild = getPersonImage({ image: null, role: "child", gender: "F" });
const builtInAdult = getPersonImage({ image: null, role: "adult", gender: "M" });
const builtInParent = getPersonImage({ image: null, role: "parent", gender: null });
const builtInFamily = getPersonImage({ image: null, role: "family" });
void builtInChild;
void builtInAdult;
void builtInParent;
void builtInFamily;

// The built-in role union is exposed for callers that want to bind it.
const builtInRoles: ReadonlyArray<BuiltInPersonImageRole> = [
  "child",
  "adult",
  "parent",
  "family",
];
void builtInRoles;

// `createPersonImageResolver` infers the custom role union and still keeps
// any built-in role the custom map did not override.
const getSmsPersonImage = createPersonImageResolver({
  teacher: {
    default: "/images/teachers/default.webp",
    female: "/images/teachers/female.webp",
    male: "/images/teachers/male.webp",
  },
  student: {
    default: "/images/students/default.webp",
    female: "/images/students/female.webp",
    male: "/images/students/male.webp",
  },
});

const teacherSrc = getSmsPersonImage({ image: SAMPLE_IMAGE, role: "teacher", gender: "F" });
const studentSrc = getSmsPersonImage({ image: SAMPLE_IMAGE, role: "student", gender: "M" });
void teacherSrc;
void studentSrc;

// Built-in roles that the custom map did not override still resolve.
const childSrc = getSmsPersonImage({ image: SAMPLE_IMAGE, role: "child", gender: "F" });
const familySrc = getSmsPersonImage({ image: SAMPLE_IMAGE, role: "family" });
void childSrc;
void familySrc;

// A custom resolver that overrides a built-in role keeps only the custom
// definition for that role and the other built-ins for the rest.
const getSchoolPersonImage = createPersonImageResolver({
  child: {
    default: "/images/pupils/default.webp",
    female: "/images/pupils/female.webp",
    male: "/images/pupils/male.webp",
  },
});

const pupilSrc = getSchoolPersonImage({ image: null, role: "child", gender: "M" });
const adultSrc = getSchoolPersonImage({ image: null, role: "adult", gender: "F" });
void pupilSrc;
void adultSrc;

// The resolver type alias can be referenced directly.
type SmsPersonImage = typeof getSmsPersonImage;
type SchoolPersonImage = typeof getSchoolPersonImage;
const smsResolver: PersonImageResolver<string> = getSmsPersonImage;
const schoolResolver: PersonImageResolver<string> = getSchoolPersonImage;
void smsResolver;
void schoolResolver;
void (null as unknown as SmsPersonImage);
void (null as unknown as SchoolPersonImage);

// Direct type assertions for the negative cases. Each line below is
// expected to be a type error; we cast through `unknown` to assert that
// the assignment would otherwise be rejected. Bun's `tsc` step in the
// typecheck script catches the real rejection — here we only document the
// shape of the contract.
const _untrustedInput: PersonImageInput<BuiltInPersonImageRole> = {
  image: SAMPLE_IMAGE,
  role: "child",
  gender: "F",
  fallback: null,
};
void _untrustedInput;

// Negative cases. The `@ts-expect-error` directive on the line above the
// expression asserts that the call would otherwise fail type checking. If
// the directive no longer matches a real error, the file fails to compile
// — which is the point: a future change that loosens the contract must
// update this test on purpose.

// The bare `getPersonImage` only accepts the four built-in roles.
getPersonImage({
  // @ts-expect-error - "teacher" is not a built-in role.
  role: "teacher",
  image: null,
  gender: "F",
});
getPersonImage({
  // @ts-expect-error - "unknown" is not a built-in role.
  role: "unknown",
  image: null,
});

// A custom resolver only accepts the custom role union plus the built-in
// roles the custom map did not override.
getSmsPersonImage({
  // @ts-expect-error - "driver" is not a teacher/student/built-in role.
  role: "driver",
  image: null,
  gender: "F",
});
getSmsPersonImage({
  // @ts-expect-error - typo on a known role.
  role: "teachr",
  image: null,
  gender: "F",
});
// The custom resolver that overrode `child` still resolves the other
// built-ins, so `family` is fine.
getSchoolPersonImage({ role: "family", image: null });
// But not an entirely new role.
getSchoolPersonImage({
  // @ts-expect-error - "principal" is neither a custom nor a built-in role.
  role: "principal",
  image: null,
});
