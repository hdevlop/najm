import { parseNajmThemeConfig } from "./config";
import {
  NAJM_COMPONENT_NAMES,
  type NajmComponentName,
  type NajmComponentStyleConfig,
  type NajmComponentThemeConfig,
  type NajmDesignConfig,
  type NajmLayoutConfig,
  type NajmTypographyConfig,
  type NajmVariantStyle,
} from "./design-types";

const ROOT_KEYS = new Set(["version", "theme", "typography", "components", "layout"]);
const TYPOGRAPHY_KEYS = new Set([
  "fontSans",
  "fontHeading",
  "fontMono",
  "baseSize",
  "scale",
  "lineHeight",
  "letterSpacing",
]);
const LAYOUT_KEYS = new Set(["pageGutter", "sectionGap"]);
const COMPONENT_KEYS = new Set([
  "card",
  "showSectionLabels",
  "showSectionSeparators",
  "defaultVariant",
  "defaultSize",
  "density",
  "radius",
  "borderWidth",
  "slots",
  "variants",
]);
const SLOT_KEYS = new Set(["className", "radius", "borderWidth", "padding", "paddingTop"]);
const VARIANT_KEYS = new Set(["use", "className", "tokens"]);
const COMPONENT_NAME_SET = new Set<string>(NAJM_COMPONENT_NAMES);
const DENSITIES = new Set(["compact", "default", "comfortable"]);
const SCALES = new Set(["compact", "default", "comfortable"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertKnownKeys(
  value: Record<string, unknown>,
  keys: Set<string>,
  path: string,
): void {
  const unknown = Object.keys(value).find((key) => !keys.has(key));
  if (unknown) throw new TypeError(`Unknown ${path} property: ${unknown}`);
}

function optionalString(value: unknown, path: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new TypeError(`${path} must be a string`);
  }
  return value;
}

function optionalBoolean(value: unknown, path: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    throw new TypeError(`${path} must be a boolean`);
  }
  return value;
}

function optionalEnum(
  value: unknown,
  values: Set<string>,
  path: string,
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !values.has(value)) {
    throw new TypeError(`${path} must be one of: ${[...values].join(", ")}`);
  }
  return value;
}

function parseTypography(value: unknown): NajmTypographyConfig | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new TypeError("typography must be an object");
  assertKnownKeys(value, TYPOGRAPHY_KEYS, "typography");
  const cfg: NajmTypographyConfig = {};
  const fontSans = optionalString(value.fontSans, "typography.fontSans");
  const fontHeading = optionalString(value.fontHeading, "typography.fontHeading");
  const fontMono = optionalString(value.fontMono, "typography.fontMono");
  const baseSize = optionalString(value.baseSize, "typography.baseSize");
  const scale = optionalEnum(value.scale, SCALES, "typography.scale");
  const lineHeight = optionalString(value.lineHeight, "typography.lineHeight");
  const letterSpacing = optionalString(value.letterSpacing, "typography.letterSpacing");
  if (fontSans !== undefined) cfg.fontSans = fontSans;
  if (fontHeading !== undefined) cfg.fontHeading = fontHeading;
  if (fontMono !== undefined) cfg.fontMono = fontMono;
  if (baseSize !== undefined) cfg.baseSize = baseSize;
  if (scale !== undefined) cfg.scale = scale as NajmTypographyConfig["scale"];
  if (lineHeight !== undefined) cfg.lineHeight = lineHeight;
  if (letterSpacing !== undefined) cfg.letterSpacing = letterSpacing;
  return cfg;
}

function parseLayout(value: unknown): NajmLayoutConfig | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new TypeError("layout must be an object");
  assertKnownKeys(value, LAYOUT_KEYS, "layout");
  const cfg: NajmLayoutConfig = {};
  const pageGutter = optionalString(value.pageGutter, "layout.pageGutter");
  const sectionGap = optionalString(value.sectionGap, "layout.sectionGap");
  if (pageGutter !== undefined) cfg.pageGutter = pageGutter;
  if (sectionGap !== undefined) cfg.sectionGap = sectionGap;
  return cfg;
}

function parseVariant(value: unknown, path: string): NajmVariantStyle {
  if (!isRecord(value)) throw new TypeError(`${path} must be an object`);
  assertKnownKeys(value, VARIANT_KEYS, path);
  const variant: NajmVariantStyle = {};
  const use = optionalString(value.use, `${path}.use`);
  const className = optionalString(value.className, `${path}.className`);
  if (use !== undefined) variant.use = use;
  if (className !== undefined) variant.className = className;
  if (value.tokens !== undefined) {
    if (!isRecord(value.tokens)) throw new TypeError(`${path}.tokens must be an object`);
    variant.tokens = value.tokens as Record<string, string>;
  }
  return variant;
}

function parseComponentStyle(
  value: unknown,
  path: string,
): NajmComponentStyleConfig {
  if (!isRecord(value)) throw new TypeError(`${path} must be an object`);
  assertKnownKeys(value, COMPONENT_KEYS, path);
  const cfg: NajmComponentStyleConfig = {};
  const card = optionalBoolean(value.card, `${path}.card`);
  const showSectionLabels = optionalBoolean(value.showSectionLabels, `${path}.showSectionLabels`);
  const showSectionSeparators = optionalBoolean(value.showSectionSeparators, `${path}.showSectionSeparators`);
  const defaultVariant = optionalString(value.defaultVariant, `${path}.defaultVariant`);
  const defaultSize = optionalString(value.defaultSize, `${path}.defaultSize`);
  const density = optionalEnum(value.density, DENSITIES, `${path}.density`);
  const radius = optionalString(value.radius, `${path}.radius`);
  const borderWidth = optionalString(value.borderWidth, `${path}.borderWidth`);
  if (card !== undefined) cfg.card = card;
  if (showSectionLabels !== undefined) cfg.showSectionLabels = showSectionLabels;
  if (showSectionSeparators !== undefined) cfg.showSectionSeparators = showSectionSeparators;
  if (defaultVariant !== undefined) cfg.defaultVariant = defaultVariant;
  if (defaultSize !== undefined) cfg.defaultSize = defaultSize;
  if (density !== undefined) cfg.density = density as NajmComponentStyleConfig["density"];
  if (radius !== undefined) cfg.radius = radius;
  if (borderWidth !== undefined) cfg.borderWidth = borderWidth;
  if (value.slots !== undefined) {
    if (!isRecord(value.slots)) throw new TypeError(`${path}.slots must be an object`);
    const slots: NajmComponentStyleConfig["slots"] = {};
    for (const [slotName, slotValue] of Object.entries(value.slots)) {
      if (!isRecord(slotValue)) throw new TypeError(`${path}.slots.${slotName} must be an object`);
      assertKnownKeys(slotValue, SLOT_KEYS, `${path}.slots.${slotName}`);
      slots[slotName] = slotValue as NajmComponentStyleConfig["slots"][string];
    }
    cfg.slots = slots;
  }
  if (value.variants !== undefined) {
    if (!isRecord(value.variants)) throw new TypeError(`${path}.variants must be an object`);
    const variants: Record<string, NajmVariantStyle> = {};
    for (const [variantName, variantValue] of Object.entries(value.variants)) {
      variants[variantName] = parseVariant(variantValue, `${path}.variants.${variantName}`);
    }
    cfg.variants = variants;
  }
  return cfg;
}

function parseComponents(value: unknown): NajmComponentThemeConfig | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new TypeError("components must be an object");
  const unknown = Object.keys(value).find((key) => !COMPONENT_NAME_SET.has(key));
  if (unknown) throw new TypeError(`Unknown component name: ${unknown}`);
  const components: NajmComponentThemeConfig = {};
  for (const [name, cfg] of Object.entries(value)) {
    components[name as NajmComponentName] = parseComponentStyle(cfg, `components.${name}`);
  }
  return components;
}

/** Keeps authored TypeScript design objects type-checked without changing them. */
export function defineNajmDesignConfig(config: NajmDesignConfig): NajmDesignConfig {
  return config;
}

/** Parses and validates a design config (theme + typography + component recipes). */
export function parseNajmDesignConfig(input: unknown): NajmDesignConfig {
  let value = input;
  if (typeof input === "string") {
    try {
      value = JSON.parse(input);
    } catch (error) {
      throw new TypeError(`Invalid design JSON: ${(error as Error).message}`);
    }
  }

  if (!isRecord(value)) throw new TypeError("Design config must be an object");

  // Accept a bare NajmThemeConfig and wrap it.
  if (!("version" in value) && !("theme" in value)) {
    return {
      version: 1,
      theme: parseNajmThemeConfig(value),
    };
  }

  assertKnownKeys(value, ROOT_KEYS, "design");

  if (value.version !== undefined && value.version !== 1) {
    throw new TypeError("design.version must be 1");
  }
  if (value.theme === undefined) throw new TypeError("design.theme is required");

  const config: NajmDesignConfig = {
    version: 1,
    theme: parseNajmThemeConfig(value.theme),
  };

  const typography = parseTypography(value.typography);
  if (typography !== undefined) config.typography = typography;
  const components = parseComponents(value.components);
  if (components !== undefined) config.components = components;
  const layout = parseLayout(value.layout);
  if (layout !== undefined) config.layout = layout;

  return config;
}

export function stringifyNajmDesignConfig(config: NajmDesignConfig, space = 2): string {
  return JSON.stringify(config, null, space);
}

/**
 * Resolves a variant against its recipe, following `use` aliases while guarding
 * against loops. Returns the effective variant name and merged style.
 */
export function resolveVariantAlias(
  variants: Record<string, NajmVariantStyle> | undefined,
  variant: string,
): { variant: string; style?: NajmVariantStyle } {
  if (!variants) return { variant };
  const seen = new Set<string>();
  let current = variant;
  let style = variants[current];
  while (style?.use && !seen.has(current)) {
    seen.add(current);
    const next = style.use;
    if (seen.has(next)) break; // loop guard -> fall back to original chain
    current = next;
    style = variants[current];
  }
  return { variant: current, style };
}
