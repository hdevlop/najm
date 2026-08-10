import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Built-output assertions for the shared feedback contract.
 *
 * The behavioral tests live in `feedback/states.test.tsx`. These check the
 * graph a consumer actually receives: a single `NFeedbackDefaultsContext`,
 * the five feedback components exported from `najm-kit/app`, and the
 * retained `'use client'` boundary on that entry.
 */

const DIST = join(import.meta.dir, "..", "dist");

const built = existsSync(join(DIST, "adapters/app.mjs"));
const describeBuilt = built ? describe : describe.skip;

describeBuilt("feedback distribution", () => {
  test("the feedback-defaults context exists in exactly one chunk", () => {
    const { readdirSync } = require("node:fs") as typeof import("node:fs");
    const chunks = readdirSync(DIST).filter((f) => f.startsWith("chunk-"));
    const CREATES_CONTEXT = /\bNFeedbackDefaultsContext\s*=\s*(?:\w+\.)?createContext\b/;
    const owners = chunks.filter((c) =>
      CREATES_CONTEXT.test(readFileSync(join(DIST, c), "utf8")),
    );
    expect(
      owners.length,
      `NFeedbackDefaultsContext must be created exactly once, found in: ${owners.join(", ") || "no chunk"}`,
    ).toBe(1);
  });

  test("the feedback state components reach every public entry", () => {
    const declarations = readFileSync(join(DIST, "index.d.ts"), "utf8");
    for (const name of [
      "NLoadingState",
      "NErrorState",
      "NEmptyState",
      "NForbiddenState",
      "NNotFoundState",
      "NLoadingStateProps",
      "NErrorStateProps",
      "NEmptyStateProps",
      "NForbiddenStateProps",
      "NNotFoundStateProps",
      "NFeedbackSurface",
      "NFeedbackDefaults",
      "NFeedbackLabels",
      "NFeedbackLabelKeys",
    ]) {
      expect(
        declarations.includes(name),
        `expected ${name} in dist/index.d.ts`,
      ).toBe(true);
    }
  });

  test("the app entry re-exports every feedback state component", () => {
    const declarations = readFileSync(join(DIST, "adapters/app.d.ts"), "utf8");
    for (const name of [
      "NLoadingState",
      "NErrorState",
      "NEmptyState",
      "NForbiddenState",
      "NNotFoundState",
      "NLoadingStateProps",
      "NErrorStateProps",
      "NEmptyStateProps",
      "NForbiddenStateProps",
      "NNotFoundStateProps",
    ]) {
      expect(
        declarations.includes(name),
        `expected ${name} in dist/adapters/app.d.ts`,
      ).toBe(true);
    }
  });

  test("the app entry retains 'use client' for the feedback components", () => {
    const source = readFileSync(join(DIST, "adapters/app.mjs"), "utf8");
    expect(source.startsWith("'use client'")).toBe(true);
    // At least one feedback-state component reaches the bundle so a consumer
    // importing NForbiddenState from najm-kit/app does not end up with an
    // empty module.
    expect(source).toContain("NForbiddenState");
    expect(source).toContain("NNotFoundState");
  });

  test("the root entry stays free of 'use client'", () => {
    // The root barrel must remain installable without a Client Component
    // boundary, even after adding new feedback components.
    const source = readFileSync(join(DIST, "index.mjs"), "utf8");
    expect(source.startsWith("'use client'")).toBe(false);
  });
});
