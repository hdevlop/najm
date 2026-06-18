import type { NajmAccent, NajmMode, NajmPreset, NajmThemeTokens } from '../types';
import { darkMode, lightMode } from './modes';
import { accents } from './accents';

// Derive a light-mode accent pair from the primary's hue/chroma: a pale tint
// for the surface and a darker, more saturated tone for its foreground.
function lightAccentFromPrimary(primary = ''): Pick<NajmThemeTokens, 'accent' | 'accent-foreground'> {
  const m = primary.trim().match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/i);
  if (!m) return { accent: 'oklch(0.95 0 0)', 'accent-foreground': 'oklch(0.42 0 0)' };
  const c = Number(m[2]);
  const h = Number(m[3]);
  const tint = Math.min(c, 0.05);
  const fg = Math.min(c, 0.12);
  return {
    accent: `oklch(0.95 ${tint} ${h})`,
    'accent-foreground': `oklch(0.42 ${fg} ${h})`,
  };
}

export function composePreset(mode: NajmMode, accent: NajmAccent): NajmThemeTokens {
  const base = mode === 'dark' ? darkMode : lightMode;
  const accentTokens = accents[accent];
  if (mode === 'light') {
    const { accent: _a, 'accent-foreground': _af, ...brandTokens } = accentTokens;
    return { ...base, ...brandTokens, ...lightAccentFromPrimary(brandTokens.primary) };
  }
  return { ...base, ...accentTokens };
}

const PRESET_MAP: Record<NajmPreset, { mode: NajmMode; accent: NajmAccent }> = {
  light: { mode: 'light', accent: 'neutral' },
  dark: { mode: 'dark', accent: 'neutral' },
  'dark-emerald': { mode: 'dark', accent: 'emerald' },
  'dark-green': { mode: 'dark', accent: 'green' },
  'dark-slate': { mode: 'dark', accent: 'slate' },
  'dark-blue': { mode: 'dark', accent: 'blue' },
  'dark-violet': { mode: 'dark', accent: 'violet' },
};

export function resolvePreset(preset: NajmPreset): NajmThemeTokens {
  const { mode, accent } = PRESET_MAP[preset];
  return composePreset(mode, accent);
}
