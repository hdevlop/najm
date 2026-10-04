import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

// GHSA-vfj7-8cjw-p6xm has no upstream fixed release. The audit exception is
// valid only while the installed package rejects excessive recursion safely.
const require = createRequire(import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
assert.equal(manifest.patchedDependencies?.['braces@3.0.3'], 'patches/braces@3.0.3.patch');
const braces = require('braces');
const failure = { name: 'RangeError', message: 'Brace nesting exceeds maximum depth of 128' };
assert(Date.now() < Date.parse('2026-11-05T00:00:00Z'), 'The braces audit exception expired; review the upstream advisory and patch.');

assert.deepEqual(braces.expand('src/{app,lib}/*.{ts,tsx}'), [
  'src/app/*.ts', 'src/app/*.tsx', 'src/lib/*.ts', 'src/lib/*.tsx',
]);
for (const pattern of ['{'.repeat(256) + 'a,b' + '}'.repeat(256), '('.repeat(256) + 'a' + ')'.repeat(256)]) {
  for (const method of ['parse', 'compile', 'expand', 'stringify']) {
    assert.throws(() => braces[method](pattern), failure, `${method} must bound parsed nesting`);
  }
}

// Callers may pass an AST directly and bypass parse(). Walkers must also guard
// nesting themselves rather than relying only on the string parser.
let ast: any = { type: 'text', value: 'a' };
for (let index = 0; index < 256; index++) ast = { type: 'paren', nodes: [ast] };
ast = { type: 'root', nodes: [ast] };
for (const method of ['compile', 'expand', 'stringify']) {
  assert.throws(() => braces[method](structuredClone(ast)), failure, `${method} must bound AST nesting`);
}
console.log('braces patch verified: normal patterns work; deeply nested patterns and ASTs are bounded.');
