import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// najm-kit ships its theme as a Tailwind v4 *source* file. We don't compile
// Tailwind here — the consuming app's v4 build does that (it scans
// najm-kit/dist via the `@source` directive inside theme.css). This script
// just assembles dist/theme.css: the authored theme plus the third-party
// (overlayscrollbars, phone) CSS inlined so the import stays self-contained.

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dirname, '..', 'src', 'theme.css');
const out = resolve(__dirname, '..', 'dist', 'theme.css');
const typesOut = resolve(__dirname, '..', 'dist', 'theme.css.d.ts');

if (!existsSync(src)) {
  console.error('src/theme.css not found');
  process.exit(1);
}

const outDir = dirname(out);
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

// Authored theme first — its `@import "tw-animate-css"` must remain the first
// statement, so all inlined third-party CSS is appended after it.
let output = readFileSync(src, 'utf-8');

const require = createRequire(import.meta.url);

try {
  const osCssPath = require.resolve('overlayscrollbars/overlayscrollbars.css');
  output += '\n\n/* overlayscrollbars */\n' + readFileSync(osCssPath, 'utf-8');
  console.log('Appended overlayscrollbars styles');
} catch {
  // Package not available — skip silently
}

try {
  const phoneCssPath = require.resolve('react-international-phone/style.css');
  output += '\n\n/* react-international-phone */\n' + readFileSync(phoneCssPath, 'utf-8');
  console.log('Appended react-international-phone styles');
} catch {
  // Package not available — skip silently
}

writeFileSync(out, output);
writeFileSync(typesOut, 'declare const styles: string;\nexport default styles;\n');
console.log(`Assembled theme written to dist/theme.css (${(Buffer.byteLength(output) / 1024).toFixed(1)} KB)`);
