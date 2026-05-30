import type { Config } from 'tailwindcss';

export default {
  content: ['./src/studio/**/*.{ts,tsx}'],
  darkMode: 'class',
  important: '.ss-studio',
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: 'hsl(var(--background))',
          elev: {
            1: 'hsl(var(--card))',
            2: 'hsl(var(--secondary))',
          },
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          hover: 'hsl(var(--accent))',
        },
        sidebar: 'hsl(var(--secondary))',
        surface: 'hsl(var(--popover))',
        'surface-hover': 'hsl(var(--accent))',
        foreground: 'hsl(var(--foreground))',
        'muted-foreground': 'hsl(var(--muted-foreground))',
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        brand: {
          DEFAULT: 'hsl(var(--primary))',
          dim: 'hsl(var(--primary) / 0.7)',
        },
        txt: {
          DEFAULT: 'hsl(var(--foreground))',
          muted: 'hsl(var(--muted-foreground))',
        },
        border: 'hsl(var(--border))',
        'border-subtle': 'hsl(var(--border) / 0.5)',
      },
      keyframes: {
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'slide-in-right': 'slide-in-right 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in': 'fade-in 0.2s ease-out',
        'scale-in': 'scale-in 0.15s ease-out',
      },
    },
  },
  plugins: [],
} satisfies Config;
