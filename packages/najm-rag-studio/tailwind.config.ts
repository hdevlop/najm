import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

// Domain-only tokens — used exclusively by domain components:
// AppShell, Sidebar, ChatArea, EmbeddingHealthBanner, badges
// These tokens express the dark-violet preset vocabulary.
// Do not use in new components — use shadcn standard tokens instead.
// Prune if a token's usage count drops to 0.
export default {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#06060a',
        sidebar: '#0c0c12',
        card: '#111118',
        'card-hover': '#181822',
        surface: '#1a1a24',
        'surface-hover': '#222230',
        border: '#23232e',
        'border-subtle': '#1a1a24',
        brand: {
          DEFAULT: '#7c3aed',
          hover: '#8b5cf6',
          muted: '#5b21b6',
          glow: 'rgba(124, 58, 237, 0.15)',
        },
        txt: {
          primary: '#f1f1f4',
          secondary: '#a1a1b3',
          muted: '#6e6e82',
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
        'brand-glow': '0 0 20px rgba(124, 58, 237, 0.15)',
        'card': '0 1px 3px rgba(0, 0, 0, 0.3)',
      },
    },
  },
  plugins: [animate],
} satisfies Config;
