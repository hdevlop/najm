import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

// Domain-only tokens — used exclusively by domain components:
// AppShell, Sidebar, ChatArea, EmbeddingHealthBanner, badges
// These tokens express the dark-violet preset vocabulary.
// Do not use in new components — use shadcn standard tokens instead.
// Prune if a token's usage count drops to 0.
export default {
  darkMode: 'class',
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
          muted: 'hsl(var(--primary) / 0.6)',
          glow: 'hsl(var(--primary) / 0.15)',
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
      boxShadow: {
        'brand-glow': '0 0 20px hsl(var(--primary) / 0.15)',
        'card': '0 1px 3px rgba(0, 0, 0, 0.3)',
      },
    },
  },
  plugins: [animate],
} satisfies Config;
