import { describe, expect, test } from "bun:test";

import { isPlaceholderAvatar, resolveAvatarSrc } from "../src/lib/avatar";

const FALLBACK = "/images/people/child-male.webp";

describe("resolveAvatarSrc", () => {
  test("returns a real source untouched", () => {
    expect(resolveAvatarSrc("/storage/child/12.webp", FALLBACK)).toBe(
      "/storage/child/12.webp",
    );
  });

  test("falls back for absent and blank sources", () => {
    expect(resolveAvatarSrc(null, FALLBACK)).toBe(FALLBACK);
    expect(resolveAvatarSrc(undefined, FALLBACK)).toBe(FALLBACK);
    expect(resolveAvatarSrc("   ", FALLBACK)).toBe(FALLBACK);
  });

  test("trims surrounding whitespace off a real source", () => {
    expect(resolveAvatarSrc("  /a.webp  ", FALLBACK)).toBe("/a.webp");
  });

  // The bare name is what a seeded column holds; the rest are how it reaches
  // the browser once a storage prefix or a cache-busting query is attached.
  test("treats the seeded placeholder as absent in every form it arrives in", () => {
    for (const placeholder of [
      "noavatar.png",
      "/noavatar.png",
      "/uploads/noavatar.png",
      "/uploads/NoAvatar.PNG",
      "/uploads/noavatar.png?v=3",
      "/uploads/noavatar.png#top",
    ]) {
      expect(resolveAvatarSrc(placeholder, FALLBACK)).toBe(FALLBACK);
    }
  });

  test("does not mistake a longer name that merely ends the same way", () => {
    expect(resolveAvatarSrc("/uploads/my-noavatar.png", FALLBACK)).toBe(
      "/uploads/my-noavatar.png",
    );
  });

  test("passes an undefined fallback through, for callers with no stock image", () => {
    expect(resolveAvatarSrc("noavatar.png", undefined)).toBeUndefined();
  });
});

describe("isPlaceholderAvatar", () => {
  test("answers for absent, blank, placeholder, and real sources", () => {
    expect(isPlaceholderAvatar(null)).toBe(true);
    expect(isPlaceholderAvatar("  ")).toBe(true);
    expect(isPlaceholderAvatar("/uploads/noavatar.png?v=2")).toBe(true);
    expect(isPlaceholderAvatar("/uploads/real.webp")).toBe(false);
  });
});
