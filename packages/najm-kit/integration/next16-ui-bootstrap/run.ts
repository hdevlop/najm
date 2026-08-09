// ============================================================================
// Next.js 16 production fixture for najm-kit/server/react
// ============================================================================
//
// The unit tests drive React's request cache directly, which proves the
// adapter's logic but not that Next.js gives one navigation one cache. This
// does: a real production build, a real server, three server boundaries per
// navigation, and a hit counter behind the endpoints.
//
// Run with `bun run --cwd packages/najm-kit test:next16`.
// ============================================================================

import { rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const fixture = join(import.meta.dir, 'fixture');
const nextBin = join(
  dirname(fileURLToPath(import.meta.resolve('next/package.json'))),
  'dist',
  'bin',
  'next',
);
const port = 32_000 + Math.floor(Math.random() * 500);
const origin = `http://127.0.0.1:${port}`;
const distDir = '.next-integration';

rmSync(join(fixture, distDir), { recursive: true, force: true });

const build = Bun.spawn({
  cmd: [process.execPath, nextBin, 'build'],
  cwd: fixture,
  env: { ...process.env, NODE_ENV: 'production', NAJM_NEXT_DIST_DIR: distDir },
  stdout: 'inherit',
  stderr: 'inherit',
});
if (await build.exited !== 0) {
  throw new Error('Next.js 16 production fixture build failed');
}

const server = Bun.spawn({
  cmd: [process.execPath, nextBin, 'start', '--hostname', '127.0.0.1', '--port', String(port)],
  cwd: fixture,
  env: {
    ...process.env,
    HOSTNAME: '127.0.0.1',
    NODE_ENV: 'production',
    PORT: String(port),
    NAJM_NEXT_DIST_DIR: distDir,
  },
  stdout: 'pipe',
  stderr: 'pipe',
});

const output: string[] = [];
let lastHtml = '';
void collect(server.stdout, output);
void collect(server.stderr, output);

try {
  await waitForReady();
  await oneResolutionPerNavigation();
  await failureIsIsolatedAndStable();
  await theNextRequestRetries();
  await imageDeliveryIsExplicit();
  console.log('Next.js 16 najm-kit UI bootstrap suite: PASS');
} finally {
  server.kill();
  await server.exited;
  rmSync(join(fixture, distDir), { recursive: true, force: true });
}

/**
 * Three server boundaries — root layout, nested layout, page — read the
 * bootstrap during one navigation. Each endpoint must be hit exactly once, and
 * all three must render the same values.
 */
async function oneResolutionPerNavigation() {
  await reset();
  const html = await navigate('/shared');

  assert(html.includes('root:7:/uploaded-logo.png'), 'root layout did not render the saved values');
  assert(html.includes('layout:/uploaded-logo.png'), 'nested layout did not render the saved logo');
  assert(html.includes('page:7:/uploaded-logo.png:15px'), 'page did not render the saved values');

  const state = await readState();
  assert(
    state.hits.appearance === 1 && state.hits.branding === 1,
    `expected one hit per endpoint, got ${JSON.stringify(state.hits)}`,
  );
  assert(state.diagnostics.length === 0, `unexpected diagnostics ${JSON.stringify(state.diagnostics)}`);
}

/**
 * Branding is down, appearance is fine. The render must keep the real theme,
 * show the factory logo at all three boundaries, and report it once — not
 * three times, and not once per boundary that happened to ask.
 */
async function failureIsIsolatedAndStable() {
  await reset({ brandingStatus: 503 });
  const html = await navigate('/shared');

  assert(html.includes('root:7:/factory-logo.svg'), 'root layout did not fall back to the factory logo');
  assert(html.includes('layout:/factory-logo.svg'), 'nested layout disagreed with the root layout');
  assert(html.includes('page:7:/factory-logo.svg:15px'), 'page lost the valid appearance');

  const state = await readState();
  assert(state.hits.branding === 1, `branding retried inside one render: ${state.hits.branding}`);
  assert(
    state.diagnostics.length === 1 && state.diagnostics[0] === 'branding:response-not-ok:503',
    `expected one sanitized diagnostic, got ${JSON.stringify(state.diagnostics)}`,
  );
}

/** A recovered endpoint is picked up by the next request, not pinned by a process cache. */
async function theNextRequestRetries() {
  await reset({ brandingStatus: 503 });
  await navigate('/shared');
  await reset({ brandingStatus: 200 });
  const html = await navigate('/shared');

  assert(html.includes('root:7:/uploaded-logo.png'), 'a later request reused the process-wide fallback');
  const state = await readState();
  assert(state.hits.branding === 1, `expected one branding hit, got ${state.hits.branding}`);
}

/**
 * `NNextImage` renders through the real optimizer for a public asset and
 * straight to the route for one the application marked `unoptimized`.
 *
 * Only a production build can show this: the decision is made by Next's image
 * loader at render time, and a unit test sees the props rather than the emitted
 * markup. It is also the assertion that keeps route classification where it
 * belongs — the package cannot pass this by guessing from the URL, because both
 * sources here are same-origin paths.
 */
async function imageDeliveryIsExplicit() {
  const html = await navigate('/media');

  assert(
    html.includes('/_next/image?url=%2Fpublic-cover.png'),
    'the public image did not go through the Next optimizer',
  );
  assert(
    html.includes('src="/api/managed/files/serve/fixture-asset"'),
    'the unoptimized image was not delivered straight from its route',
  );
  assert(
    !html.includes('url=%2Fapi%2Fmanaged'),
    'the unoptimized image was rewritten through the optimizer',
  );
  assert(html.includes('loading="lazy"'), 'the lazy default did not reach the markup');
  assert(html.includes('loading="eager"'), 'an explicit eager loading value was overridden');
  // `fill` still reserves the box for the direct image. `sizes` does not appear
  // beside it: Next emits `sizes` only alongside a `srcSet`, and an unoptimized
  // source has none to describe. That is Next's contract, not a loss here — the
  // optimized path keeps both, which the unit suite covers.
  assert(
    html.includes('data-nimg="fill"'),
    'the unoptimized image lost its fill layout',
  );
}

async function navigate(path: string): Promise<string> {
  const response = await fetch(`${origin}${path}`, { headers: { accept: 'text/html' } });
  assert(response.status === 200, `${path} responded ${response.status}`);
  lastHtml = await response.text();
  return lastHtml;
}

async function reset(patch: { brandingStatus?: number } = {}) {
  const response = await fetch(`${origin}/api/fixture/state`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });
  assert(response.status === 200, `reset responded ${response.status}`);
}

async function readState(): Promise<{
  hits: { appearance: number; branding: number };
  diagnostics: string[];
}> {
  const response = await fetch(`${origin}/api/fixture/state`);
  assert(response.status === 200, `state responded ${response.status}`);
  return response.json() as Promise<{
    hits: { appearance: number; branding: number };
    diagnostics: string[];
  }>;
}

async function waitForReady() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${origin}/api/fixture/state`);
      if (response.ok) {
        await response.arrayBuffer();
        return;
      }
    } catch {
      // Not listening yet.
    }
    await Bun.sleep(200);
  }
  throw new Error(`fixture server never became ready\n${output.join('')}`);
}

async function collect(stream: ReadableStream<Uint8Array> | null, sink: string[]) {
  if (!stream) return;
  const decoder = new TextDecoder();
  for await (const chunk of stream) sink.push(decoder.decode(chunk));
}

function assert(condition: boolean, message: string): asserts condition {
  if (condition) return;
  throw new Error(
    `${message}\n--- last html ---\n${lastHtml}\n--- server output ---\n${output.join('')}`,
  );
}
