import type { IdentityNormalizer, IdentityPreset, IdentityPresetName } from './types';

/** Strips the separators people type into phone fields, keeping a leading `+`. */
export const compactPhone = (value: string): string =>
  value.trim().replace(/[\s().-]+/g, '');

const MOROCCO_LOCAL = /^0\d{9}$/;
const MOROCCO_NATIONAL = /^212\d{9}$/;
const MOROCCO_E164 = /^\+212\d{9}$/;

/** `06…` / `212…` / `+212…` → `+212…`. */
export const normalizeMoroccanPhone: IdentityNormalizer = (value) => {
  const compact = compactPhone(value);
  if (MOROCCO_LOCAL.test(compact)) return `+212${compact.slice(1)}`;
  if (MOROCCO_NATIONAL.test(compact)) return `+${compact}`;
  if (MOROCCO_E164.test(compact)) return compact;
  return null;
};

export const moroccoIdentityPreset: IdentityPreset = {
  name: 'ma',
  normalize: normalizeMoroccanPhone,
};

const TUNISIA_LOCAL = /^\d{8}$/;
const TUNISIA_NATIONAL = /^216\d{8}$/;
const TUNISIA_E164 = /^\+216\d{8}$/;

/** `71234567` / `216…` / `+216…` → `+216…`. */
export const normalizeTunisianPhone: IdentityNormalizer = (value) => {
  const compact = compactPhone(value);
  if (TUNISIA_LOCAL.test(compact)) return `+216${compact}`;
  if (TUNISIA_NATIONAL.test(compact)) return `+${compact}`;
  if (TUNISIA_E164.test(compact)) return compact;
  return null;
};

export const tunisiaIdentityPreset: IdentityPreset = {
  name: 'tn',
  normalize: normalizeTunisianPhone,
};

export const IDENTITY_PRESETS: Record<IdentityPresetName, IdentityPreset> = {
  ma: moroccoIdentityPreset,
  tn: tunisiaIdentityPreset,
};

export const DEFAULT_IDENTITY_PRESET: IdentityPresetName = 'ma';
