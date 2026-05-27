import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  important: '.ss-studio',
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#06060a',
          elev: {
            1: '#0e0e14',
            2: '#14141c',
          },
        },
        brand: {
          DEFAULT: '#10b981',
          dim: '#059669',
        },
        txt: {
          DEFAULT: '#e2e2e8',
          muted: '#6b7280',
        },
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
