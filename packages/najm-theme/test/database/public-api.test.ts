import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// ============================================================================
// A public-API snapshot per subpath.
//
// The repository's `api:check` reads `packages/*/src/index.ts` only, which for
// this package is one `export *`. That is accurate and useless: the surface
// consumers actually import lives behind `/server`, `/react`, `/pg`, and
// `/sqlite`, and a rename there would pass the shared check untouched.
//
// So this reads the *generated declarations* — the file a consumer's TypeScript
// resolves — and pins the exported names. It fails on any addition or removal,
// which is the point: the diff is the changelog entry someone forgot to write.
// ============================================================================

const DIST = resolve(import.meta.dir, "../../dist");
const BUILT = existsSync(resolve(DIST, "index.d.ts"));

/**
 * The names an entry re-exports, from every `export { … } from "…"` clause and
 * every direct `declare`. `tsup` writes bundled declarations as one or more
 * export clauses with `a as Name` aliases, so the *local* half of each pair is
 * dropped and the public half kept.
 */
function exportedNames(relative: string): string[] {
  const source = readFileSync(resolve(DIST, relative), "utf8");
  const names = new Set<string>();

  for (const clause of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const entry of clause[1].split(",")) {
      const trimmed = entry.trim();
      if (!trimmed) continue;
      const aliased = trimmed.match(/\bas\s+([A-Za-z_$][\w$]*)\s*$/);
      const name = aliased
        ? aliased[1]
        : trimmed.replace(/^type\s+/, "").trim();
      if (name) names.add(name);
    }
  }

  for (const declaration of source.matchAll(
    /^export\s+declare\s+(?:function|const|class|abstract class)\s+([A-Za-z_$][\w$]*)/gm,
  )) {
    names.add(declaration[1]);
  }

  return [...names].sort();
}

describe.skipIf(!BUILT)("najm-theme", () => {
  it("exports exactly the universal contracts", () => {
    expect(exportedNames("index.d.ts")).toEqual(exportedNames("contracts/index.d.ts"));
  });
});

describe.skipIf(!BUILT)("najm-theme/contracts", () => {
  it("exports the frozen contract surface", () => {
    expect(exportedNames("contracts/index.d.ts")).toEqual([
      "APPEARANCE_EDITABLE_GROUPS",
      "AdminAppearance",
      "AdminBranding",
      "AdminBrandingSlot",
      "AppearanceGroup",
      "BRANDING_RASTER_MIME_TYPES",
      "BrandingPreviewAspect",
      "BrandingSlotAsset",
      "BrandingSlotConfig",
      "BrandingSlotDefinition",
      "BrandingSlotFallback",
      "BrandingSlotKind",
      "CreateThemePresetInput",
      "DEFAULT_APPEARANCE_LIMITS",
      "DEFAULT_MAX_THEME_PRESETS",
      "DEFAULT_THEME_SCOPE_ID",
      "FactoryBranding",
      "FactoryPath",
      "INITIAL_THEME_REVISION",
      "MAX_APPEARANCE_LIMITS",
      "MAX_BRANDING_SLOT_BYTES",
      "MAX_THEME_PRESETS_CEILING",
      "NO_THEME_CAPABILITIES",
      "NajmDesignConfig",
      "NajmThemeFeatures",
      "PublicAppearance",
      "PublicBranding",
      "PublicThemePreset",
      "ResolveBrandingOptions",
      "ResolvedBrandingSlot",
      "STANDARD_BRANDING_SLOTS",
      "THEME_PRESET_NAME_MAX_LENGTH",
      "THEME_PRESET_SLUG_MAX_LENGTH",
      "THEME_SCOPE_ID_MAX_LENGTH",
      "ThemeAppearanceLimits",
      "ThemeCapabilities",
      "ThemeDiagnostic",
      "ThemeDiagnosticCode",
      "ThemeDiagnosticSink",
      "ThemeRevisionConflictError",
      "ThemeRevisionResource",
      "ThemeScopeContext",
      "ThemeScopeResolver",
      "assertBrandingSlotDefinitions",
      "assertFeatureDependencies",
      "assertThemePresetName",
      "assertThemeRevision",
      "assertThemeScopeId",
      "capabilitiesFor",
      "changedAppearanceGroups",
      "describeThrown",
      "isBrandingAssetFileName",
      "isBrandingSlotKey",
      "isPublicThemePreset",
      "isThemePresetSlug",
      "isThemeRevision",
      "isThemeRevisionConflict",
      "isThemeScopeId",
      "mergeAppearance",
      "nextThemeRevision",
      "parsePublicAppearance",
      "parsePublicBranding",
      "parseSafeDesignConfig",
      "pickAppearancePatch",
      "platformScope",
      "readBrandingSlotConfig",
      "reportDiagnostic",
      "resolveAppearanceLimits",
      "resolveBrandingSlots",
      "themePresetSlug",
      "uniqueThemePresetSlug",
    ]);
  });
});

describe.skipIf(!BUILT)("najm-theme/server", () => {
  const names = () => exportedNames("server/index.d.ts");

  it("exports the plugin, its configuration, and the composition points", () => {
    for (const name of [
      "theme",
      "resolveThemeConfig",
      "NajmThemePluginConfig",
      "ResolvedThemeConfig",
      "ThemeRouteGuards",
      "ThemeStorageConfig",
      "ThemeLimits",
      "ThemeFactoryValues",
      "ThemeGuardDecorator",
      "ThemeSchema",
      "THEME_CONFIG",
      "THEME_SCHEMA",
      "ThemeAuditSink",
      "ThemeAuditEvent",
      "ThemeAuditAction",
      "ThemeAuditMetadata",
      "themeAuditEvent",
      "THEME_CONFLICT_CODE",
      "ThemeNotFoundError",
      "ThemePolicyError",
      "THEME_LOCALES",
      "THEME_SUPPORTED_LANGUAGES",
      "getThemeLocale",
      "APPEARANCE_ROUTE_PREFIX",
      "BRANDING_ROUTE_PREFIX",
      "PRESETS_ROUTE_PREFIX",
    ]) {
      expect(names()).toContain(name);
    }
  });

  it("re-exports the contracts so backend code needs one import", () => {
    for (const name of ["parseSafeDesignConfig", "STANDARD_BRANDING_SLOTS", "platformScope"]) {
      expect(names()).toContain(name);
    }
  });

  it("publishes the services as types only, never as constructable values", () => {
    // They are registered by `theme()` and resolved through the container.
    // Exporting the class *value* would invite an application to construct a
    // second one that shares no configuration — so the declarations name them
    // (a type has to be nameable) and the runtime entry does not.
    const runtime = readFileSync(resolve(DIST, "server/index.js"), "utf8");
    const runtimeExports = [...runtime.matchAll(/export\s*\{([^}]*)\}/g)]
      .flatMap((clause) => clause[1].split(","))
      .map((entry) => entry.trim().replace(/^.*\bas\s+/, ""))
      .filter(Boolean);

    for (const name of [
      "AppearanceService",
      "BrandingService",
      "BrandingAssetService",
      "ThemePresetService",
    ]) {
      expect(names()).toContain(name);
      expect(runtimeExports).not.toContain(name);
    }
  });

  it("does not export a controller, repository, or validator at all", () => {
    for (const name of ["AppearanceController", "AppearanceRepository", "BrandingValidator"]) {
      expect(names()).not.toContain(name);
    }
  });
});

describe.skipIf(!BUILT)("najm-theme/react", () => {
  const names = () => exportedNames("react/index.d.ts");

  it("exports the provider, every section, and the transport", () => {
    for (const name of [
      "NThemeSettingsProvider",
      "NThemeSettingsValue",
      "NThemeSettingsProviderProps",
      "useNThemeSettings",
      "useNThemeSettingsOptional",
      "NThemeAppearanceSettings",
      "NThemeBrandingSettings",
      "NThemePresetSettings",
      "NThemeSettingsActions",
      "NThemeSettingsSaveButton",
      "NThemeSettingsResetButton",
      "NThemeSettingsStatus",
      "NThemeSettings",
      "createThemeClient",
      "isThemeConflictError",
      "ThemeClient",
      "ThemeClientOptions",
      "themeQueryKeys",
      "createThemeTranslator",
      "THEME_LANGUAGES",
      "THEME_UI_LOCALES",
    ]) {
      expect(names()).toContain(name);
    }
  });

  it("exposes a props type for every component", () => {
    for (const component of [
      "NThemeAppearanceSettings",
      "NThemeBrandingSettings",
      "NThemePresetSettings",
      "NThemeSettingsActions",
      "NThemeSettingsSaveButton",
      "NThemeSettingsResetButton",
      "NThemeSettingsStatus",
      "NThemeSettings",
    ]) {
      expect(names()).toContain(`${component}Props`);
    }
  });

  it("never exports the plugin or a server type", () => {
    for (const name of ["theme", "resolveThemeConfig", "THEME_CONFIG", "ThemeAuditSink"]) {
      expect(names()).not.toContain(name);
    }
  });
});

describe.skipIf(!BUILT)("dialect entries", () => {
  it("export the same names from both dialects", () => {
    expect(exportedNames("schema/sqlite.d.ts")).toEqual(exportedNames("schema/pg.d.ts"));
  });

  it("export each feature schema and the combined one", () => {
    for (const name of [
      "najmThemeAppearance",
      "najmThemeBranding",
      "najmThemePresets",
      "appearanceSchema",
      "brandingSchema",
      "themePresetSchema",
      "themeSchema",
      "ThemeSchema",
      "AppearanceEntity",
      "NewAppearanceEntity",
      "BrandingEntity",
      "NewBrandingEntity",
      "ThemePresetEntity",
      "NewThemePresetEntity",
    ]) {
      expect(exportedNames("schema/pg.d.ts")).toContain(name);
    }
  });
});

describe.skipIf(!BUILT)("najm-theme/server/react", () => {
  it("exports the bootstrap factory and its types, and nothing else", () => {
    expect(exportedNames("server/react.d.ts")).toEqual([
      "PublicAppearance",
      "PublicBranding",
      "ReactThemeBootstrap",
      "ReactThemeBootstrapConfig",
      "ThemeBootstrapFetcher",
      "createReactThemeBootstrap",
    ]);
  });
});
