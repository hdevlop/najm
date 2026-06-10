import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import tailwindcssAnimate from 'tailwindcss-animate';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dirname, '..', 'src', 'styles.css');
const out = resolve(__dirname, '..', 'dist', 'styles.css');
const typesOut = resolve(__dirname, '..', 'dist', 'styles.css.d.ts');

if (!existsSync(src)) {
  console.error('src/styles.css not found');
  process.exit(1);
}

const outDir = dirname(out);
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const css = readFileSync(src, 'utf-8');

const config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  safelist: [
    'border-border',
    'border-border-subtle',
    'border-border-strong',
    'border-input',
    'border-transparent',
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--najm-background))',
        foreground: 'hsl(var(--najm-foreground))',
        card: { DEFAULT: 'hsl(var(--najm-card))', foreground: 'hsl(var(--najm-card-foreground))' },
        popover: { DEFAULT: 'hsl(var(--najm-popover))', foreground: 'hsl(var(--najm-popover-foreground))' },
        primary: { DEFAULT: 'hsl(var(--najm-primary))', foreground: 'hsl(var(--najm-primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--najm-secondary))', foreground: 'hsl(var(--najm-secondary-foreground))' },
        tertiary: { DEFAULT: 'hsl(var(--najm-tertiary))', foreground: 'hsl(var(--najm-tertiary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--najm-muted))', foreground: 'hsl(var(--najm-muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--najm-accent))', foreground: 'hsl(var(--najm-accent-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--najm-destructive))', foreground: 'hsl(var(--najm-destructive-foreground))' },
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

const result = await postcss([tailwindcss(config), autoprefixer]).process(css, { from: src, to: out });

let output = result.css;

// Prepend OverlayScrollbars base styles if available (required by <NajmScroll>)
const require = createRequire(import.meta.url);
try {
  const osCssPath = require.resolve('overlayscrollbars/overlayscrollbars.css');
  const osCss = readFileSync(osCssPath, 'utf-8');
  output = '/* overlayscrollbars */\n' + osCss + '\n' + output;
  console.log('Prepended overlayscrollbars styles');
} catch {
  // Package not available — skip silently
}

// Append react-international-phone styles if available
try {
  const phoneCssPath = require.resolve('react-international-phone/style.css');
  const phoneCss = readFileSync(phoneCssPath, 'utf-8');
  output += '\n/* react-international-phone */\n' + phoneCss;
  console.log('Appended react-international-phone styles');
} catch {
  // Package not available — skip silently
}

writeFileSync(out, output);
writeFileSync(typesOut, 'declare const styles: string;\nexport default styles;\n');
console.log(`Compiled CSS written to dist/styles.css (${(Buffer.byteLength(output) / 1024).toFixed(1)} KB)`);
