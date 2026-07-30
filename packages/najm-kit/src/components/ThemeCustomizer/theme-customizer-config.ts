import type { NajmDesignConfig } from "../../theme/design-types";
import type {
  NajmMode,
  NajmThemeConfig,
  NajmThemeTokens,
} from "../../theme/types";
import { composePreset } from "../../theme/presets/compose";
import { parseNajmDesignConfig } from "../../theme/design-config";
import { parseColor } from "../inputs/color/convert";
import { RADIUS_VALUE_MAP } from "../../theme/design-types";
import type {
  NajmComponentName,
  NajmComponentStyleConfig,
  NajmLayoutConfig,
  NajmTypographyConfig,
} from "../../theme/design-types";

export const THEME_TOKEN_KEYS = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "tertiary",
  "tertiary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "border",
  "input",
  "ring",
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
] as const satisfies readonly (keyof NajmThemeTokens)[];

export type ThemeCustomizerTokenKey = (typeof THEME_TOKEN_KEYS)[number];

export const RADIUS_VALUES = [
  "0",
  "2px",
  "4px",
  "6px",
  "8px",
  "10px",
  "12px",
  "14px",
  "16px",
  "18px",
  "20px",
  "24px",
] as const;

export const BORDER_WIDTH_VALUES = ["0", "1px", "2px"] as const;

export const FONT_SIZE_VALUES = [
  "14px",
  "15px",
  "16px",
  "17px",
  "18px",
] as const;

export const SCALE_VALUES = [
  { value: "compact", key: "compact" },
  { value: "default", key: "default" },
  { value: "comfortable", key: "comfortable" },
] as const;

export const LINE_HEIGHT_VALUES = ["1.2", "1.4", "1.5", "1.6", "1.75"] as const;

export const LETTER_SPACING_VALUES = [
  "-0.02em",
  "-0.01em",
  "0",
  "0.01em",
  "0.02em",
] as const;

export const LAYOUT_SIZE_VALUES = [
  "8px",
  "12px",
  "16px",
  "20px",
  "24px",
  "32px",
  "40px",
  "48px",
] as const;

export const COMPONENT_BORDER_WIDTH_VALUES = ["0", "1px", "2px"] as const;

const HEX_RE = /^#([a-f\d]{3,4}|[a-f\d]{6}|[a-f\d]{8})$/i;

/**
 * Returns true when `value` parses as a valid CSS color. Reuses the
 * Culori-backed `parseColor` already used by `ColorPickerInput`; the editor
 * never invents a second color parser.
 */
export function isValidColorString(value: string): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (HEX_RE.test(trimmed)) return true;
  return parseColor(trimmed) !== undefined;
}

export function isValidCssLength(value: string): boolean {
  if (!value) return false;
  return /^([\d.]+)(px|rem|em|%|vh|vw)$/i.test(value.trim()) || value.trim() === "0";
}

export function isValidRadius(value: string): boolean {
  if (!value) return false;
  if (RADIUS_VALUE_MAP[value]) return true;
  return isValidCssLength(value);
}

function parseLengthRemToPxOrPass(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "0") return 0;
  const rem = trimmed.match(/^([\d.]+)rem$/);
  if (rem) return Number(rem[1]) * 16;
  const px = trimmed.match(/^([\d.]+)px$/);
  if (px) return Number(px[1]);
  return null;
}

export function remToPx(value: string): number {
  const n = parseLengthRemToPxOrPass(value);
  return n ?? 0;
}

/**
 * Whether the provider would read `config.theme.tokens` for the requested mode.
 * Mirrors `resolveThemeTokens` in `theme/provider.tsx`:
 *   tokensMatchMode = !configMode || !tokenMode || configMode === tokenMode
 * which collapses to `!configMode || configMode === mode` when `mode` is set.
 */
function tokensMatchMode(config: NajmDesignConfig, mode: NajmMode): boolean {
  const configMode = config.theme.mode;
  return !configMode || configMode === mode;
}

function baseForMode(config: NajmDesignConfig, mode: NajmMode): NajmThemeTokens {
  if (tokensMatchMode(config, mode)) {
    return { ...(config.theme.tokens ?? {}) };
  }
  return composePreset(mode, config.theme.accent ?? "neutral");
}

function effectiveForMode(
  config: NajmDesignConfig,
  mode: NajmMode,
): NajmThemeTokens {
  return { ...baseForMode(config, mode), ...(config.theme.overrides?.[mode] ?? {}) };
}

/** Returns the effective token value the provider would render for the given mode. */
export function getEffectiveThemeToken(
  config: NajmDesignConfig,
  mode: NajmMode,
  key: keyof NajmThemeTokens,
): string | undefined {
  return effectiveForMode(config, mode)[key];
}

/** Reads the authored value for a token from a config, preferring the provider's source. */
function readAuthoredToken(
  config: NajmDesignConfig,
  mode: NajmMode,
  key: keyof NajmThemeTokens,
): string | undefined {
  if (mode === "dark") {
    return config.theme.overrides?.dark?.[key];
  }
  // Light: provider reads from theme.tokens when configMode matches (or is unset),
  // otherwise from overrides.light.
  if (tokensMatchMode(config, "light")) {
    return config.theme.tokens?.[key];
  }
  return config.theme.overrides?.light?.[key];
}

/**
 * Sets a single theme token, writing to wherever the provider actually reads
 * from for the given mode. Light edits land in `theme.tokens` when
 * `config.theme.mode` matches the edit (or is unset), otherwise in
 * `overrides.light`. Dark edits always go to `overrides.dark`.
 */
export function setThemeToken(
  config: NajmDesignConfig,
  mode: NajmMode,
  key: keyof NajmThemeTokens,
  value: string,
): NajmDesignConfig {
  if (mode === "dark") {
    const overrides = { ...(config.theme.overrides ?? {}) };
    const darkBucket = { ...(overrides.dark ?? {}) } as Record<string, string>;
    darkBucket[key as string] = value;
    overrides.dark = darkBucket as NajmThemeTokens;
    return {
      ...config,
      theme: { ...config.theme, overrides },
    };
  }
  // Light
  if (tokensMatchMode(config, "light")) {
    const tokens = { ...(config.theme.tokens ?? {}), [key]: value } as NajmThemeTokens;
    const theme: NajmThemeConfig = { ...config.theme, tokens };
    // Clear a possibly-stale overrides.light key so the new value wins.
    if (theme.overrides?.light) {
      const overrides = { ...theme.overrides };
      const lightBucket = { ...overrides.light };
      delete lightBucket[key as string];
      if (Object.keys(lightBucket).length === 0) delete overrides.light;
      else overrides.light = lightBucket as NajmThemeTokens;
      if (Object.keys(overrides).length === 0) delete theme.overrides;
      else theme.overrides = overrides;
    }
    return { ...config, theme };
  }
  const overrides = { ...(config.theme.overrides ?? {}) };
  const lightBucket = { ...(overrides.light ?? {}) } as Record<string, string>;
  lightBucket[key as string] = value;
  overrides.light = lightBucket as NajmThemeTokens;
  return {
    ...config,
    theme: { ...config.theme, overrides },
  };
}

export function resetThemeToken(
  config: NajmDesignConfig,
  factoryConfig: NajmDesignConfig,
  mode: NajmMode,
  key: keyof NajmThemeTokens,
): NajmDesignConfig {
  const factoryValue = readAuthoredToken(factoryConfig, mode, key);
  if (factoryValue !== undefined) {
    return setThemeToken(config, mode, key, factoryValue);
  }
  // No authored factory value: drop the corresponding authored value in the
  // current config, so the provider's composed preset takes over.
  if (mode === "light" && tokensMatchMode(config, "light")) {
    const tokens = { ...(config.theme.tokens ?? {}) } as Record<string, string | undefined>;
    delete tokens[key as string];
    const theme: NajmThemeConfig = { ...config.theme, tokens: tokens as NajmThemeTokens };
    if (theme.overrides?.light) {
      const overrides = { ...theme.overrides };
      const lightBucket = { ...overrides.light };
      delete lightBucket[key as string];
      if (Object.keys(lightBucket).length === 0) delete overrides.light;
      else overrides.light = lightBucket as NajmThemeTokens;
      if (Object.keys(overrides).length === 0) delete theme.overrides;
      else theme.overrides = overrides;
    }
    return { ...config, theme };
  }
  if (mode === "dark" && config.theme.overrides?.dark) {
    const overrides = { ...config.theme.overrides };
    const darkBucket = { ...overrides.dark };
    delete darkBucket[key as string];
    if (Object.keys(darkBucket).length === 0) delete overrides.dark;
    else overrides.dark = darkBucket as NajmThemeTokens;
    const theme: NajmThemeConfig = { ...config.theme };
    if (Object.keys(overrides).length === 0) delete theme.overrides;
    else theme.overrides = overrides;
    return { ...config, theme };
  }
  if (mode === "light" && config.theme.overrides?.light) {
    const overrides = { ...config.theme.overrides };
    const lightBucket = { ...overrides.light };
    delete lightBucket[key as string];
    if (Object.keys(lightBucket).length === 0) delete overrides.light;
    else overrides.light = lightBucket as NajmThemeTokens;
    const theme: NajmThemeConfig = { ...config.theme };
    if (Object.keys(overrides).length === 0) delete theme.overrides;
    else theme.overrides = overrides;
    return { ...config, theme };
  }
  return config;
}

export function setThemeField<K extends keyof NajmThemeConfig>(
  config: NajmDesignConfig,
  key: K,
  value: NajmThemeConfig[K],
): NajmDesignConfig {
  if (value === undefined) {
    const next = { ...config };
    const theme = { ...config.theme };
    delete theme[key];
    next.theme = theme;
    return next;
  }
  return { ...config, theme: { ...config.theme, [key]: value } };
}

export function setTypographyField<K extends keyof NajmTypographyConfig>(
  config: NajmDesignConfig,
  key: K,
  value: NajmTypographyConfig[K],
): NajmDesignConfig {
  const typography: NajmTypographyConfig = { ...(config.typography ?? {}) };
  if (value === undefined || value === "") {
    delete typography[key];
  } else {
    typography[key] = value;
  }
  if (Object.keys(typography).length === 0) {
    const next = { ...config };
    delete next.typography;
    return next;
  }
  return { ...config, typography };
}

export function setLayoutField<K extends keyof NajmLayoutConfig>(
  config: NajmDesignConfig,
  key: K,
  value: NajmLayoutConfig[K],
): NajmDesignConfig {
  const layout: NajmLayoutConfig = { ...(config.layout ?? {}) };
  if (value === undefined || value === "") {
    delete layout[key];
  } else {
    layout[key] = value;
  }
  if (Object.keys(layout).length === 0) {
    const next = { ...config };
    delete next.layout;
    return next;
  }
  return { ...config, layout };
}

export function setComponentField<K extends keyof NajmComponentStyleConfig>(
  config: NajmDesignConfig,
  component: NajmComponentName,
  key: K,
  value: NajmComponentStyleConfig[K],
): NajmDesignConfig {
  const components = { ...(config.components ?? {}) };
  const current: NajmComponentStyleConfig = { ...(components[component] ?? {}) };
  if (value === undefined || value === "") {
    delete current[key];
  } else {
    current[key] = value;
  }
  if (Object.keys(current).length === 0) {
    delete components[component];
  } else {
    components[component] = current;
  }
  if (Object.keys(components).length === 0) {
    const next = { ...config };
    delete next.components;
    return next;
  }
  return { ...config, components };
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const VISUAL_THEME_KEYS = [
  "tokens",
  "overrides",
  "radius",
  "appearance",
] as const satisfies ReadonlyArray<keyof NajmThemeConfig>;

const IDENTITY_THEME_KEYS = [
  "preset",
  "mode",
  "accent",
  "accentOnly",
] as const satisfies ReadonlyArray<keyof NajmThemeConfig>;

function pickFactoryFields(
  factoryTheme: NajmThemeConfig,
  keys: ReadonlyArray<keyof NajmThemeConfig>,
): NajmThemeConfig {
  const out: NajmThemeConfig = {};
  for (const key of keys) {
    if (factoryTheme[key] !== undefined) {
      (out as Record<string, unknown>)[key as string] = factoryTheme[key];
    }
  }
  return out;
}

function pickFactoryOrCurrent(
  config: NajmDesignConfig,
  factoryConfig: NajmDesignConfig,
  keys: ReadonlyArray<keyof NajmThemeConfig>,
): NajmThemeConfig {
  // For identity fields (preset, mode, accent, accentOnly) the editor does not
  // expose any control, so reset must leave the current value untouched and
  // never import it from the factory.
  const out: NajmThemeConfig = {};
  for (const key of keys) {
    if (config.theme[key] !== undefined) {
      (out as Record<string, unknown>)[key as string] = config.theme[key];
    }
  }
  void factoryConfig;
  return out;
}

/**
 * Resets the visual theme subset (tokens, overrides, radius,
 * appearance) to the factory. Identity fields (preset, mode, accent,
 * accentOnly) are left exactly as the caller authored them and are never
 * replaced by the factory.
 */
export function resetThemeSection(
  config: NajmDesignConfig,
  factoryConfig: NajmDesignConfig,
): NajmDesignConfig {
  const visualTheme: NajmThemeConfig = pickFactoryFields(
    factoryConfig.theme,
    VISUAL_THEME_KEYS,
  );
  // Deep-clone authored buckets so callers never share nested references with
  // the factory value.
  if (visualTheme.tokens) visualTheme.tokens = deepClone(visualTheme.tokens);
  if (visualTheme.overrides) visualTheme.overrides = deepClone(visualTheme.overrides);
  if (visualTheme.appearance) visualTheme.appearance = deepClone(visualTheme.appearance);
  const identity = pickFactoryOrCurrent(config, factoryConfig, IDENTITY_THEME_KEYS);
  return {
    ...config,
    theme: { ...identity, ...visualTheme },
  };
}

export function resetTypographySection(
  config: NajmDesignConfig,
  factoryConfig: NajmDesignConfig,
): NajmDesignConfig {
  if (!factoryConfig.typography) {
    const next = { ...config };
    delete next.typography;
    return next;
  }
  return { ...config, typography: deepClone(factoryConfig.typography) };
}

const EDITED_COMPONENT_KEYS = [
  "card",
  "showSectionLabels",
  "showSectionSeparators",
  "expandedWidth",
  "collapsedWidth",
  "mobileWidth",
  "headerColor",
  "headerTextColor",
  "borderColor",
  "borderWidth",
] as const satisfies ReadonlyArray<keyof NajmComponentStyleConfig>;

const EDITED_LAYOUT_KEYS = ["pageGutter", "sectionGap"] as const satisfies ReadonlyArray<
  keyof NajmLayoutConfig
>;

/**
 * Resets only the exposed components/layout fields. For each component in the
 * current config, the exposed fields are synced with the factory: missing
 * factory values are removed, and components the factory does not define have
 * their exposed fields cleared. Components entirely absent from the current
 * config (and not present in the factory) are skipped. Unexposed component
 * fields (radius, slots, variants, etc.) are preserved.
 */
export function resetComponentsLayoutSection(
  config: NajmDesignConfig,
  factoryConfig: NajmDesignConfig,
): NajmDesignConfig {
  const next = { ...config };
  if (factoryConfig.layout) {
    const layout: NajmLayoutConfig = { ...(next.layout ?? {}) };
    for (const key of EDITED_LAYOUT_KEYS) {
      if (factoryConfig.layout[key] !== undefined) {
        layout[key] = factoryConfig.layout[key];
      } else {
        delete layout[key];
      }
    }
    if (Object.keys(layout).length === 0) delete next.layout;
    else next.layout = layout;
  } else if (next.layout) {
    const layout = { ...next.layout };
    for (const key of EDITED_LAYOUT_KEYS) delete layout[key];
    if (Object.keys(layout).length === 0) delete next.layout;
    else next.layout = layout;
  }
  if (next.components || factoryConfig.components) {
    const components = { ...(next.components ?? {}) };
    const factoryComponents = factoryConfig.components ?? {};
    const allNames = new Set<string>([
      ...Object.keys(components),
      ...Object.keys(factoryComponents),
    ]);
    for (const name of allNames) {
      const current = { ...(components[name as NajmComponentName] ?? {}) };
      const factoryStyle = factoryComponents[name as NajmComponentName];
      let touched = false;
      for (const key of EDITED_COMPONENT_KEYS) {
        if (factoryStyle?.[key] !== undefined) {
          (current as Record<string, unknown>)[key as string] = factoryStyle[key];
          touched = true;
        } else if (key in current) {
          delete (current as Record<string, unknown>)[key as string];
          touched = true;
        }
      }
      if (!touched) continue;
      if (Object.keys(current).length === 0) delete components[name];
      else components[name] = current as NajmComponentStyleConfig;
    }
    if (Object.keys(components).length === 0) delete next.components;
    else next.components = components;
  }
  return next;
}

export function validateConfig(config: NajmDesignConfig): NajmDesignConfig {
  return parseNajmDesignConfig(config);
}

export function isTokenKey(key: string): key is ThemeCustomizerTokenKey {
  return (THEME_TOKEN_KEYS as readonly string[]).includes(key);
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
