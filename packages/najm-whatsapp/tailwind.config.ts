import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

export default {
  darkMode: 'class',
  important: '.wa-studio',
  corePlugins: { preflight: false },
  content: ['./src/studio/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'hsl(var(--background))',
        sidebar: 'hsl(var(--secondary))',
        card: 'hsl(var(--card))',
        'card-hover': 'hsl(var(--accent))',
        surface: 'hsl(var(--popover))',
        'surface-hover': 'hsl(var(--accent))',
        border: 'hsl(var(--border))',
        'border-subtle': 'hsl(var(--border) / 0.5)',
        brand: {
          DEFAULT: 'hsl(var(--primary))',
          hover: 'hsl(var(--ring))',
          muted: 'hsl(var(--primary) / 0.5)',
          glow: 'hsl(var(--primary) / 0.18)',
        },
        accent: {
          DEFAULT: 'var(--wa-accent)',
          hover: 'var(--wa-accent-hover)',
        },
        txt: {
          primary: 'hsl(var(--foreground))',
          secondary: 'hsl(var(--muted-foreground))',
          muted: 'hsl(var(--muted-foreground) / 0.8)',
        },
        status: {
          green: '#22c55e',
          yellow: '#eab308',
          red: '#ef4444',
        },
      },
      fontFamily: {
        mono: [
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Consolas',
          '"Liberation Mono"',
          'Menlo',
          'monospace',
        ],
      },
      boxShadow: {
        'brand-glow': '0 0 20px hsl(var(--primary) / 0.18)',
        'card': '0 1px 3px rgba(0, 0, 0, 0.3)',
      },
    },
  },
  plugins: [animate],
} satisfies Config;
