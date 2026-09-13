import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineNajmLocationRuntime } from "../src/location/server";

const definition = defineNajmLocationRuntime({
  environmentPrefix: "TEST_LOCATION",
  allowedProviders: ["leaflet"],
  defaults: {
    provider: "leaflet",
    center: { latitude: 33.5731, longitude: -7.5898 },
    zoom: 12,
    leaflet: {
      tileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: "OpenStreetMap contributors",
    },
  },
});

describe("defineNajmLocationRuntime", () => {
  test("publishes an isolated server entry and never reads process.env", () => {
    const packageRoot = resolve(import.meta.dir, "..");
    const manifest = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8"));
    const source = readFileSync(resolve(packageRoot, "src/location/server.ts"), "utf8");

    expect(manifest.exports["./location/server"].import).toBe("./dist/location/server.js");
    expect(source).not.toMatch(/process\.env\s*(?:\.|\[)/);
    expect(source).not.toContain("najm-kit");
  });

  test("resolves a serializable Leaflet config and matching CSP origin", () => {
    const runtime = definition.resolve({
      TEST_LOCATION_DEFAULT_LATITUDE: "35.7595",
      TEST_LOCATION_DEFAULT_LONGITUDE: "-5.8340",
      TEST_LOCATION_DEFAULT_ZOOM: "14",
      TEST_LOCATION_TILE_URL: "https://tiles.example/{z}/{x}/{y}.png",
      TEST_LOCATION_TILE_ATTRIBUTION: "Example tiles",
    });

    expect(runtime).toEqual({
      config: {
        provider: "leaflet",
        defaultCenter: { latitude: 35.7595, longitude: -5.834 },
        defaultZoom: 14,
        leaflet: {
          tileUrl: "https://tiles.example/{z}/{x}/{y}.png",
          attribution: "Example tiles",
        },
      },
      csp: { imgSrc: ["https://tiles.example"], connectSrc: [] },
      issues: [],
    });
    expect(() => structuredClone(runtime.config)).not.toThrow();
  });

  test("disables unknown or disallowed providers without reflecting their value", () => {
    const runtime = definition.resolve({ TEST_LOCATION_MAP_PROVIDER: "google-secret-value" });

    expect(runtime.config.provider).toBe("disabled");
    expect(runtime.csp).toEqual({ imgSrc: [], connectSrc: [] });
    expect(runtime.issues).toEqual(["invalid-provider"]);
    expect(JSON.stringify(runtime)).not.toContain("google-secret-value");
  });

  test("disables invalid production tile URLs", () => {
    const runtime = definition.resolve({ TEST_LOCATION_TILE_URL: "http://tiles.example/{z}.png" });

    expect(runtime.config.provider).toBe("disabled");
    expect(runtime.issues).toEqual(["invalid-tile-url"]);
  });

  test("allows loopback HTTP tiles only in development", () => {
    const environment = { TEST_LOCATION_TILE_URL: "http://127.0.0.1:4400/{z}.png" };

    expect(definition.resolve(environment).config.provider).toBe("disabled");
    expect(definition.resolve(environment, { isDevelopment: true })).toEqual({
      config: {
        provider: "leaflet",
        defaultCenter: { latitude: 33.5731, longitude: -7.5898 },
        defaultZoom: 12,
        leaflet: {
          tileUrl: "http://127.0.0.1:4400/{z}.png",
          attribution: "OpenStreetMap contributors",
        },
      },
      csp: { imgSrc: ["http://127.0.0.1:4400"], connectSrc: [] },
      issues: [],
    });
  });

  test("falls back per field and reports only sanitized issue codes", () => {
    const runtime = definition.resolve({
      TEST_LOCATION_DEFAULT_LATITUDE: "private-invalid-latitude",
      TEST_LOCATION_DEFAULT_LONGITUDE: "181",
      TEST_LOCATION_DEFAULT_ZOOM: "0",
    });

    expect(runtime.config.defaultCenter).toEqual({ latitude: 33.5731, longitude: -7.5898 });
    expect(runtime.config.defaultZoom).toBe(12);
    expect(runtime.issues).toEqual(["invalid-center", "invalid-zoom"]);
    expect(JSON.stringify(runtime)).not.toContain("private-invalid-latitude");
  });

  test("rejects invalid definitions eagerly", () => {
    expect(() => defineNajmLocationRuntime({
      environmentPrefix: "bad-prefix",
      defaults: {
        center: { latitude: 0, longitude: 0 },
        leaflet: { tileUrl: "https://tiles.example/{z}.png", attribution: "Tiles" },
      },
    })).toThrow("environmentPrefix");
  });

  test("does not require Leaflet defaults for a disabled-only application", () => {
    const disabled = defineNajmLocationRuntime({
      environmentPrefix: "DISABLED_LOCATION",
      allowedProviders: ["disabled"],
      defaults: {
        provider: "disabled",
        center: { latitude: 0, longitude: 0 },
      },
    });

    expect(disabled.resolve({}).config.provider).toBe("disabled");
  });

  test("resolves a browser-safe Google config and matching CSP contributions", () => {
    const google = defineNajmLocationRuntime({
      environmentPrefix: "SCHOOL_LOCATION",
      allowedProviders: ["google"],
      defaults: {
        provider: "google",
        center: { latitude: 33.5731, longitude: -7.5898 },
        zoom: 13,
        google: {
          language: "fr",
          region: "MA",
          apiKeyEnvironmentFallbacks: ["NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"],
        },
      },
    });

    const runtime = google.resolve({
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "public-browser-key",
      SCHOOL_LOCATION_GOOGLE_MAP_ID: "school-map-id",
      SCHOOL_LOCATION_GOOGLE_LANGUAGE: "ar-MA",
      SCHOOL_LOCATION_GOOGLE_REGION: "ma",
    });

    expect(runtime.config).toEqual({
      provider: "google",
      defaultCenter: { latitude: 33.5731, longitude: -7.5898 },
      defaultZoom: 13,
      google: {
        apiKey: "public-browser-key",
        mapId: "school-map-id",
        language: "ar-MA",
        region: "MA",
      },
    });
    expect(runtime.csp.scriptSrc).toContain("https://maps.googleapis.com");
    expect(runtime.csp.connectSrc).toContain("https://*.googleapis.com");
    expect(runtime.csp.imgSrc).toContain("https://*.gstatic.com");
    expect(runtime.csp.fontSrc).toEqual(["https://fonts.gstatic.com"]);
    expect(runtime.issues).toEqual([]);
    expect(() => structuredClone(runtime.config)).not.toThrow();
    expect(JSON.stringify(runtime.config)).not.toContain("NEXT_PUBLIC");
  });

  test("disables Google safely when the public key or projected options are invalid", () => {
    const google = defineNajmLocationRuntime({
      environmentPrefix: "SCHOOL_LOCATION",
      allowedProviders: ["google"],
      defaults: {
        provider: "google",
        center: { latitude: 0, longitude: 0 },
        google: { apiKeyEnvironmentFallbacks: ["NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"] },
      },
    });

    expect(google.resolve({})).toMatchObject({
      config: { provider: "disabled" },
      issues: ["invalid-google-api-key"],
    });
    const malformed = google.resolve({
      SCHOOL_LOCATION_GOOGLE_API_KEY: "public-key",
      SCHOOL_LOCATION_GOOGLE_LANGUAGE: "fr;script-src *",
      SCHOOL_LOCATION_GOOGLE_MAP_ID: "bad map id",
      SCHOOL_LOCATION_GOOGLE_REGION: "MOR",
    });
    expect(malformed.config.provider).toBe("disabled");
    expect(malformed.issues).toEqual([
      "invalid-google-map-id",
      "invalid-google-language",
      "invalid-google-region",
    ]);
    expect(JSON.stringify(malformed)).not.toContain("script-src");
  });

  test("validates Google compatibility environment names at definition time", () => {
    expect(() => defineNajmLocationRuntime({
      environmentPrefix: "SCHOOL_LOCATION",
      allowedProviders: ["google"],
      defaults: {
        provider: "google",
        center: { latitude: 0, longitude: 0 },
        google: { apiKeyEnvironmentFallbacks: ["bad-variable"] },
      },
    })).toThrow("apiKeyEnvironmentFallbacks");
  });
});
