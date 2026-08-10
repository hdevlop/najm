// ============================================================================
// najm-theme/server — the theme() plugin
// ============================================================================

import { Controller, Repository, plugin } from "najm-core";
import { I18N_CONTRIBUTIONS, i18n } from "najm-i18n";
import { validation } from "najm-validation";

import {
  AppearanceController,
  APPEARANCE_ROUTE_PREFIX,
} from "./appearance/AppearanceController";
import { AppearanceRepository } from "./appearance/AppearanceRepository";
import { AppearanceService } from "./appearance/AppearanceService";
import { AppearanceValidator } from "./appearance/AppearanceValidator";
import { BrandingAssetService } from "./branding/BrandingAssetService";
import {
  BrandingController,
  BRANDING_ROUTE_PREFIX,
} from "./branding/BrandingController";
import { BrandingRepository } from "./branding/BrandingRepository";
import { BrandingService } from "./branding/BrandingService";
import { BrandingValidator } from "./branding/BrandingValidator";
import {
  resolveThemeConfig,
  themePluginConfig,
  type NajmThemeOptions,
  type NajmThemePluginConfig,
  type ResolvedThemeConfig,
} from "./config";
import { THEME_LOCALES } from "./locales";
import { ThemeMcpTools } from "./mcp/ThemeMcpTools";
import {
  ThemePresetController,
  PRESETS_ROUTE_PREFIX,
} from "./presets/ThemePresetController";
import { ThemePresetRepository } from "./presets/ThemePresetRepository";
import { ThemePresetService } from "./presets/ThemePresetService";
import { ThemePresetValidator } from "./presets/ThemePresetValidator";
import { ThemeRequestContext } from "./shared/ThemeRequestContext";
import { THEME_CONFIG, THEME_SCHEMA } from "./tokens";
import { isNajmThemeDefinition, type NajmThemeDefinition } from "../contracts/factory";

type GuardDecorator = ClassDecorator & MethodDecorator;

/**
 * Applies guards to specific handlers.
 *
 * Method-level rather than class-level, because one controller carries routes
 * with different authorization: the public appearance read and the save that
 * follows it live on the same class, and a class decorator would either lock
 * the anonymous read out or open the save up.
 *
 * A Najm guard decorator only needs the prototype and the property name, so
 * applying one after the class is defined is the same operation the compiler
 * would have performed.
 */
function applyGuards(
  target: new (...args: never[]) => unknown,
  routes: Record<string, GuardDecorator[]>,
): void {
  for (const [methodName, guards] of Object.entries(routes)) {
    for (const guard of guards) {
      (guard as MethodDecorator)(
        target.prototype as object,
        methodName,
        Object.getOwnPropertyDescriptor(target.prototype, methodName) as PropertyDescriptor,
      );
    }
  }
}

/**
 * Re-applies `@Controller()` with the configured base path.
 *
 * The decorator writes one metadata key, and `MetaHelper.define` overwrites, so
 * this is a rebind rather than a second registration. It is how `basePath`
 * stays configuration: a class decorator is evaluated at import time, and the
 * configuration does not exist yet.
 *
 * One consequence worth stating: the base path is per class, not per plugin
 * instance. Registering `theme()` twice in one process with different base
 * paths would leave both on whichever was built last — the same constraint
 * `najm-storage` has for its route guards.
 */
function mountControllers(config: ResolvedThemeConfig): void {
  if (config.features.appearance) {
    Controller(`${config.basePath}${APPEARANCE_ROUTE_PREFIX}`)(AppearanceController);
  }
  if (config.features.branding) {
    Controller(`${config.basePath}${BRANDING_ROUTE_PREFIX}`)(BrandingController);
  }
  if (config.features.presets) {
    Controller(`${config.basePath}${PRESETS_ROUTE_PREFIX}`)(ThemePresetController);
  }
}

/** Binds every repository to the configured database rather than `"default"`. */
function bindRepositories(config: ResolvedThemeConfig): void {
  for (const repository of [AppearanceRepository, BrandingRepository, ThemePresetRepository]) {
    Repository(config.database)(repository);
  }
}

/**
 * Managed appearance, theme presets, and branding assets.
 *
 * **Plugin ordering.** `database()` must be registered before `theme()`. When
 * `features.assetUploads` is on, `storage()` must be too; when `features.mcp`
 * is on, so must `mcp()`.
 *
 * @example
 * ```ts
 * import { theme } from "najm-theme/server";
 * import { appTheme } from "../../theme";
 *
 * new Server()
 *   .use(database({ schema: { ...appSchema, ...themeSchema } }))
 *   .use(storage({ guards: [isAuth()] }))
 *   .use(theme(appTheme, {
 *     dialect: "sqlite",
 *     manage: [isAdmin()],
 *     audit: themeAudit,
 *   }))
 *   .base("/api");
 * ```
 *
 * The second form — `theme(config)` with factory callbacks — is the pre-0.2.0
 * contract and is deprecated; see `NajmThemePluginConfig`.
 */
export function theme(
  definitionOrConfig: NajmThemeDefinition | NajmThemePluginConfig,
  options?: NajmThemeOptions,
) {
  if (!isNajmThemeDefinition(definitionOrConfig) && options !== undefined) {
    throw new TypeError(
      "theme() takes policy options only alongside a defineTheme() definition — the deprecated single-config form carries its own",
    );
  }

  const resolved = resolveThemeConfig(
    isNajmThemeDefinition(definitionOrConfig)
      ? themePluginConfig(definitionOrConfig, options)
      : (definitionOrConfig as NajmThemePluginConfig),
  );

  mountControllers(resolved);
  bindRepositories(resolved);

  if (resolved.features.appearance) {
    applyGuards(AppearanceController as never, {
      getAppearance: resolved.guards.readAppearance,
      getAppearanceConfig: resolved.guards.manageAppearance,
      saveAppearance: resolved.guards.manageAppearance,
      resetAppearance: resolved.guards.manageAppearance,
    });
  }

  if (resolved.features.branding) {
    applyGuards(BrandingController as never, {
      getBranding: resolved.guards.readBranding,
      // The asset routes are how a browser fetches the logo on the login page,
      // so they follow the *public* read decision rather than the management
      // one. Guarding them while `GET /branding` stays public would publish
      // paths that answer 401.
      serveAsset: resolved.guards.readBranding,
      serveFactoryAsset: resolved.guards.readBranding,
      getBrandingConfig: resolved.guards.manageBranding,
      saveBranding: resolved.guards.manageBranding,
      resetBranding: resolved.guards.manageBranding,
      uploadAsset: resolved.guards.manageBranding,
      deleteAsset: resolved.guards.manageBranding,
      reconcileAssets: resolved.guards.manageBranding,
    });
  }

  if (resolved.features.presets) {
    applyGuards(ThemePresetController as never, {
      listPresets: resolved.guards.readPresets,
      createPreset: resolved.guards.managePresets,
      applyPreset: resolved.guards.managePresets,
      deletePreset: resolved.guards.managePresets,
    });
  }

  const builder = plugin("theme")
    .version("0.1.0")
    .depends(i18n(), validation())
    .requires("database")
    .contributes(I18N_CONTRIBUTIONS, THEME_LOCALES)
    .services(ThemeRequestContext)
    .config(THEME_CONFIG, resolved)
    .set(THEME_SCHEMA, resolved.schema);

  if (resolved.features.appearance) {
    builder.services(
      AppearanceRepository,
      AppearanceValidator,
      AppearanceService,
      AppearanceController,
    );
  }

  if (resolved.features.branding) {
    builder.services(
      BrandingRepository,
      BrandingValidator,
      BrandingAssetService,
      BrandingService,
      BrandingController,
    );
  }

  if (resolved.features.presets) {
    builder.services(
      ThemePresetRepository,
      ThemePresetValidator,
      ThemePresetService,
      ThemePresetController,
    );
  }

  // Declared, not assumed. `requires` fails registration with a message naming
  // the missing plugin, which is a better first encounter than a container
  // resolution error three layers down.
  if (resolved.features.assetUploads) builder.requires("storage");
  if (resolved.guards.manageAppearance.length || resolved.guards.manageBranding.length) {
    builder.requires("guards");
  }
  if (resolved.features.mcp) {
    builder.requires("mcp");
    builder.services(ThemeMcpTools);
  }

  return builder.build();
}
