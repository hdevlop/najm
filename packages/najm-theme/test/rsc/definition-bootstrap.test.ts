import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as React from "react";
import { join } from "node:path";

import { defineTheme } from "../../src/theme";

// ============================================================================
// `appTheme.react()` — the RSC half of the factory theme convention.
//
// The bootstrap suite next door proves the loader. This proves the thing the
// convention is actually for: that the frontend repeats *nothing*. No factory
// design, no branding map, no route suffix, no fallback paths — a definition
// and a way to reach the server, and the fallback is the same four files the
// backend would have served.
//
// Run through `bun run test:rsc`, which adds the `react-server` condition.
// ============================================================================

const REACT_SERVER_BUILD = typeof (React as { useState?: unknown }).useState !== "function";
const requestCache = REACT_SERVER_BUILD
  ? (React as unknown as Record<string, { A: unknown }>)
      .__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  : undefined;

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

const appTheme = defineTheme(join(import.meta.dir, "../fixtures/theme-mixed"));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const calls: string[] = [];
let status = 200;

// Created once at module scope, exactly as a consumer's `serverTheme.ts` does.
const serverTheme = appTheme.react({
  getServer: async () => ({
    async fetch(request: Request) {
      const path = new URL(request.url).pathname;
      calls.push(path);
      if (status !== 200) return json({ message: "nope" }, status);
      return path.endsWith("/appearance")
        ? json({ data: { designConfig: { version: 1, theme: { tokens: { primary: "#111827" } } }, revision: 9 } })
        : json({ data: { slots: { authLogo: "/api/theme/branding/assets/managed.png" }, revision: 3 } });
    },
  }),
  onDiagnostic: false,
});

beforeEach(() => {
  calls.length = 0;
  status = 200;
  beginRequest();
});

afterEach(endRequest);

describe("a definition-backed bootstrap", () => {
  it("reads both resources from the standard mount with no path configuration", async () => {
    const snapshot = await serverTheme.load();

    expect(calls.sort()).toEqual(["/api/theme/appearance", "/api/theme/branding"]);
    expect(snapshot.appearance.revision).toBe(9);
    expect(snapshot.branding.slots.authLogo).toBe("/api/theme/branding/assets/managed.png");
    // The standard consumer never builds a factory map — the bootstrap attaches
    // it, so the React tree can render the chain without one being passed.
    expect(snapshot.branding.factory).toEqual(
      appTheme.branding("/api/theme") as Record<string, string | null>,
    );
  });

  it("falls back to the directory's own design and its four factory files", async () => {
    status = 503;
    const snapshot = await serverTheme.load();

    expect(snapshot.appearance.designConfig).toEqual(appTheme.appearance());
    expect(snapshot.appearance.revision).toBe(1);
    // Not a consumer-supplied map: the same URLs the backend resolves to, from
    // the same definition, so a backend outage renders the product's real marks
    // rather than a placeholder or a gap.
    expect(snapshot.branding.slots).toEqual(appTheme.branding("/api/theme") as Record<string, string>);
    expect(snapshot.branding.factory).toEqual(
      appTheme.branding("/api/theme") as Record<string, string | null>,
    );
  });

  it.skipIf(!REACT_SERVER_BUILD)("shares one resolution across a request", async () => {
    await Promise.all([
      serverTheme.load(),
      serverTheme.loadAppearance(),
      serverTheme.loadBranding(),
    ]);

    expect(calls.sort()).toEqual(["/api/theme/appearance", "/api/theme/branding"]);
  });

  it("moves every route and the factory fallback together when the mount differs", async () => {
    const legacyCalls: string[] = [];
    const legacy = appTheme.react({
      basePath: "/api/theme-v2",
      getServer: async () => ({
        async fetch(request: Request) {
          legacyCalls.push(new URL(request.url).pathname);
          return json({ message: "nope" }, 500);
        },
      }),
      onDiagnostic: false,
    });

    const snapshot = await legacy.load();

    // The fetcher hits the custom mount.
    expect(legacyCalls.sort()).toEqual([
      "/api/theme-v2/appearance",
      "/api/theme-v2/branding",
    ]);
    // The fallback slots move with the same prefix.
    expect(snapshot.branding.slots.authLogo).toBe(appTheme.branding("/api/theme-v2").authLogo);
    // The factory map moves with the same prefix — one override, every URL.
    expect(snapshot.branding.factory!.authLogo).toBe(appTheme.branding("/api/theme-v2").authLogo);
    expect(snapshot.branding.factory!.sidebarLogoExpanded).toBe(
      appTheme.branding("/api/theme-v2").sidebarLogoExpanded,
    );
    expect(snapshot.branding.factory!.sidebarLogoCollapsed).toBe(
      appTheme.branding("/api/theme-v2").sidebarLogoCollapsed,
    );
    expect(snapshot.branding.factory!.authHeroImage).toBe(
      appTheme.branding("/api/theme-v2").authHeroImage,
    );
  });
});

describe("configuration failures", () => {
  it("fails where it is written, not on the first render", () => {
    expect(() =>
      appTheme.react({} as Parameters<typeof appTheme.react>[0]),
    ).toThrow(/exactly one of fetcher or getServer/);

    expect(() =>
      appTheme.react({
        basePath: "../admin",
        getServer: async () => ({ async fetch() { return json({}); } }),
      }),
    ).toThrow(/absolute path prefix/);
  });
});
