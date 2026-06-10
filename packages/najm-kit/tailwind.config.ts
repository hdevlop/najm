import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}', './playground/src/**/*.{ts,tsx}'],
  safelist: [
    'sm:hidden', 'sm:flex', 'hidden sm:flex',
    'md:hidden', 'md:flex', 'hidden md:flex',
    'lg:hidden', 'lg:flex', 'hidden lg:flex',
    // Border contrast degree helpers — class names are built dynamically
    // by src/theme/borders.ts, so they must be safelisted.
    'border-border',
    'border-border-subtle',
    'border-border-strong',
    'border-input',
    'border-transparent',
    ...[
      "black", "white", "gray", "slate", "zinc", "neutral", "stone",
      "red", "orange", "amber", "yellow",
      "green", "teal", "blue", "indigo", "purple",
    ].flatMap((c) => [`border-${c}`, `border-${c}-600`]),
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--najm-background))',
        foreground: 'hsl(var(--najm-foreground))',
        card: {
          DEFAULT: 'hsl(var(--najm-card))',
          foreground: 'hsl(var(--najm-card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--najm-popover))',
          foreground: 'hsl(var(--najm-popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--najm-primary))',
          foreground: 'hsl(var(--najm-primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--najm-secondary))',
          foreground: 'hsl(var(--najm-secondary-foreground))',
        },
        tertiary: {
          DEFAULT: 'hsl(var(--najm-tertiary))',
          foreground: 'hsl(var(--najm-tertiary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--najm-muted))',
          foreground: 'hsl(var(--najm-muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--najm-accent))',
          foreground: 'hsl(var(--najm-accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--najm-destructive))',
          foreground: 'hsl(var(--najm-destructive-foreground))',
        },
        border: 'hsl(var(--najm-border))',
        'border-subtle': 'hsl(var(--najm-border-subtle))',
        'border-strong': 'hsl(var(--najm-border-strong))',
        input: 'hsl(var(--najm-input))',
        ring: 'hsl(var(--najm-ring))',
      },
      borderRadius: {
        lg: 'var(--najm-radius)',
        md: 'calc(var(--najm-radius) - 2px)',
        sm: 'calc(var(--najm-radius) - 4px)',
      },
      keyframes: {
        'indeterminate-progress': {
          '0%': { transform: 'translateX(-100%)', width: '40%' },
          '50%': { transform: 'translateX(100%)', width: '60%' },
          '100%': { transform: 'translateX(200%)', width: '40%' },
        },
      },
      animation: {
        'indeterminate-progress': 'indeterminate-progress 2s ease-in-out infinite',
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
