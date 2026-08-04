import { describe, expect, test } from "bun:test";
import {
  appendImageVersion,
  buildPreviewCandidates,
  candidatesKey,
} from "../../src/components/inputs/imagePreview";

describe("appendImageVersion", () => {
  test("returns src unchanged when version is null", () => {
    expect(appendImageVersion("/img.png", null)).toBe("/img.png");
  });

  test("returns src unchanged when version is undefined", () => {
    expect(appendImageVersion("/img.png", undefined)).toBe("/img.png");
  });

  test("returns src unchanged when version is empty string", () => {
    expect(appendImageVersion("/img.png", "")).toBe("/img.png");
  });

  test("returns src unchanged when src is empty", () => {
    expect(appendImageVersion("", "1")).toBe("");
  });

  test("appends ?v= when no query string exists", () => {
    expect(appendImageVersion("/img.png", 1)).toBe("/img.png?v=1");
    expect(appendImageVersion("/img.png", "abc")).toBe("/img.png?v=abc");
  });

  test("appends &v= when query string already exists", () => {
    expect(appendImageVersion("/img.png?w=200", 1)).toBe("/img.png?w=200&v=1");
  });

  test("preserves fragments after the appended version", () => {
    expect(appendImageVersion("/img.png#hero", 2)).toBe("/img.png?v=2#hero");
    expect(appendImageVersion("/img.png?w=200#hero", 2)).toBe(
      "/img.png?w=200&v=2#hero",
    );
  });

  test("leaves data URLs unchanged", () => {
    expect(appendImageVersion("data:image/png;base64,abc", 1)).toBe(
      "data:image/png;base64,abc",
    );
  });

  test("leaves blob URLs unchanged", () => {
    expect(appendImageVersion("blob:http://localhost/abc", 1)).toBe(
      "blob:http://localhost/abc",
    );
  });

  test("leaves javascript URLs unchanged", () => {
    expect(appendImageVersion("javascript:void(0)", 1)).toBe(
      "javascript:void(0)",
    );
  });

  test("leaves file URLs unchanged", () => {
    expect(appendImageVersion("file:///tmp/img.png", 1)).toBe(
      "file:///tmp/img.png",
    );
  });

  test("URI-encodes non-trivial version strings", () => {
    expect(appendImageVersion("/img.png", "a b/c")).toBe("/img.png?v=a%20b%2Fc");
  });

  test("keeps absolute URLs intact", () => {
    expect(appendImageVersion("https://cdn.example.com/img.png", 7)).toBe(
      "https://cdn.example.com/img.png?v=7",
    );
  });

  test("keeps application-relative URLs intact", () => {
    expect(appendImageVersion("assets/logo.svg", 3)).toBe("assets/logo.svg?v=3");
  });
});

describe("buildPreviewCandidates", () => {
  test("returns only the primary value when fallback and default are absent", () => {
    const candidates = buildPreviewCandidates({ value: "/a.png" });

    expect(candidates).toEqual([{ src: "/a.png", source: "value" }]);
  });

  test("orders value, fallback, default", () => {
    const candidates = buildPreviewCandidates({
      value: "/a.png",
      fallback: "/b.png",
      defaultImage: "/c.png",
    });

    expect(candidates).toEqual([
      { src: "/a.png", source: "value" },
      { src: "/b.png", source: "fallback" },
      { src: "/c.png", source: "default" },
    ]);
  });

  test("deduplicates identical URLs across sources", () => {
    const candidates = buildPreviewCandidates({
      value: "/a.png",
      fallback: "/a.png",
      defaultImage: "/a.png",
    });

    expect(candidates).toEqual([{ src: "/a.png", source: "value" }]);
  });

  test("deduplicates identical URLs after applying imageVersion", () => {
    const candidates = buildPreviewCandidates({
      value: "/a.png",
      fallback: "/a.png",
      imageVersion: 1,
    });

    expect(candidates).toEqual([{ src: "/a.png?v=1", source: "value" }]);
  });

  test("treats null and undefined as missing sources", () => {
    const candidates = buildPreviewCandidates({
      value: null,
      fallback: undefined,
      defaultImage: null,
    });

    expect(candidates).toEqual([]);
  });

  test("treats empty strings as missing sources", () => {
    const candidates = buildPreviewCandidates({
      value: "",
      fallback: "",
      defaultImage: "",
    });

    expect(candidates).toEqual([]);
  });

  test("applies imageVersion to every candidate that supports it", () => {
    const candidates = buildPreviewCandidates({
      value: "data:image/png;base64,abc",
      fallback: "/b.png",
      defaultImage: "/c.png?x=1",
      imageVersion: 2,
    });

    expect(candidates).toEqual([
      { src: "data:image/png;base64,abc", source: "value" },
      { src: "/b.png?v=2", source: "fallback" },
      { src: "/c.png?x=1&v=2", source: "default" },
    ]);
  });

  test("ignores imageVersion when null or undefined", () => {
    const candidates = buildPreviewCandidates({
      value: "/a.png",
      fallback: "/b.png",
      imageVersion: null,
    });

    expect(candidates).toEqual([
      { src: "/a.png", source: "value" },
      { src: "/b.png", source: "fallback" },
    ]);
  });

  test("falls back to defaultImage only when fallback is missing", () => {
    const candidates = buildPreviewCandidates({
      value: "/a.png",
      defaultImage: "/c.png",
    });

    expect(candidates).toEqual([
      { src: "/a.png", source: "value" },
      { src: "/c.png", source: "default" },
    ]);
  });
});

describe("candidatesKey", () => {
  test("returns identical key for identical candidate sets", () => {
    const a = buildPreviewCandidates({
      value: "/a.png",
      fallback: "/b.png",
      defaultImage: "/c.png",
    });
    const b = buildPreviewCandidates({
      value: "/a.png",
      fallback: "/b.png",
      defaultImage: "/c.png",
    });

    expect(candidatesKey(a)).toBe(candidatesKey(b));
  });

  test("returns a different key when any candidate changes", () => {
    const a = buildPreviewCandidates({
      value: "/a.png",
      fallback: "/b.png",
      defaultImage: "/c.png",
    });
    const b = buildPreviewCandidates({
      value: "/a.png",
      fallback: "/b-v2.png",
      defaultImage: "/c.png",
    });

    expect(candidatesKey(a)).not.toBe(candidatesKey(b));
  });

  test("returns a different key when version changes", () => {
    const a = buildPreviewCandidates({ value: "/a.png", imageVersion: 1 });
    const b = buildPreviewCandidates({ value: "/a.png", imageVersion: 2 });

    expect(candidatesKey(a)).not.toBe(candidatesKey(b));
  });
});