import type { NajmAccent, NajmMode, NajmPreset, NajmThemeTokens } from '../types';
import { darkMode, lightMode } from './modes';
import { accents } from './accents';

function lightAccentFromPrimary(primary = ''): Pick<NajmThemeTokens, 'accent' | 'accent-foreground'> {
  const parts = primary.trim().split(/\s+/);
  if (parts.length < 2) return { accent: '0 0% 94%', 'accent-foreground': '0 0% 30%' };
  const [h, s] = parts;
  return { accent: `${h} ${s} 93%`, 'accent-foreground': `${h} ${s} 35%` };
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
