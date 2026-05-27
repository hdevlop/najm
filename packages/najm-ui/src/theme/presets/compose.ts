import type { NajmAccent, NajmMode, NajmPreset, NajmThemeTokens } from '../types';
import { darkMode, lightMode } from './modes';
import { accents } from './accents';

export function composePreset(mode: NajmMode, accent: NajmAccent): NajmThemeTokens {
  const base = mode === 'dark' ? darkMode : lightMode;
  return { ...base, ...accents[accent] };
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
