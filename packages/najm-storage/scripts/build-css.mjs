import fs from 'fs';
import path from 'path';
import postcss from 'postcss';
import tailwindPostcss from '@tailwindcss/postcss';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// The studio is an embedded surface; its CSS is precompiled and shipped as a
// single, self-contained stylesheet to the consuming app. v4 import order:
//   1. tailwindcss (engine + safelist for najm-kit components via theme.css)
//   2. najm-kit/theme.css (token contract, --color-* mappings, overlayscrollbars
//      and react-international-phone CSS, inlined by the kit build)
// Studio additions (custom colors, keyframes, fonts, shadows) live in
// @theme blocks below.
const prefixPlugin = () => ({
  postcssPlugin: 'prefix-selector',
  Rule(rule) {
    if (rule.parent?.type === 'atrule' && /keyframes|font-face/i.test(rule.parent.name)) {
      return;
    }
    const mapped = rule.selectors.map((selector) => {
      if (selector === ':root' || selector === ':host') return '.ss-studio';
      if (selector === '.dark') return ['.ss-studio.dark', '.ss-studio .dark'];
      if (selector.startsWith('html') || selector.startsWith('body')) return selector;
      if (selector.includes('.ss-studio')) return selector;
      if (selector.startsWith('.') || selector.startsWith('#') || selector.startsWith('[')) {
        return `.ss-studio ${selector}`;
      }
      return selector;
    });
    rule.selectors = Array.from(new Set(mapped.flat()));
  },
});

prefixPlugin.postcss = true;

// The Studio is compiled with Tailwind v4 but can be consumed by Tailwind v3
// applications. Tailwind v3 rejects precompiled `@layer` blocks unless the
// same file also contains its source `@tailwind` directives, so ship the
// already-generated rules without build-time layer wrappers.
const flattenLayersPlugin = () => ({
  postcssPlugin: 'flatten-precompiled-layers',
  AtRule(rule) {
    if (rule.name !== 'layer') return;
    if (rule.nodes) rule.replaceWith(...rule.nodes);
    else rule.remove();
  },
});

flattenLayersPlugin.postcss = true;

async function build() {
  const input = path.join(rootDir, 'src', 'studio', 'styles', 'index.css');
  const output = path.join(rootDir, 'dist', 'studio', 'styles.css');
  const css = fs.readFileSync(input, 'utf8');

  const result = await postcss([
    tailwindPostcss(),
    prefixPlugin(),
    flattenLayersPlugin(),
  ]).process(css, { from: input, to: output });

  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, result.css);
  console.log('Built', output);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
