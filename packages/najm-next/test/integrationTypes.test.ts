import { expect, expectTypeOf, test } from "bun:test";
import { createNajmServerApp } from "../src/app/server";
import { defineNajmLocationRuntime } from "../src/location/server";
import { buildKafilStyleApp } from "./apps";

test("the bootstrap preserves a concrete session through accessors and snapshots", async () => {
  const session = { user: { id: "fixture", language: "fr" }, roles: ["operator"] };
  const app = createNajmServerApp({
    app: buildKafilStyleApp(),
    auth: {
      getSession: async () => session,
      requireSession: async () => session,
      requireRole: async () => session,
    },
    theme: { loadAppearance: async () => ({}), loadBranding: async () => ({}) },
    readSettings: async () => ({ enabled: true }),
    fallbackSettings: { enabled: false },
    readCookies: async () => ({ get: () => undefined }),
    readHeaders: async () => ({ get: () => null }),
    resolvePreferences: ({ session }) => ({ language: session?.user.language }),
  });
  expectTypeOf<Awaited<ReturnType<typeof app.getSession>>>().toEqualTypeOf<typeof session | null>();
  const snapshot = await app.loadUiSnapshot();
  expectTypeOf(snapshot.session).toEqualTypeOf<typeof session | null>();
  expect(snapshot.session).toBe(session);
  expect(snapshot.preferences.language).toBe("fr");
});

test("allowed location providers narrow the result and still permit disabled fallback", () => {
  const runtime = defineNajmLocationRuntime({
    environmentPrefix: "FIXTURE",
    allowedProviders: ["leaflet"],
    defaults: {
      provider: "leaflet", center: { latitude: 0, longitude: 0 },
      leaflet: { tileUrl: "https://tiles.example/{z}/{x}/{y}.png", attribution: "Fixture" },
    },
  });
  const result = runtime.resolve({});
  expectTypeOf(result.config.provider).toEqualTypeOf<"leaflet" | "disabled">();
  expect(result.config.provider).toBe("leaflet");
  expect(runtime.resolve({ FIXTURE_MAP_PROVIDER: "google" }).config.provider).toBe("disabled");
});
