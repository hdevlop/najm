import type { NajmThemeTokens } from '../types';

type AccentOverride = Pick<NajmThemeTokens, 'primary' | 'primary-foreground' | 'ring'>;

export const accents: Record<string, AccentOverride> = {
  neutral: {
    primary: '#18181b',
    'primary-foreground': '#fafafa',
    ring: '#18181b',
  },
  emerald: {
    primary: '#10b981',
    'primary-foreground': '#ffffff',
    ring: '#10b981',
  },
  green: {
    primary: '#22c55e',
    'primary-foreground': '#ffffff',
    ring: '#22c55e',
  },
  slate: {
    primary: '#64748b',
    'primary-foreground': '#ffffff',
    ring: '#64748b',
  },
  blue: {
    primary: '#3b82f6',
    'primary-foreground': '#ffffff',
    ring: '#3b82f6',
  },
  violet: {
    primary: '#7c3aed',
    'primary-foreground': '#ffffff',
    ring: '#8b5cf6',
  },
};
