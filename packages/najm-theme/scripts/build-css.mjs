import { copyFileSync, existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// `najm-theme/styles.css` carries only what this package's settings UI needs on
// top of `najm-kit/theme.css`. It is a Tailwind v4 *source* file: the consuming
// application's build compiles it, the same way it already compiles the kit's
// theme. Nothing is compiled here, so a class that only exists in a runtime
// string still would not survive — every utility used by this package is
// written literally in a `.tsx` file that the `@source` directive below scans.

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dirname, '..', 'src', 'styles', 'theme.css');
const out = resolve(__dirname, '..', 'dist', 'styles.css');
const typesOut = resolve(__dirname, '..', 'dist', 'styles.css.d.ts');

if (!existsSync(src)) {
  console.error('src/styles/theme.css not found');
  process.exit(1);
}

const outDir = dirname(out);
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

copyFileSync(src, out);
writeFileSync(typesOut, 'declare const styles: string;\nexport default styles;\n');

console.log(
  `Assembled styles written to dist/styles.css (${(statSync(out).size / 1024).toFixed(1)} KB)`,
);
