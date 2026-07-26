import type {
  NajmAccent,
  NajmMode,
  NajmPreset,
  NajmThemeConfig,
  NajmThemeTokens,
} from './types';

const MODES = ['light', 'dark'] as const satisfies readonly NajmMode[];
const ACCENTS = ['neutral', 'emerald', 'green', 'slate', 'blue', 'violet'] as const satisfies readonly NajmAccent[];
const PRESETS = ['light', 'dark', 'dark-emerald', 'dark-green', 'dark-slate', 'dark-blue', 'dark-violet'] as const satisfies readonly NajmPreset[];
const TOKEN_KEYS = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'tertiary',
  'tertiary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'destructive-foreground',
  'border',
  'input',
  'ring',
  'sidebar',
  'sidebar-foreground',
  'sidebar-primary',
  'sidebar-primary-foreground',
  'sidebar-accent',
  'sidebar-accent-foreground',
  'sidebar-border',
  'sidebar-ring',
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
  'radius',
] as const satisfies readonly (keyof NajmThemeTokens)[];

const ROOT_KEYS = new Set([
  'preset',
  'mode',
  'accent',
  'tokens',
  'overrides',
  'accentOnly',
  'appearance',
  'radius',
]);
const TOKEN_KEY_SET = new Set<string>(TOKEN_KEYS);
const MODE_KEY_SET = new Set<string>(MODES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertKnownKeys(value: Record<string, unknown>, keys: Set<string>, path: string): void {
  const unknown = Object.keys(value).find((key) => !keys.has(key));
  if (unknown) throw new TypeError(`Unknown ${path} property: ${unknown}`);
}

function optionalEnum<T extends string>(
  value: unknown,
  values: readonly T[],
  path: string,
): T | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw new TypeError(`${path} must be one of: ${values.join(', ')}`);
  }
  return value as T;
}

function optionalString(value: unknown, path: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${path} must be a non-empty string`);
  }
  return value;
}

function parseTokens(value: unknown): NajmThemeTokens | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new TypeError('theme.tokens must be an object');
  assertKnownKeys(value, TOKEN_KEY_SET, 'theme.tokens');

  const tokens: NajmThemeTokens = {};
  for (const key of TOKEN_KEYS) {
    const token = optionalString(value[key], `theme.tokens.${key}`);
    if (token !== undefined) tokens[key] = token;
  }
  return tokens;
}

function parseOverrides(
  value: unknown,
): Partial<Record<NajmMode, NajmThemeTokens>> | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new TypeError('theme.overrides must be an object');
  assertKnownKeys(value, MODE_KEY_SET, 'theme.overrides');

  const overrides: Partial<Record<NajmMode, NajmThemeTokens>> = {};
  for (const mode of MODES) {
    const entry = value[mode];
    if (entry === undefined) continue;
    overrides[mode] = parseTokens(entry) ?? {};
  }
  return overrides;
}

/** Keeps authored TypeScript theme objects type-checked without changing them. */
export function defineNajmThemeConfig(config: NajmThemeConfig): NajmThemeConfig {
  return config;
}

/** Parses and validates theme settings loaded from JSON, an API, or local storage. */
export function parseNajmThemeConfig(input: unknown): NajmThemeConfig {
  let value = input;
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input);
    } catch (error) {
      throw new TypeError(`Invalid theme JSON: ${(error as Error).message}`);
    }
  }

  if (!isRecord(value)) throw new TypeError('Theme config must be an object');
  assertKnownKeys(value, ROOT_KEYS, 'theme');

  let appearance: NajmThemeConfig['appearance'];
  if (value.appearance !== undefined) {
    if (!isRecord(value.appearance)) throw new TypeError('theme.appearance must be an object');
    assertKnownKeys(value.appearance, new Set(['borderWidth']), 'theme.appearance');
    appearance = {
      borderWidth: optionalString(
        value.appearance.borderWidth,
        'theme.appearance.borderWidth',
      ),
    };
  }

  const accentOnly = value.accentOnly;
  if (accentOnly !== undefined && typeof accentOnly !== 'boolean') {
    throw new TypeError('theme.accentOnly must be a boolean');
  }
  const parsedAccentOnly = typeof accentOnly === 'boolean' ? accentOnly : undefined;

  const config: NajmThemeConfig = {};
  const preset = optionalEnum(value.preset, PRESETS, 'theme.preset');
  const mode = optionalEnum(value.mode, MODES, 'theme.mode');
  const accent = optionalEnum(value.accent, ACCENTS, 'theme.accent');
  const tokens = parseTokens(value.tokens);
  const overrides = parseOverrides(value.overrides);
  const radius = optionalString(value.radius, 'theme.radius');

  if (preset !== undefined) config.preset = preset;
  if (mode !== undefined) config.mode = mode;
  if (accent !== undefined) config.accent = accent;
  if (tokens !== undefined) config.tokens = tokens;
  if (overrides !== undefined) config.overrides = overrides;
  if (parsedAccentOnly !== undefined) config.accentOnly = parsedAccentOnly;
  if (appearance !== undefined) config.appearance = appearance;
  if (radius !== undefined) config.radius = radius;

  return config;
}

export function stringifyNajmThemeConfig(config: NajmThemeConfig, space = 2): string {
  return JSON.stringify(config, null, space);
}
