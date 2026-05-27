import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

export default {
  darkMode: 'class',
  important: '.wa-studio',
  corePlugins: { preflight: false },
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--wa-bg)',
        sidebar: 'var(--wa-sidebar)',
        card: 'var(--wa-card)',
        'card-hover': 'var(--wa-card-hover)',
        surface: 'var(--wa-surface)',
        'surface-hover': 'var(--wa-surface-hover)',
        border: 'var(--wa-border)',
        'border-subtle': 'var(--wa-border-subtle)',
        brand: {
          DEFAULT: 'var(--wa-brand)',
          hover: 'var(--wa-brand-hover)',
          muted: 'var(--wa-brand-muted)',
          glow: 'var(--wa-brand-glow)',
        },
        accent: {
          DEFAULT: 'var(--wa-accent)',
          hover: 'var(--wa-accent-hover)',
        },
        txt: {
          primary: 'var(--wa-txt-primary)',
          secondary: 'var(--wa-txt-secondary)',
          muted: 'var(--wa-txt-muted)',
        },
        status: {
          green: 'var(--wa-status-green)',
          yellow: 'var(--wa-status-yellow)',
          red: 'var(--wa-status-red)',
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
        'brand-glow': '0 0 20px var(--wa-brand-glow)',
        'card': '0 1px 3px rgba(0, 0, 0, 0.3)',
      },
    },
  },
  plugins: [animate],
} satisfies Config;
