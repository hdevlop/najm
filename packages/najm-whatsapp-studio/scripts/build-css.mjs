import fs from 'fs';
import path from 'path';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const prefixPlugin = () => ({
  postcssPlugin: 'prefix-selector',
  Rule(rule) {
    if (rule.parent?.type === 'atrule' && /keyframes|font-face/i.test(rule.parent.name)) {
      return;
    }
    rule.selectors = rule.selectors.map((selector) => {
      if (selector.startsWith('html') || selector.startsWith('body')) {
        return selector;
      }
      if (selector.includes('.wa-studio')) {
        return selector;
      }
      if (selector.startsWith('.') || selector.startsWith('#') || selector.startsWith('[')) {
        return `.wa-studio ${selector}`;
      }
      return selector;
    });
  },
});

prefixPlugin.postcss = true;

async function build() {
  const input = path.join(rootDir, 'src', 'styles', 'index.css');
  const output = path.join(rootDir, 'dist', 'styles.css');

  const css = fs.readFileSync(input, 'utf8');

  const result = await postcss([
    tailwindcss(path.join(rootDir, 'tailwind.config.ts')),
    autoprefixer,
    prefixPlugin(),
  ]).process(css, { from: input, to: output });

  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, result.css);
  console.log('Built', output);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
