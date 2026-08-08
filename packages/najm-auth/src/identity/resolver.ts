import { DEFAULT_IDENTITY_PRESET, IDENTITY_PRESETS, compactPhone } from './presets';
import type { IdentityConfig, IdentityNormalizer, IdentityPreset } from './types';

const MAX_IDENTIFIER_LENGTH = 254;
const E164 = /^\+[1-9]\d{7,14}$/;

/**
 * Generic, country-agnostic tail of every pipeline: an already international
 * number, with or without the `00` prefix people dial abroad.
 */
const normalizeE164: IdentityNormalizer = (value) => {
  const compact = compactPhone(value);
  const international = compact.startsWith('00') ? `+${compact.slice(2)}` : compact;
  return E164.test(international) ? international : null;
};

export type IdentityResolver = (value: unknown) => string | null;

const selectPreset = (preset: IdentityConfig['preset']): IdentityPreset | null => {
  if (preset === null) return null;
  if (preset === undefined) return IDENTITY_PRESETS[DEFAULT_IDENTITY_PRESET];
  if (typeof preset === 'string') {
    const selected = IDENTITY_PRESETS[preset];
    if (!selected) throw new Error(`auth.identity.preset '${preset}' is not a built-in identity preset`);
    return selected;
  }
  if (typeof preset.normalize !== 'function') {
    throw new Error('auth.identity.preset must expose a normalize(value) function');
  }
  return preset;
};

/**
 * Build the identifier pipeline used by login lookup, lockout accounting, and
 * rate-limit bucketing alike. Order is fixed: email, then project extensions,
 * then the selected country preset, then generic E.164.
 */
export function createIdentityResolver(config?: IdentityConfig): IdentityResolver {
  const preset = selectPreset(config?.preset);
  const extend = config?.extend ?? [];
  if (extend.some((normalizer) => typeof normalizer !== 'function')) {
    throw new Error('auth.identity.extend must contain only normalizer functions');
  }

  const pipeline: IdentityNormalizer[] = [
    ...extend,
    ...(preset ? [preset.normalize] : []),
    normalizeE164,
  ];

  return (value: unknown): string | null => {
    if (typeof value !== 'string') return null;

    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_IDENTIFIER_LENGTH) return null;
    if (trimmed.includes('@')) return trimmed.toLowerCase();

    for (const normalize of pipeline) {
      const normalized = normalize(trimmed);
      if (normalized) return normalized;
    }
    return null;
  };
}

const defaultResolver: IdentityResolver = createIdentityResolver();

/**
 * Normalize with Najm's default identity policy. Server-owned login, phone,
 * lockout, and rate-limit paths use their own `AuthConfig.identity.resolve`.
 */
export function normalizeAuthIdentifier(value: unknown): string | null {
  return defaultResolver(value);
}

export function isEmailIdentifier(value: string): boolean {
  return value.includes('@');
}
