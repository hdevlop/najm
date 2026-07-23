import fs from 'fs';
import path from 'path';
import postcss from 'postcss';
import tailwindPostcss from '@tailwindcss/postcss';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const prefixPlugin = () => ({
  postcssPlugin: 'prefix-selector',
  Rule(rule) {
    if (rule.parent?.type === 'atrule' && /keyframes|font-face/i.test(rule.parent.name)) {
      return;
    }
    const mapped = rule.selectors.map((selector) => {
      if (selector === ':root' || selector === ':host') return '.wa-studio';
      if (selector === '.dark') return ['.wa-studio.dark', '.wa-studio .dark'];
      if (selector.startsWith('html') || selector.startsWith('body')) return selector;
      if (selector.includes('.wa-studio')) return selector;
      if (selector.startsWith('.') || selector.startsWith('#') || selector.startsWith('[')) {
        return `.wa-studio ${selector}`;
      }
      return selector;
    });
    rule.selectors = Array.from(new Set(mapped.flat()));
  },
});

prefixPlugin.postcss = true;

// Ship precompiled Tailwind v4 output in a form that Tailwind v3 consumers
// will not try to interpret as source-layer directives.
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
