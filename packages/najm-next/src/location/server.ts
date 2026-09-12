import type { EnvRecord } from "../internal/types";

export type NajmLocationMapProvider = "disabled" | "leaflet";

export interface NajmResolvedLocationBaseConfig {
  defaultCenter: { latitude: number; longitude: number };
  defaultZoom: number;
}

export interface NajmResolvedDisabledLocationConfig extends NajmResolvedLocationBaseConfig {
  provider: "disabled";
}

export interface NajmResolvedLeafletLocationConfig extends NajmResolvedLocationBaseConfig {
  provider: "leaflet";
  leaflet: {
    tileUrl: string;
    attribution: string;
  };
}

/** Structurally compatible with `NLocationRuntimeConfig` from Najm Kit. */
export type NajmResolvedLocationConfig =
  | NajmResolvedDisabledLocationConfig
  | NajmResolvedLeafletLocationConfig;

export type NajmLocationRuntimeIssue =
  | "invalid-center"
  | "invalid-provider"
  | "invalid-tile-url"
  | "invalid-zoom";

export interface NajmLocationRuntimeResolution {
  config: NajmResolvedLocationConfig;
  csp: {
    imgSrc: readonly string[];
    connectSrc: readonly string[];
  };
  issues: readonly NajmLocationRuntimeIssue[];
}

export interface NajmLocationRuntimeDefinitionOptions {
  /** Application-owned environment prefix, for example `KAFIL_LOCATION`. */
  environmentPrefix: string;
  allowedProviders?: readonly NajmLocationMapProvider[];
  defaults: {
    provider?: NajmLocationMapProvider;
    center: { latitude: number; longitude: number };
    zoom?: number;
    leaflet?: {
      tileUrl: string;
      attribution: string;
    };
  };
}

export interface NajmLocationRuntimeDefinition {
  resolve(
    environment: EnvRecord,
    options?: Readonly<{ isDevelopment?: boolean }>,
  ): NajmLocationRuntimeResolution;
}

const PREFIX_PATTERN = /^[A-Z][A-Z0-9_]*$/;

function finiteInRange(
  value: string | undefined,
  minimum: number,
  maximum: number,
  fallback: number,
): { value: number; valid: boolean } {
  if (value === undefined || value.trim() === "") return { value: fallback, valid: true };
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum) {
    return { value: parsed, valid: true };
  }
  return { value: fallback, valid: false };
}

function assertDefaultInRange(name: string, value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new TypeError(`${name} must be a finite number between ${minimum} and ${maximum}`);
  }
}

function parsePublicUrl(value: string, isDevelopment: boolean): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return url;
    if (
      isDevelopment &&
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    ) {
      return url;
    }
  } catch {
    // Invalid configuration resolves to the safe disabled provider below.
  }
  return null;
}

/**
 * Defines one application's location policy without reading `process.env`.
 * The returned resolver can be used by a dynamic layout and CSP/proxy code so
 * both receive the same validated runtime configuration.
 */
export function defineNajmLocationRuntime(
  options: NajmLocationRuntimeDefinitionOptions,
): NajmLocationRuntimeDefinition {
  const prefix = options.environmentPrefix.trim();
  if (!PREFIX_PATTERN.test(prefix)) {
    throw new TypeError("environmentPrefix must contain uppercase letters, numbers, and underscores");
  }

  const defaultProvider = options.defaults.provider ?? "leaflet";
  const allowedProviders = new Set(options.allowedProviders ?? ["disabled", "leaflet"]);
  allowedProviders.add("disabled");
  if (!allowedProviders.has(defaultProvider)) {
    throw new TypeError("The default location provider must be included in allowedProviders");
  }

  assertDefaultInRange("defaults.center.latitude", options.defaults.center.latitude, -90, 90);
  assertDefaultInRange("defaults.center.longitude", options.defaults.center.longitude, -180, 180);
  assertDefaultInRange("defaults.zoom", options.defaults.zoom ?? 12, 1, 22);
  if (allowedProviders.has("leaflet") && !options.defaults.leaflet) {
    throw new TypeError("defaults.leaflet is required when Leaflet is allowed");
  }
  if (options.defaults.leaflet && !options.defaults.leaflet.attribution.trim()) {
    throw new TypeError("defaults.leaflet.attribution must not be empty");
  }

  const names = {
    provider: `${prefix}_MAP_PROVIDER`,
    latitude: `${prefix}_DEFAULT_LATITUDE`,
    longitude: `${prefix}_DEFAULT_LONGITUDE`,
    zoom: `${prefix}_DEFAULT_ZOOM`,
    tileUrl: `${prefix}_TILE_URL`,
    attribution: `${prefix}_TILE_ATTRIBUTION`,
  } as const;

  return {
    resolve(environment, resolutionOptions = {}) {
      const issues = new Set<NajmLocationRuntimeIssue>();
      const latitude = finiteInRange(
        environment[names.latitude],
        -90,
        90,
        options.defaults.center.latitude,
      );
      const longitude = finiteInRange(
        environment[names.longitude],
        -180,
        180,
        options.defaults.center.longitude,
      );
      if (!latitude.valid || !longitude.valid) issues.add("invalid-center");

      const zoom = finiteInRange(environment[names.zoom], 1, 22, options.defaults.zoom ?? 12);
      if (!zoom.valid) issues.add("invalid-zoom");

      const defaultCenter = { latitude: latitude.value, longitude: longitude.value };
      const requestedProvider = (environment[names.provider] ?? defaultProvider).trim().toLowerCase();
      if (
        requestedProvider !== "disabled" &&
        requestedProvider !== "leaflet"
      ) {
        issues.add("invalid-provider");
        return {
          config: { provider: "disabled", defaultCenter, defaultZoom: zoom.value },
          csp: { imgSrc: [], connectSrc: [] },
          issues: [...issues],
        };
      }

      if (!allowedProviders.has(requestedProvider)) {
        issues.add("invalid-provider");
        return {
          config: { provider: "disabled", defaultCenter, defaultZoom: zoom.value },
          csp: { imgSrc: [], connectSrc: [] },
          issues: [...issues],
        };
      }

      if (requestedProvider === "disabled") {
        return {
          config: { provider: "disabled", defaultCenter, defaultZoom: zoom.value },
          csp: { imgSrc: [], connectSrc: [] },
          issues: [...issues],
        };
      }

      const leafletDefaults = options.defaults.leaflet!;
      const tileUrl = environment[names.tileUrl]?.trim() || leafletDefaults.tileUrl;
      const parsedTileUrl = parsePublicUrl(tileUrl, resolutionOptions.isDevelopment ?? false);
      if (!parsedTileUrl) {
        issues.add("invalid-tile-url");
        return {
          config: { provider: "disabled", defaultCenter, defaultZoom: zoom.value },
          csp: { imgSrc: [], connectSrc: [] },
          issues: [...issues],
        };
      }

      const attribution =
        environment[names.attribution]?.trim() || leafletDefaults.attribution.trim();

      return {
        config: {
          provider: "leaflet",
          defaultCenter,
          defaultZoom: zoom.value,
          leaflet: { tileUrl, attribution },
        },
        csp: { imgSrc: [parsedTileUrl.origin], connectSrc: [] },
        issues: [...issues],
      };
    },
  };
}
