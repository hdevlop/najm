import { describe, expect, test } from "bun:test";

import { BUILT_IN_PERSON_IMAGE_ROLES } from "../src/person-images/builtIn";
import { createPersonImageResolver, getPersonImage } from "../src/person-images/resolver";

describe("getPersonImage", () => {
  test("returns a real uploaded image untouched", () => {
    const src = "/api/child-images/files/serve/00000000-0000-4000-8000-000000000050.png";
    expect(getPersonImage({ image: src, role: "child", gender: "F" })).toBe(src);
  });

  test("trims whitespace off a real source", () => {
    expect(getPersonImage({ image: "  /a.webp  ", role: "child", gender: "F" })).toBe("/a.webp");
  });

  test("preserves absolute URLs, query strings, and fragments", () => {
    expect(
      getPersonImage({ image: "https://example.com/p.png?v=3#top", role: "child", gender: "F" }),
    ).toBe("https://example.com/p.png?v=3#top");
  });

  test("falls back to the role's gender variant for an absent image", () => {
    const femaleChild = BUILT_IN_PERSON_IMAGE_ROLES.child.female!;
    const maleChild = BUILT_IN_PERSON_IMAGE_ROLES.child.male!;
    const femaleAdult = BUILT_IN_PERSON_IMAGE_ROLES.adult.female!;
    const maleAdult = BUILT_IN_PERSON_IMAGE_ROLES.adult.male!;
    const femaleParent = BUILT_IN_PERSON_IMAGE_ROLES.parent.female!;
    const maleParent = BUILT_IN_PERSON_IMAGE_ROLES.parent.male!;
    const family = BUILT_IN_PERSON_IMAGE_ROLES.family.default;

    expect(getPersonImage({ image: null, role: "child", gender: "F" })).toBe(femaleChild);
    expect(getPersonImage({ image: undefined, role: "child", gender: "M" })).toBe(maleChild);
    expect(getPersonImage({ role: "adult", gender: "F" })).toBe(femaleAdult);
    expect(getPersonImage({ role: "adult", gender: "M" })).toBe(maleAdult);
    expect(getPersonImage({ role: "parent", gender: "F" })).toBe(femaleParent);
    expect(getPersonImage({ role: "parent", gender: "M" })).toBe(maleParent);
    expect(getPersonImage({ role: "family" })).toBe(family);
  });

  test("uses the role's default when gender is null or omitted", () => {
    const maleChild = BUILT_IN_PERSON_IMAGE_ROLES.child.male!;
    const maleAdult = BUILT_IN_PERSON_IMAGE_ROLES.adult.male!;
    expect(getPersonImage({ image: null, role: "child", gender: null })).toBe(maleChild);
    expect(getPersonImage({ image: null, role: "child" })).toBe(maleChild);
    expect(getPersonImage({ image: null, role: "adult", gender: null })).toBe(maleAdult);
  });

  test("uses the role's default when the requested gender variant is absent", () => {
    const family = BUILT_IN_PERSON_IMAGE_ROLES.family.default;
    expect(getPersonImage({ image: null, role: "family", gender: "F" })).toBe(family);
    expect(getPersonImage({ image: null, role: "family", gender: "M" })).toBe(family);
  });

  test("treats every form of the noavatar sentinel as missing", () => {
    const femaleChild = BUILT_IN_PERSON_IMAGE_ROLES.child.female!;
    const maleChild = BUILT_IN_PERSON_IMAGE_ROLES.child.male!;
    for (const placeholder of [
      "noavatar.png",
      "/noavatar.png",
      "/uploads/noavatar.png",
      "/uploads/NoAvatar.PNG",
      "/uploads/noavatar.png?v=3",
      "/uploads/noavatar.png#top",
      "  /uploads/noavatar.png?v=2  ",
    ]) {
      expect(getPersonImage({ image: placeholder, role: "child", gender: "F" })).toBe(femaleChild);
      expect(getPersonImage({ image: placeholder, role: "child", gender: "M" })).toBe(maleChild);
    }
  });

  test("does not mistake a longer name that merely ends the same way", () => {
    const src = "/uploads/my-noavatar.png";
    expect(getPersonImage({ image: src, role: "child", gender: "F" })).toBe(src);
  });

  test("uses a non-empty, non-sentinel per-call fallback", () => {
    expect(
      getPersonImage({ image: null, role: "child", gender: "F", fallback: "/images/avatar.webp" }),
    ).toBe("/images/avatar.webp");
  });

  test("ignores a per-call fallback that is blank or a noavatar sentinel", () => {
    const femaleChild = BUILT_IN_PERSON_IMAGE_ROLES.child.female!;
    expect(
      getPersonImage({ image: null, role: "child", gender: "F", fallback: "" }),
    ).toBe(femaleChild);
    expect(
      getPersonImage({ image: null, role: "child", gender: "F", fallback: "   " }),
    ).toBe(femaleChild);
    expect(
      getPersonImage({ image: null, role: "child", gender: "F", fallback: "noavatar.png" }),
    ).toBe(femaleChild);
  });

  test("prefers a real image over a per-call fallback", () => {
    const src = "/api/people/files/serve/1.png";
    expect(
      getPersonImage({ image: src, role: "child", gender: "F", fallback: "/images/avatar.webp" }),
    ).toBe(src);
  });
});

describe("createPersonImageResolver", () => {
  test("adds application roles on top of the built-in map", () => {
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

    expect(
      getSmsPersonImage({ image: null, role: "teacher", gender: "F" }),
    ).toBe("/images/teachers/female.webp");
    expect(
      getSmsPersonImage({ image: null, role: "student", gender: "M" }),
    ).toBe("/images/students/male.webp");
    expect(
      getSmsPersonImage({ image: null, role: "student", gender: null }),
    ).toBe("/images/students/default.webp");
  });

  test("still resolves built-in roles that the custom map does not override", () => {
    const getSchoolPersonImage = createPersonImageResolver({
      teacher: {
        default: "/images/teachers/default.webp",
      },
    });

    const maleChild = BUILT_IN_PERSON_IMAGE_ROLES.child.male!;
    expect(
      getSchoolPersonImage({ image: null, role: "child", gender: "M" }),
    ).toBe(maleChild);
    expect(
      getSchoolPersonImage({ image: null, role: "teacher" }),
    ).toBe("/images/teachers/default.webp");
  });

  test("lets a custom map override a built-in role for one application", () => {
    const getPupilPersonImage = createPersonImageResolver({
      child: {
        default: "/images/pupils/default.webp",
        female: "/images/pupils/female.webp",
        male: "/images/pupils/male.webp",
      },
    });

    expect(
      getPupilPersonImage({ image: null, role: "child", gender: "F" }),
    ).toBe("/images/pupils/female.webp");
    expect(
      getPupilPersonImage({ image: null, role: "child", gender: "M" }),
    ).toBe("/images/pupils/male.webp");
  });

  test("a real image still wins in a custom resolver", () => {
    const getSmsPersonImage = createPersonImageResolver({
      teacher: {
        default: "/images/teachers/default.webp",
      },
    });
    const src = "/api/people/files/serve/1.png";
    expect(getSmsPersonImage({ image: src, role: "teacher", gender: "F" })).toBe(src);
  });

  test("per-call fallback behaves like a real image in a custom resolver", () => {
    const getSmsPersonImage = createPersonImageResolver({
      teacher: {
        default: "/images/teachers/default.webp",
      },
    });
    expect(
      getSmsPersonImage({ image: null, role: "teacher", gender: "F", fallback: "/override.webp" }),
    ).toBe("/override.webp");
    const teacherDefault = "/images/teachers/default.webp";
    expect(
      getSmsPersonImage({ image: null, role: "teacher", gender: "F", fallback: "noavatar.png" }),
    ).toBe(teacherDefault);
  });
});
