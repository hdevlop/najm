import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as React from "react";

import { createReactServerUiBootstrap } from "../../src/server/react";
import type { UiBootstrapDiagnostic } from "../../src/server/uiBootstrap";

// React ships two builds. Only the one behind the `react-server` condition
// memoizes `cache()`; the default build hands the function back untouched.
// `bun test` from the package root resolves the default build, so the sharing
// assertions run under `bun run test:rsc`, which adds the condition and runs
// from this folder.
const REACT_SERVER_BUILD = typeof (React as { useState?: unknown }).useState !== "function";
const requestCache = REACT_SERVER_BUILD
  ? (React as unknown as Record<string, { A: unknown }>)
    .__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  : undefined;

/** Enter a React server request: everything inside shares one cache. */
function beginRequest(): void {
  if (!requestCache) return;
  const store = new Map<() => unknown, unknown>();
  requestCache.A = {
    getCacheForType(create: () => unknown) {
      if (!store.has(create)) store.set(create, create());
      return store.get(create);
    },
    cacheSignal: () => null,
  };
}

function endRequest(): void {
  if (requestCache) requestCache.A = null;
}

interface Appearance {
  revision: number;
}
interface Branding {
  logo: string;
}

const FACTORY_BRANDING: Branding = { logo: "/factory.svg" };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

/**
 * One application module, created once at module scope exactly as a consumer's
 * `serverLoader.ts` does. Recreating it per test would give every test its own
 * memoization entry and prove nothing about sharing.
 */
const calls: string[] = [];
const diagnostics: UiBootstrapDiagnostic[] = [];
let brandingStatus = 200;

const serverUi = createReactServerUiBootstrap({
  fetcher: async (path) => {
    calls.push(path);
    if (path === "/api/branding") return json({ data: { logo: "/uploaded.png" } }, brandingStatus);
    return json({ data: { revision: calls.length } });
  },
  resources: {
    appearance: {
      path: "/api/appearance",
      parse: (input): Appearance | undefined =>
        input && typeof input === "object" ? (input as Appearance) : undefined,
      fallback: (): Appearance => ({ revision: 0 }),
    },
    branding: {
      path: "/api/branding",
      parse: (input): Branding | undefined =>
        input && typeof input === "object" ? (input as Branding) : undefined,
      fallback: (): Branding => structuredClone(FACTORY_BRANDING),
    },
  },
  onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
});

const { appearance: loadAppearance, branding: loadBranding } = serverUi.loaders;

beforeEach(() => {
  calls.length = 0;
  diagnostics.length = 0;
  brandingStatus = 200;
  beginRequest();
});

afterEach(endRequest);

const describeShared = REACT_SERVER_BUILD ? describe : describe.skip;

describeShared("one bootstrap per React server request", () => {
  test("concurrent combined and per-resource reads share one pending resolution", async () => {
    // Started together and never awaited in between: the three callers below
    // stand for a root layout, a nested layout, and a page rendering at once.
    const [snapshot, appearance, branding] = await Promise.all([
      serverUi.load(),
      loadAppearance(),
      loadBranding(),
    ]);

    expect(calls.sort()).toEqual(["/api/appearance", "/api/branding"]);
    expect(appearance).toBe(snapshot.appearance);
    expect(branding).toBe(snapshot.branding);
  });

  test("a nested layout reading after the root sees the same resolved snapshot", async () => {
    const root = await serverUi.load();
    const nestedBranding = await loadBranding();
    const page = await serverUi.load();

    expect(calls).toHaveLength(2);
    expect(page).toBe(root);
    expect(nestedBranding).toBe(root.branding);
  });

  test("a failed resource stays stable for the whole render", async () => {
    brandingStatus = 503;

    const first = await loadBranding();
    // Even once the endpoint recovers mid-render, the render keeps one answer.
    brandingStatus = 200;
    const second = await loadBranding();
    const snapshot = await serverUi.load();

    expect(first).toEqual(FACTORY_BRANDING);
    expect(second).toBe(first);
    expect(snapshot.branding).toBe(first);
    expect(diagnostics).toHaveLength(1);
  });

  test("a later request retries rather than reusing a process-global fallback", async () => {
    brandingStatus = 503;
    expect(await loadBranding()).toEqual(FACTORY_BRANDING);

    endRequest();
    beginRequest();
    brandingStatus = 200;

    expect(await loadBranding()).toEqual({ logo: "/uploaded.png" });
  });

  test("separate requests share no snapshot, failure, or diagnostic", async () => {
    brandingStatus = 503;
    const first = await serverUi.load();
    expect(diagnostics).toHaveLength(1);

    endRequest();
    beginRequest();
    calls.length = 0;
    diagnostics.length = 0;
    brandingStatus = 200;

    const second = await serverUi.load();

    expect(second).not.toBe(first);
    expect(second.branding).not.toBe(first.branding);
    expect(second.branding).toEqual({ logo: "/uploaded.png" });
    expect(calls.sort()).toEqual(["/api/appearance", "/api/branding"]);
    expect(diagnostics).toEqual([]);
  });
});

describe("adapter contract", () => {
  test("exposes one accessor per configured resource", () => {
    expect(Object.keys(serverUi.loaders).sort()).toEqual(["appearance", "branding"]);
    expect(typeof serverUi.load).toBe("function");
    expect(typeof serverUi.loadResource).toBe("function");
  });

  test("resolves every resource even when only one is asked for", async () => {
    // The whole point of deriving the per-resource reads from the combined
    // load: a layout that only wants branding still primes the page's
    // appearance read instead of racing a second fetch against it.
    await serverUi.loadResource("branding");
    expect(calls.sort()).toEqual(["/api/appearance", "/api/branding"]);
  });
});
