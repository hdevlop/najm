import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = join(import.meta.dir, '..', '..');
const fixture = join(import.meta.dir, 'fixture');
const nextBin = join(
  dirname(fileURLToPath(import.meta.resolve('next/package.json'))),
  'dist',
  'bin',
  'next',
);
const port = 34_000 + Math.floor(Math.random() * 500);
const origin = `http://127.0.0.1:${port}`;
const distDir = '.next-integration';

for (const entry of ['dist/app.js', 'dist/app/server.js']) {
  if (!existsSync(join(packageRoot, entry))) {
    throw new Error(`najm-next dist is missing (${entry}). Run "bun run build" in packages/najm-next first.`);
  }
}

const builtReactEntry = readFileSync(join(packageRoot, 'dist/app/react.js'), 'utf8');
assert(
  builtReactEntry.startsWith("'use client';"),
  'najm-next/app/react lost its use-client package boundary',
);

rmSync(join(fixture, distDir), { recursive: true, force: true });

const buildEnv = cleanFixtureEnv({
  ...process.env,
  HOSTNAME: '127.0.0.1',
  NODE_ENV: 'production',
  NAJM_NEXT_DIST_DIR: distDir,
});

const WORKSPACE_ROOT_WARNING_MARKERS = [
  'inferred your workspace root',
  'We detected multiple lockfiles',
];

function assertNoWorkspaceRootWarning(output: string, phase: string) {
  for (const marker of WORKSPACE_ROOT_WARNING_MARKERS) {
    assert(
      !output.includes(marker),
      `fixture ${phase} emitted a workspace-root warning (${marker}); the Najm config contract should pin the root`,
    );
  }
}

const buildOutput = await runBuild();
assertNoWorkspaceRootWarning(buildOutput, 'build');

try {
  await withProductionServer(async ({ output }) => {
    const adapter = await fetch(`${origin}/adapter`, { headers: { 'accept-language': 'fr-FR' } });
    assert(adapter.status === 200, 'Next adapter failed to render');
    assert((await adapter.text()).includes('adapter:true:fr:es:true'), 'Next adapter lost header/institution precedence or request memoization');
    const cookieAdapter = await fetch(`${origin}/adapter`, {
      headers: { 'accept-language': 'fr-FR', cookie: 'kafil-ui-language=en' },
    });
    assert((await cookieAdapter.text()).includes('adapter:true:en:en:true'), 'Next adapter did not prefer valid cookies');
    await oneResolutionPerNavigation();
    await failureIsIsolatedAndStable();
    await theNextRequestRetries();
    await lightweightSessionReadsTriggerNothingElse();
    await multiUserIsolation();
    await snapshotsStayPublicAndSerializable(output);
  });
  console.log('Next.js 16 najm-next app/server suite: PASS');
} finally {
  rmSync(join(fixture, distDir), { recursive: true, force: true });
}

async function oneResolutionPerNavigation() {
  await reset();
  const html = await navigate('/kafil');

  // Layout (settings) and page (snapshot) agree on one resolution.
  assert(html.includes('kafil-layout:true'), 'nested layout did not render the saved setting');
  for (const provider of ['auth', 'query', 'ui', 'branding', 'leaflet']) {
    assert(html.includes(`data-fixture-provider=\"${provider}\"`), `Kafil client composition omitted ${provider}`);
  }
  assert(
    html.includes('kafil:anonymous:en:light:Africa/Casablanca:MAD:7:/uploaded-logo.png:true'),
    `kafil page did not render the composed snapshot: ${html.slice(0, 400)}`,
  );

  const state = await readState();
  assert(
    state.hits.appearance === 1 && state.hits.branding === 1 && state.hits.settings === 1,
    `expected one hit per resource, got ${JSON.stringify(state.hits)}`,
  );
  assert(state.diagnostics.length === 0, `unexpected diagnostics ${JSON.stringify(state.diagnostics)}`);

  await reset();
  const school = await navigate('/school');
  assert(
    school.includes('school:anonymous:es:light:UTC:EUR:7:/uploaded-logo.png'),
    `school page did not render its institution-first snapshot: ${school.slice(0, 400)}`,
  );
  assert(school.includes('school-layout:EUR'), 'school layout disagreed on the currency');
  for (const provider of ['auth', 'query', 'keyboard', 'ui', 'branding', 'google']) {
    assert(school.includes(`data-fixture-provider=\"${provider}\"`), `School client composition omitted ${provider}`);
  }
  const schoolState = await readState();
  assert(
    schoolState.hits.appearance === 1 && schoolState.hits.branding === 1 && schoolState.hits.settings === 1,
    `expected one hit per resource for school, got ${JSON.stringify(schoolState.hits)}`,
  );
}

async function failureIsIsolatedAndStable() {
  await reset({ brandingStatus: 503, settingsError: true });
  const html = await navigate('/kafil');

  // Branding falls back, appearance and the (fallback) setting survive, and
  // each failure is reported once with a stable code — never a raw value.
  assert(html.includes(':/factory-logo.svg:false'), 'branding failure did not fall back independently');
  assert(html.includes(':7:'), 'a branding failure discarded the valid appearance');

  const state = await readState();
  assert(state.hits.branding === 1, `branding retried inside one render: ${state.hits.branding}`);
  assert(
    state.diagnostics.some((line) => line.startsWith('branding:response-not-ok:503')),
    `expected one branding diagnostic, got ${JSON.stringify(state.diagnostics)}`,
  );
  assert(
    state.diagnostics.some((line) => line.startsWith('settings:settings-unavailable:')),
    `expected one settings diagnostic, got ${JSON.stringify(state.diagnostics)}`,
  );
  for (const line of state.diagnostics) {
    assert(!line.includes('unavailable;'), 'diagnostic leaked a raw value');
  }
}

async function theNextRequestRetries() {
  await reset({ brandingStatus: 503, settingsError: true });
  await navigate('/kafil');
  await reset({ brandingStatus: 200, settingsError: false });
  const html = await navigate('/kafil');

  assert(html.includes(':/uploaded-logo.png:true'), 'a later request reused the process-wide fallback');
  const state = await readState();
  assert(state.hits.branding === 1, `expected one branding hit, got ${state.hits.branding}`);
  assert(state.hits.settings === 1, `expected one settings hit, got ${state.hits.settings}`);
}

async function lightweightSessionReadsTriggerNothingElse() {
  await reset();
  const html = await navigate('/session-only');
  assert(html.includes('session-only:anonymous'), 'session-only page did not render');

  const state = await readState();
  assert(state.hits.session === 1, `expected one session read, got ${JSON.stringify(state.hits)}`);
  assert(
    state.hits.appearance === 0 && state.hits.branding === 0 && state.hits.settings === 0,
    `a lightweight session read triggered unrelated loads: ${JSON.stringify(state.hits)}`,
  );
}

async function multiUserIsolation() {
  await reset();
  const [userFr, userAr] = await Promise.all([
    fetch(`${origin}/school`, { headers: { accept: 'text/html', cookie: 'fixture-session=school-es' } }).then((r) => r.text()),
    fetch(`${origin}/school`, { headers: { accept: 'text/html', cookie: 'fixture-session=school-ar' } }).then((r) => r.text()),
  ]);
  // User preference (session language) beats the institution default; the
  // cookie-free Spanish default and the Arabic session value never cross.
  assert(userFr.includes('school:signed-in:es:'), 'user A did not render its own session language');
  assert(userAr.includes('school:signed-in:ar:'), 'user B did not render its own session language');
  assert(!userAr.includes('school:signed-in:es:'), 'user A state leaked into user B');
}

async function snapshotsStayPublicAndSerializable(output: string[]) {
  await reset();
  const html = await navigate('/kafil');
  for (const forbidden of ['remember', 'QueryClient', 'getServer', 'resolvePreferences', 'readSettings']) {
    assert(!html.includes(forbidden), `snapshot leaked an internal: ${forbidden}`);
  }
  const serverOutput = output.join('');
  assert(!serverOutput.includes('SECRET'), 'server output leaked a secret marker');
}

async function navigate(path: string): Promise<string> {
  const response = await fetch(`${origin}${path}`, { headers: { accept: 'text/html' } });
  assert(response.status === 200, `${path} responded ${response.status}`);
  return response.text();
}

async function reset(patch: Record<string, unknown> = {}) {
  const response = await fetch(`${origin}/api/fixture/state`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });
  assert(response.status === 200, `reset responded ${response.status}`);
}

async function readState(): Promise<{ hits: Record<string, number>; diagnostics: string[] }> {
  const response = await fetch(`${origin}/api/fixture/state`);
  assert(response.status === 200, `state responded ${response.status}`);
  return response.json() as Promise<{ hits: Record<string, number>; diagnostics: string[] }>;
}

async function withProductionServer(run: (context: { output: string[] }) => Promise<void>) {
  const runtimeEnv = cleanFixtureEnv({
    ...process.env,
    HOSTNAME: '127.0.0.1',
    NODE_ENV: 'production',
    PORT: String(port),
    NAJM_NEXT_DIST_DIR: distDir,
  });

  const server = Bun.spawn({
    cmd: [process.execPath, nextBin, 'start', '--hostname', '127.0.0.1', '--port', String(port)],
    cwd: fixture,
    env: runtimeEnv,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const output: string[] = [];
  void collect(server.stdout, output);
  void collect(server.stderr, output);

  try {
    await waitForServer(`${origin}/kafil`, server);
    await run({ output });
    assertNoWorkspaceRootWarning(output.join(''), 'production server');
  } catch (error) {
    console.error(output.join(''));
    throw error;
  } finally {
    server.kill();
    await server.exited;
  }
}

async function runBuild(): Promise<string> {
  const child = Bun.spawn({
    cmd: [process.execPath, nextBin, 'build'],
    cwd: fixture,
    env: buildEnv,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const output: string[] = [];
  await Promise.all([tee(child.stdout, process.stdout, output), tee(child.stderr, process.stderr, output)]);
  if ((await child.exited) !== 0) {
    throw new Error('Next.js 16 production app/server fixture build failed');
  }
  return output.join('');
}

async function tee(
  stream: ReadableStream<Uint8Array> | null,
  sink: { write: (chunk: Uint8Array) => unknown },
  output: string[],
): Promise<void> {
  if (!stream) return;
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      output.push(decoder.decode(value, { stream: true }));
      sink.write(value);
    }
  }
  output.push(decoder.decode());
}

async function collect(stream: ReadableStream<Uint8Array>, output: string[]) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    output.push(decoder.decode(value, { stream: true }));
  }
}

async function waitForServer(url: string, process: Bun.Subprocess) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (process.exitCode !== null) {
      throw new Error(`Next.js production server exited with ${process.exitCode}`);
    }
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.status < 500) return;
    } catch {
      // Server is still starting.
    }
    await Bun.sleep(100);
  }
  throw new Error('Timed out waiting for Next.js production server');
}

function cleanFixtureEnv(env: Record<string, string | undefined>) {
  const cleaned = { ...env };
  delete cleaned.NAJM_AUTH_INTERNAL_URL;
  delete cleaned.FIXTURE_INTERNAL_RECOVERY_URL;
  delete cleaned.FIXTURE_THROW_DIAGNOSTIC;
  return cleaned;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
