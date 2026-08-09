import { describe, expect, test } from "bun:test";

import {
  normalizeImageSources,
  selectImageSource,
  withSrcVersion,
} from "../src/lib/imageSource";

describe("withSrcVersion", () => {
  test("appends a version with the right separator", () => {
    expect(withSrcVersion("/a.png", 7)).toBe("/a.png?v=7");
    expect(withSrcVersion("/a.png?w=64", 7)).toBe("/a.png?w=64&v=7");
    expect(withSrcVersion("/a.png#hash", "abc")).toBe("/a.png#hash?v=abc");
  });

  test("encodes a version that would otherwise break the query", () => {
    expect(withSrcVersion("/a.png", "2026-08-09 12:00")).toBe(
      "/a.png?v=2026-08-09%2012%3A00",
    );
  });

  test("leaves inline sources alone", () => {
    expect(withSrcVersion("data:image/webp;base64,AAAA", 7)).toBe(
      "data:image/webp;base64,AAAA",
    );
    expect(withSrcVersion("blob:http://localhost/abc", 7)).toBe(
      "blob:http://localhost/abc",
    );
    expect(withSrcVersion("DATA:image/png;base64,AA", 7)).toBe(
      "DATA:image/png;base64,AA",
    );
  });

  test("treats only null, undefined and empty as no version", () => {
    expect(withSrcVersion("/a.png")).toBe("/a.png");
    expect(withSrcVersion("/a.png", null)).toBe("/a.png");
    expect(withSrcVersion("/a.png", "")).toBe("/a.png");
    // A revision counter that starts at zero is a version, not an absence.
    expect(withSrcVersion("/a.png", 0)).toBe("/a.png?v=0");
  });
});

describe("normalizeImageSources", () => {
  test("drops absent and blank candidates", () => {
    expect(normalizeImageSources(["/a.png", null, undefined, "", "   "])).toEqual([
      "/a.png",
    ]);
    expect(normalizeImageSources([null, undefined])).toEqual([]);
  });

  test("trims and keeps preference order", () => {
    expect(normalizeImageSources(["  /a.png ", "/b.png"])).toEqual([
      "/a.png",
      "/b.png",
    ]);
  });

  test("stamps every candidate with the same version", () => {
    expect(normalizeImageSources(["/a.png", "/b.png"], 3)).toEqual([
      "/a.png?v=3",
      "/b.png?v=3",
    ]);
  });

  test("collapses duplicates so one failure exhausts them both", () => {
    expect(normalizeImageSources(["/same.png", "/same.png"])).toEqual([
      "/same.png",
    ]);
    // Same URL, same version — still one entry after stamping.
    expect(normalizeImageSources(["/same.png", "/same.png?"], 4)).toEqual([
      "/same.png?v=4",
      "/same.png?&v=4",
    ]);
  });

  test("mixes inline and remote candidates without stamping the inline one", () => {
    expect(
      normalizeImageSources(["/a.png", "data:image/webp;base64,AAAA"], 9),
    ).toEqual(["/a.png?v=9", "data:image/webp;base64,AAAA"]);
  });
});

describe("selectImageSource", () => {
  test("returns the first source not known to have failed", () => {
    expect(selectImageSource(["/a.png", "/b.png"], [])).toBe("/a.png");
    expect(selectImageSource(["/a.png", "/b.png"], ["/a.png"])).toBe("/b.png");
  });

  test("returns undefined once every source has failed", () => {
    expect(selectImageSource(["/a.png", "/b.png"], ["/a.png", "/b.png"])).toBe(
      undefined,
    );
    expect(selectImageSource([], [])).toBe(undefined);
  });

  test("never returns a source ahead of the failed one", () => {
    // Failure order is irrelevant: the answer is a function of the set.
    expect(selectImageSource(["/a.png", "/b.png"], ["/b.png"])).toBe("/a.png");
  });
});
