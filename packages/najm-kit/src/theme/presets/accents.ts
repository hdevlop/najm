import type { NajmThemeTokens } from '../types';

type AccentOverride = Pick<
  NajmThemeTokens,
  | 'primary'
  | 'primary-foreground'
  | 'ring'
  | 'accent'
  | 'accent-foreground'
  | 'sidebar-primary'
  | 'sidebar-ring'
>;

export const accents: Record<string, AccentOverride> = {
  neutral: {
    primary: 'oklch(0.2228 0.0043 286.044)',
    'primary-foreground': 'oklch(0.9848 0 0)',
    ring: 'oklch(0.2228 0.0043 286.044)',
    accent: 'oklch(0.2747 0.006 286.001)',
    'accent-foreground': 'oklch(0.9848 0 0)',
    'sidebar-primary': 'oklch(0.2228 0.0043 286.044)',
    'sidebar-ring': 'oklch(0.2228 0.0043 286.044)',
  },
  emerald: {
    primary: 'oklch(0.6902 0.1481 162.368)',
    'primary-foreground': 'oklch(1 0 0)',
    ring: 'oklch(0.6902 0.1481 162.368)',
    accent: 'oklch(0.3519 0.0714 164.26)',
    'accent-foreground': 'oklch(0.9131 0.0924 171.145)',
    'sidebar-primary': 'oklch(0.6902 0.1481 162.368)',
    'sidebar-ring': 'oklch(0.6902 0.1481 162.368)',
  },
  green: {
    primary: 'oklch(0.7205 0.192 149.493)',
    'primary-foreground': 'oklch(1 0 0)',
    ring: 'oklch(0.7205 0.192 149.493)',
    accent: 'oklch(0.333 0.0811 150.922)',
    'accent-foreground': 'oklch(0.8958 0.096 156.121)',
    'sidebar-primary': 'oklch(0.7205 0.192 149.493)',
    'sidebar-ring': 'oklch(0.7205 0.192 149.493)',
  },
  slate: {
    primary: 'oklch(0.6227 0.0463 256.82)',
    'primary-foreground': 'oklch(1 0 0)',
    ring: 'oklch(0.6227 0.0463 256.82)',
    accent: 'oklch(0.3115 0.0245 256.824)',
    'accent-foreground': 'oklch(0.8784 0.0141 256.711)',
    'sidebar-primary': 'oklch(0.6227 0.0463 256.82)',
    'sidebar-ring': 'oklch(0.6227 0.0463 256.82)',
  },
  blue: {
    primary: 'oklch(0.6261 0.1859 259.596)',
    'primary-foreground': 'oklch(1 0 0)',
    ring: 'oklch(0.6261 0.1859 259.596)',
    accent: 'oklch(0.2941 0.1092 259.917)',
    'accent-foreground': 'oklch(0.8064 0.0902 259.76)',
    'sidebar-primary': 'oklch(0.6261 0.1859 259.596)',
    'sidebar-ring': 'oklch(0.6261 0.1859 259.596)',
  },
  violet: {
    primary: 'oklch(0.4865 0.2423 291.866)',
    'primary-foreground': 'oklch(1 0 0)',
    ring: 'oklch(0.6016 0.2214 292.234)',
    accent: 'oklch(0.2467 0.109 294.41)',
    'accent-foreground': 'oklch(0.7817 0.1036 301.636)',
    'sidebar-primary': 'oklch(0.4865 0.2423 291.866)',
    'sidebar-ring': 'oklch(0.6016 0.2214 292.234)',
  },
};
