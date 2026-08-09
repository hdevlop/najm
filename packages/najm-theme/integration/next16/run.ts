// ============================================================================
// Next.js 16 production build fixture for najm-theme
// ============================================================================
//
// Two builds, and each proves something the unit tests cannot.
//
// 1. `fixture/` must build. A root layout, a nested layout, and a page all
//    import the RSC adapter; a sibling page is a Client Component importing
//    `najm-theme/react`. One production build compiles both graphs, which is
//    where an export map that resolves in TypeScript but not in Next.js —
//    a missing `react-server` condition, a `server-only` import reached from
//    the client graph, a `"use client"` on the wrong entry — actually fails.
//
// 2. `client-guard/` must NOT build. Its page is a Client Component importing
//    `najm-theme/server/react`, which the `browser` condition maps to a module
//    that throws. A build that succeeds there means the application's internal
//    fetcher and its factory values were about to ship to a browser, and a
//    negative test is the only thing that catches it — every positive test in
//    the suite passes just as happily with the guard removed.
//
// What this does *not* prove is the request-cache behaviour: that lives in
// `najm-kit/server/react`, which has its own Next 16 fixture with a running
// server and a hit counter. This package configures that loader rather than
// reimplementing it, and `test/rsc` covers the configuration.
//
// Run with `bun run --cwd packages/najm-theme test:next16`.
// ============================================================================

import { rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const nextBin = join(
  dirname(fileURLToPath(import.meta.resolve('next/package.json'))),
  'dist',
  'bin',
  'next',
);

const distDir = '.next-integration';

async function build(name: string): Promise<{ code: number; output: string }> {
  const cwd = join(import.meta.dir, name);
  rmSync(join(cwd, distDir), { recursive: true, force: true });

  const proc = Bun.spawn({
    cmd: [process.execPath, nextBin, 'build'],
    cwd,
    env: { ...process.env, NODE_ENV: 'production', NAJM_NEXT_DIST_DIR: distDir },
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return { code, output: `${stdout}\n${stderr}` };
}

let failures = 0;

console.log('▶ building the RSC + client fixture (must succeed)');
const fixture = await build('fixture');
if (fixture.code !== 0) {
  failures += 1;
  console.error(fixture.output);
  console.error('✗ the Next.js 16 production build failed');
} else {
  console.log('✓ server and client entries compiled in one production build');
}

console.log('▶ building the client-import guard fixture (must fail)');
const guard = await build('client-guard');
if (guard.code === 0) {
  failures += 1;
  console.error(
    '✗ a Client Component imported najm-theme/server/react and the build succeeded.\n'
    + '  The `browser` export condition is not reaching dist/server/reactClientGuard.js,\n'
    + '  which means server-only code can reach a browser bundle.',
  );
} else if (!/reactClientGuard/.test(guard.output)) {
  // Failing is not enough — it has to fail *because of the guard*. Anything
  // else (a syntax error, a missing dependency) would make this test pass
  // while the leak it exists to catch went unnoticed.
  failures += 1;
  console.error(guard.output);
  console.error(
    "✗ the guard build failed, but the error never mentions reactClientGuard — something else broke first.",
  );
} else {
  // The failure arrives at resolution rather than at the guard's `throw`:
  // the bundler follows the `browser` condition to a module with no exports
  // and stops there. Better than the runtime message, and the same outcome —
  // the build does not produce a bundle.
  console.log('✓ importing the RSC adapter from a Client Component fails the build, by design');
}

if (failures > 0) {
  process.exit(1);
}

console.log('\nNext.js 16 integration passed.');
