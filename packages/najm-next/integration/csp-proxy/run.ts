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
const portSeed = 33_000 + Math.floor(Math.random() * 500);
const distDir = '.next-integration';

for (const entry of ['dist/security.js', 'dist/security/reports.js', 'dist/app.js', 'dist/instrumentation/client.js']) {
  if (!existsSync(join(packageRoot, entry))) {
    throw new Error(`najm-next dist is missing (${entry}). Run "bun run build" in packages/najm-next first.`);
  }
}

// The proxy matcher must stay a static literal (Next analyzes it at build
// time); the composition module itself never defines one.
const proxySource = readFileSync(join(fixture, 'src', 'proxy.ts'), 'utf8');
assert(proxySource.includes('matcher:'), 'fixture proxy lost its static matcher literal');

// The fixture config must compose through the shared Najm contract instead
// of hand-building root discovery. Anything hard-coding the repository root
// here would reintroduce the inference warnings below.
const nextConfigSource = readFileSync(join(fixture, 'next.config.ts'), 'utf8');
assert(
  nextConfigSource.includes("from 'najm-next/configurable'") &&
    nextConfigSource.includes('defineNajmNextConfig('),
  'fixture must compose its config through najm-next/configurable',
);
assert(!nextConfigSource.includes('..'), 'fixture config must not hard-code the repository root');

const buildEnv = cleanFixtureEnv({
  ...process.env,
  HOSTNAME: '127.0.0.1',
  NODE_ENV: 'production',
  NAJM_NEXT_DIST_DIR: distDir,
});

rmSync(join(fixture, distDir), { recursive: true, force: true });

/**
 * Markers for Next's root-inference warnings. The shared preset pins
 * `turbopack.root` (and the tracing root) to the discovered workspace root,
 * so neither warning may appear; a recurrence fails the fixture instead of
 * scrolling by in teed output.
 */
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
  await runCspProxySuite();
  console.log('Next.js 16 + Bun production CSP/proxy suite: PASS');
} finally {
  rmSync(join(fixture, distDir), { recursive: true, force: true });
}

/**
 * Run the production build with output teed live to this process (so useful
 * build output is preserved on failure) while also capturing it for the
 * workspace-root warning assertion above.
 */
async function runBuild(): Promise<string> {
  const child = Bun.spawn({
    cmd: [process.execPath, nextBin, 'build'],
    cwd: fixture,
    env: buildEnv,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const output: string[] = [];
  await Promise.all([
    tee(child.stdout, process.stdout, output),
    tee(child.stderr, process.stderr, output),
  ]);
  if ((await child.exited) !== 0) {
    throw new Error('Next.js 16 production fixture build failed');
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

async function runCspProxySuite() {
  await withProductionServer(async ({ origin, output }) => {
    const first = await expectNonceProtected(await navigate(origin, '/kafil', new Map()), 'kafil-style page');
    const second = await expectNonceProtected(await navigate(origin, '/kafil', new Map()), 'kafil-style repeat');
    assert(
      nonceFromPolicy(first.policy) !== nonceFromPolicy(second.policy),
      'two page requests reused the same CSP nonce',
    );
    assert(
      first.policy.includes('https://cdnjs.cloudflare.com') &&
        first.policy.includes('https://tile.openstreetmap.org'),
      'kafil-style policy lost its imagery origins',
    );
    assert(first.policy.includes("frame-src 'none'"), 'kafil-style policy lost frame-src none');

    const school = await expectNonceProtected(await navigate(origin, '/school', new Map()), 'school-style page');
    for (const expected of [
      'https://*.googleapis.com',
      'https://*.google.com',
      'https://*.gstatic.com',
      "frame-src 'self' https://www.google.com",
    ]) {
      assert(school.policy.includes(expected), `school-style policy is missing ${expected}`);
    }

    const denied = await navigate(origin, '/protected', new Map());
    assert(denied.status === 307, `protected navigation without session returned ${denied.status}, expected 307`);
    assert(
      denied.headers.get('location')?.includes('/login?from='),
      'protected redirect did not preserve a safe login return path',
    );
    assert(
      (denied.headers.get('content-security-policy') ?? '').includes('report-uri /api/csp-report'),
      'redirect response lost the request policy',
    );
    assertClearsCookie(denied, 'stub.session');

    const recovered = await navigate(origin, '/protected', new Map([['stub.session', 'valid']]));
    assert(recovered.status === 200, `protected navigation with session returned ${recovered.status}`);
    const cookies = setCookieHeaders(recovered);
    assert(cookies.some((header) => header.startsWith('stub.session=valid')), 'recovery dropped the session cookie');
    assert(cookies.some((header) => header.startsWith('stub.refresh=renewed')), 'recovery dropped the refresh cookie');
    assert(recovered.headers.get('x-fixture-auth') === 'recovered', 'recovery dropped the auth response header');
    const recoveredBody = await recovered.text();
    assert(recoveredBody.includes('protected navigation succeeded'), 'protected page did not render');

    const reportSecrets = ['REPORT-TOKEN-ABC', 'REPORT-SESSION-XYZ'];
    const report = await fetch(`${origin}/api/csp-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/csp-report' },
      body: JSON.stringify({
        'csp-report': {
          'document-uri': `https://fixture.test/reset?token=${reportSecrets[0]}#frag`,
          'violated-directive': 'script-src',
          'effective-directive': 'script-src',
          'blocked-uri': `https://user:pass@evil.test:8443/some/path?session=${reportSecrets[1]}`,
        },
      }),
      redirect: 'manual',
    });
    assert(report.status === 204, `valid report returned ${report.status}, expected 204`);
    assert((await report.text()) === '', 'report response echoed a body');

    for (const body of ['not json', 'y'.repeat(20_000)]) {
      const response = await fetch(`${origin}/api/csp-report`, { method: 'POST', body, redirect: 'manual' });
      assert(response.status === 204, `unparsable report returned ${response.status}, expected 204`);
      assert((await response.text()) === '', 'unparsable report response echoed a body');
    }

    await Bun.sleep(100);
    const diagnostics = output.join('');
    assert(diagnostics.includes('[csp] violation'), 'production server did not log the sanitized report');
    assert(diagnostics.includes('https://evil.test:8443'), 'sanitized report lost the violating origin');
    assert(diagnostics.includes('https://fixture.test'), 'sanitized report lost the document origin');
    for (const secret of [...reportSecrets, 'user:pass', '/some/path']) {
      assert(!diagnostics.includes(secret), `report sink leaked sensitive material: ${secret}`);
    }
  });
}

async function withProductionServer(
  run: (context: { origin: string; output: string[] }) => Promise<void>,
) {
  const port = portSeed;
  const origin = `http://127.0.0.1:${port}`;
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
    await waitForServer(`${origin}/login`, server);
    await run({ origin, output });
    assertNoWorkspaceRootWarning(output.join(''), 'production server');
  } catch (error) {
    console.error(output.join(''));
    throw error;
  } finally {
    server.kill();
    await server.exited;
  }
}

function navigate(origin: string, pathname: string, cookies: Map<string, string>) {
  const header = [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  return fetch(`${origin}${pathname}`, {
    headers: header ? { Cookie: header } : {},
    redirect: 'manual',
  });
}

async function expectNonceProtected(
  response: Response,
  label: string,
): Promise<{ body: string; policy: string }> {
  const body = await response.text();
  assert(response.status === 200, `${label} returned ${response.status}`);

  const policy = response.headers.get('content-security-policy') ?? '';
  assert(policy.includes('report-uri /api/csp-report'), `${label} did not return the app report endpoint`);
  // A duplicated enforcing header arrives comma-joined; no valid token here
  // contains a comma, so its absence proves a single policy (CSP-04).
  assert(!policy.includes(','), `${label} returned more than one enforcing CSP`);
  assert(!policy.includes("'unsafe-eval'"), `${label} weakened the production policy with unsafe-eval`);
  const scriptSrc = policy.split(';').find((part) => part.trim().startsWith('script-src')) ?? '';
  assert(!scriptSrc.includes("'unsafe-inline'"), `${label} allows inline script`);

  const policyNonce = nonceFromPolicy(policy);
  assert(Boolean(policyNonce), `${label} did not return a nonce-based CSP`);

  const bodyNonce = /<body[^>]*data-nonce="([^"]+)"/.exec(body)?.[1];
  assert(bodyNonce === policyNonce, `${label} did not expose the request nonce to the render`);

  const scripts = [...body.matchAll(/<script\b([^>]*)>/g)];
  assert(scripts.length > 0, `${label} rendered no Next.js scripts`);
  for (const script of scripts) {
    assert(script[1]?.includes(`nonce="${policyNonce}"`), `${label} rendered a script without the response nonce`);
  }

  return { body, policy };
}

function nonceFromPolicy(policy: string): string {
  return /'nonce-([^']+)'/.exec(policy)?.[1] ?? '';
}

function setCookieHeaders(response: Response): string[] {
  return (
    response.headers.getSetCookie?.() ??
    [response.headers.get('set-cookie')].filter((value): value is string => Boolean(value))
  );
}

function assertClearsCookie(response: Response, name: string) {
  const cleared = setCookieHeaders(response).some(
    (header) =>
      header.startsWith(`${name}=`) &&
      (header.startsWith(`${name}=;`) || /Max-Age=0/i.test(header) || /Expires=Thu, 01 Jan 1970/i.test(header)),
  );
  assert(cleared, `response did not clear ${name}`);
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
