import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const packageRoot = resolve(import.meta.dir, "../..");

describe("location entrypoint isolation", () => {
  test("keeps provider SDKs out of the provider-neutral entry", () => {
    const source = readFileSync(resolve(packageRoot, "src/location/index.ts"), "utf8");
    expect(source).not.toContain('from "leaflet"');
    expect(source).not.toContain("@googlemaps/js-api-loader");
    expect(source).not.toContain('./leaflet');
    expect(source).not.toContain('./google');
    expect(source).not.toContain('./runtime');
  });

  test("defers the Leaflet runtime until the browser map mounts", () => {
    const source = readFileSync(resolve(packageRoot, "src/location/leaflet.tsx"), "utf8");
    expect(source).not.toContain('import * as L from "leaflet"');
    expect(source).toContain('import("leaflet")');
  });

  test("publishes explicit core, runtime, Leaflet, and Google subpaths", () => {
    const manifest = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8"));
    expect(manifest.exports["./location"].import).toBe("./dist/location/index.mjs");
    expect(manifest.exports["./location/runtime"].import).toBe("./dist/location/runtime.mjs");
    expect(manifest.exports["./location/runtime/leaflet"].import).toBe("./dist/location/runtimeLeaflet.mjs");
    expect(manifest.exports["./location/leaflet"].import).toBe("./dist/location/leaflet.mjs");
    expect(manifest.exports["./location/google"].import).toBe("./dist/location/google.mjs");
    expect(manifest.dependencies.leaflet).toBe("^1.9.4");
    expect(manifest.dependencies["@googlemaps/js-api-loader"]).toBe("^2.1.1");
  });

  test("keeps runtime provider selection lazy and free of application policy", () => {
    const source = readFileSync(resolve(packageRoot, "src/location/runtime.tsx"), "utf8");
    expect(source).toContain('import("./leaflet")');
    expect(source).toContain('import("./google")');
    expect(source).not.toContain("process.env");
    expect(source).not.toContain("nominatim");
  });

  test("offers a Leaflet-only runtime with no Google dependency edge", () => {
    const source = readFileSync(resolve(packageRoot, "src/location/runtimeLeaflet.tsx"), "utf8");
    expect(source).toContain('import("./leaflet")');
    expect(source).not.toContain('import("./google")');
    expect(source).not.toContain("@googlemaps/js-api-loader");
  });
});
