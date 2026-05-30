import type { NajmThemeTokens } from '../types';

type AccentOverride = Pick<NajmThemeTokens, 'primary' | 'primary-foreground' | 'ring' | 'accent' | 'accent-foreground'>;

export const accents: Record<string, AccentOverride> = {
  neutral: {
    primary: '240 4% 11%',
    'primary-foreground': '0 0% 98%',
    ring: '240 4% 11%',
    accent: '240 4% 16%',
    'accent-foreground': '0 0% 98%',
  },
  emerald: {
    primary: '160 84% 39%',
    'primary-foreground': '0 0% 100%',
    ring: '160 84% 39%',
    accent: '160 84% 15%',
    'accent-foreground': '160 84% 80%',
  },
  green: {
    primary: '142 71% 45%',
    'primary-foreground': '0 0% 100%',
    ring: '142 71% 45%',
    accent: '142 71% 15%',
    'accent-foreground': '142 71% 80%',
  },
  slate: {
    primary: '215 20% 55%',
    'primary-foreground': '0 0% 100%',
    ring: '215 20% 55%',
    accent: '215 20% 20%',
    'accent-foreground': '215 20% 85%',
  },
  blue: {
    primary: '217 91% 60%',
    'primary-foreground': '0 0% 100%',
    ring: '217 91% 60%',
    accent: '217 91% 20%',
    'accent-foreground': '217 91% 80%',
  },
  violet: {
    primary: '263 70% 50%',
    'primary-foreground': '0 0% 100%',
    ring: '258 90% 66%',
    accent: '263 70% 18%',
    'accent-foreground': '263 70% 80%',
  },
};
