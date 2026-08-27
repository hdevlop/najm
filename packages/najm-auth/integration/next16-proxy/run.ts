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
const portSeed = 31_000 + Math.floor(Math.random() * 500);
const buildSessionSecret = 'build-only-next16-secret-at-least-32-characters';
const runtimeSessionSecret = 'runtime-next16-secret-at-least-32-characters';
const distDir = '.next-integration';
const buildEnv = cleanFixtureEnv({
  ...process.env,
  HOSTNAME: '127.0.0.1',
  NODE_ENV: 'production',
  NAJM_NEXT_DIST_DIR: distDir,
  JWT_ACCESS_SECRET: buildSessionSecret,
});

rmSync(join(fixture, distDir), { recursive: true, force: true });

const build = Bun.spawn({
  cmd: [process.execPath, nextBin, 'build'],
  cwd: fixture,
  env: buildEnv,
  stdout: 'inherit',
  stderr: 'inherit',
});
if (await build.exited !== 0) {
  throw new Error('Next.js 16 production fixture build failed');
}

try {
  await runMainRecoverySuite();
  await runNonLoopbackRejection();
  await runExplicitPrecedence();
  await runSharedSessionSuite();
  console.log('Next.js 16 + Bun production proxy recovery suite: PASS');
} finally {
  rmSync(join(fixture, distDir), { recursive: true, force: true });
}

async function runMainRecoverySuite() {
  await withProductionServer(0, ({ internalOrigin }) => ({
    NAJM_AUTH_INTERNAL_URL: `${internalOrigin}/api/auth/session/recover`,
    FIXTURE_THROW_DIAGNOSTIC: '1',
  }), async ({ origin, output }) => {
    const admin = await login(origin, { role: 'admin' });
    assert(admin.response.status === 200, `login failed with ${admin.response.status}`);
    assert(admin.cookies.has('refreshToken'), 'login did not issue refreshToken');
    assert(admin.cookies.has('najm.session'), 'login did not issue najm.session');

    const immediate = await navigate(origin, '/protected', admin.cookies);
    await expectProtected(immediate, 'immediate protected navigation');
    assertSessionOnlyRecovery(immediate, admin.cookies.get('refreshToken')!);

    const logout = await fetch(`${origin}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: [...admin.cookies]
          .map(([name, value]) => `${name}=${value}`)
          .join('; '),
      },
      redirect: 'manual',
    });
    assert(logout.status === 200, `logout returned ${logout.status}`);
    for (const name of ['refreshToken', 'najm.session']) {
      assertClearsCookie(logout, name);
      assert(
        setCookieHeaders(logout).filter((header) => header.startsWith(`${name}=`)).length === 1,
        `logout did not emit exactly one ${name} deletion`,
      );
    }
    assert(
      setCookieHeaders(logout).includes('unrelated=kept; Path=/'),
      'logout removed an unrelated cookie header',
    );

    const sessionless = new Map(admin.cookies);
    sessionless.delete('najm.session');
    const recoveredMissing = await navigate(origin, '/protected', sessionless);
    await expectProtected(recoveredMissing, 'missing-session recovery');
    assertSessionOnlyRecovery(recoveredMissing, admin.cookies.get('refreshToken')!);

    const tampered = new Map(admin.cookies);
    tampered.set('najm.session', `${tampered.get('najm.session')}tampered`);
    const recoveredTampered = await navigate(origin, '/protected', tampered);
    await expectProtected(recoveredTampered, 'tampered-session recovery');
    const tamperedReplacement = responseCookies(recoveredTampered).get('najm.session');
    assert(Boolean(tamperedReplacement), 'tampered session was not replaced');
    assert(
      tamperedReplacement !== tampered.get('najm.session'),
      'tampered session value survived authoritative recovery',
    );
    assertSessionOnlyRecovery(recoveredTampered, admin.cookies.get('refreshToken')!);

    const expiredSession = await login(origin, {
      role: 'admin',
      sessionAgeSeconds: 301,
    });
    const recoveredExpired = await navigate(origin, '/protected', expiredSession.cookies);
    await expectProtected(recoveredExpired, 'expired-session recovery');
    assertSessionOnlyRecovery(
      recoveredExpired,
      expiredSession.cookies.get('refreshToken')!,
    );

    const expiredRefresh = await login(origin, {
      role: 'admin',
      refreshState: 'expired',
    });
    const expiredResponse = await navigate(origin, '/protected', expiredRefresh.cookies);
    expectLoginRedirect(expiredResponse, 'expired refresh token');
    assertClearsCookie(expiredResponse, 'refreshToken');
    assertClearsCookie(expiredResponse, 'najm.session');

    const invalidRefresh = await login(origin, {
      role: 'admin',
      refreshState: 'invalid',
    });
    const invalidResponse = await navigate(origin, '/protected', invalidRefresh.cookies);
    expectLoginRedirect(invalidResponse, 'invalid refresh token');
    assertClearsCookie(invalidResponse, 'refreshToken');
    assertClearsCookie(invalidResponse, 'najm.session');

    const sponsor = await login(origin, { role: 'sponsor' });
    const forbidden = await navigate(origin, '/admin', sponsor.cookies);
    assert(forbidden.status === 403, `wrong role returned ${forbidden.status}, expected 403`);

    await Bun.sleep(50);
    const diagnostics = output.join('');
    assert(
      diagnostics.includes('NAJM_RECOVERY_FAILURE')
        && diagnostics.includes('"reason":"http-status"'),
      'production diagnostics did not report the safe recovery reason',
    );
    for (const secret of [
      'integration-invalid-refresh',
      'integration-expired-refresh',
      runtimeSessionSecret,
      'integration-admin-access',
    ]) {
      assert(!diagnostics.includes(secret), `diagnostics exposed credential material: ${secret}`);
    }
  });
}

async function runNonLoopbackRejection() {
  await withProductionServer(1, () => ({
    NAJM_AUTH_INTERNAL_URL: 'https://auth.internal.example/api/auth/session/recover',
  }), async ({ origin, output }) => {
    const admin = await login(origin, { role: 'admin' });
    const response = await navigate(origin, '/protected', admin.cookies);
    expectLoginRedirect(response, 'non-loopback internalRecoveryURL');
    assertClearsCookie(response, 'najm.session');
    assert(!clearsCookie(response, 'refreshToken'), 'transport failure cleared refresh cookie');

    await Bun.sleep(50);
    const diagnostics = output.join('');
    assert(
      diagnostics.includes('"reason":"invalid-endpoint"'),
      'non-loopback internalRecoveryURL was not rejected safely',
    );
    assert(
      !diagnostics.includes('integration-admin-refresh'),
      'invalid-endpoint diagnostics exposed the refresh token',
    );
  });
}

async function runExplicitPrecedence() {
  await withProductionServer(2, ({ internalOrigin }) => ({
    NAJM_AUTH_INTERNAL_URL: 'https://ignored.example/api/auth/session/recover',
    FIXTURE_INTERNAL_RECOVERY_URL: `${internalOrigin}/api/auth/session/recover`,
  }), async ({ origin }) => {
    const admin = await login(origin, { role: 'admin' });
    const response = await navigate(origin, '/protected', admin.cookies);
    await expectProtected(response, 'explicit internalRecoveryURL precedence');
  });
}

/**
 * `/shared` sits outside `protectedRoutes`, so the proxy leaves it alone and
 * the React render is the only thing resolving a session. Its root layout,
 * nested layout, and page each ask — through one `createReactServerAuth`
 * instance — so a navigation that needs recovery must produce exactly one
 * recovery round trip, not three.
 */
async function runSharedSessionSuite() {
  await withProductionServer(3, ({ internalOrigin }) => ({
    NAJM_AUTH_INTERNAL_URL: `${internalOrigin}/api/auth/session/recover`,
  }), async ({ origin }) => {
    const admin = await login(origin, { role: 'admin' });
    const recoverable = new Map(admin.cookies);
    recoverable.delete('najm.session');

    const before = await recoveryCount(origin);
    const shared = await navigate(origin, '/shared', recoverable);
    const body = await shared.text();
    const spent = await recoveryCount(origin) - before;

    assert(
      shared.status === 200,
      `shared navigation returned ${shared.status} (${shared.headers.get('location') ?? 'no location'})`,
    );
    assert(body.includes('shared navigation succeeded'), 'shared page did not render');
    assert(
      spent === 1,
      `three server boundaries resolved the session ${spent} times, expected one shared resolution`,
    );
    for (const marker of ['root:integration-admin', 'layout:integration-admin', 'page:integration-admin']) {
      assert(body.includes(marker), `shared render is missing ${marker}`);
    }

    // A second request must not inherit the first request's resolution.
    const sponsor = await login(origin, { role: 'sponsor' });
    const sponsorCookies = new Map(sponsor.cookies);
    sponsorCookies.delete('najm.session');
    const forbidden = await navigate(origin, '/shared', sponsorCookies);
    assert(
      forbidden.status === 307 && forbidden.headers.get('location')?.endsWith('/forbidden'),
      `wrong role on /shared returned ${forbidden.status} → ${forbidden.headers.get('location')}`,
    );

    const anonymous = await navigate(origin, '/shared', new Map());
    assert(
      anonymous.status === 307 && anonymous.headers.get('location')?.endsWith('/login'),
      `anonymous /shared returned ${anonymous.status} → ${anonymous.headers.get('location')}`,
    );
  });
}

async function recoveryCount(origin: string): Promise<number> {
  const response = await fetch(`${origin}/api/fixture/recoveries`, { redirect: 'manual' });
  const body = await response.json() as { count: number };
  return body.count;
}

async function withProductionServer(
  offset: number,
  extraEnv: (origins: { internalOrigin: string }) => Record<string, string>,
  run: (context: {
    origin: string;
    internalOrigin: string;
    output: string[];
  }) => Promise<void>,
) {
  const port = portSeed + offset;
  const proxyPort = portSeed + 1_000 + offset;
  const internalOrigin = `http://127.0.0.1:${port}`;
  const origin = `http://127.0.0.1:${proxyPort}`;
  const runtimeEnv = {
    ...cleanFixtureEnv({
      ...process.env,
      HOSTNAME: '127.0.0.1',
      NODE_ENV: 'production',
      PORT: String(port),
      NAJM_NEXT_DIST_DIR: distDir,
      JWT_ACCESS_SECRET: runtimeSessionSecret,
      RUNTIME_SESSION_SECRET: runtimeSessionSecret,
    }),
    ...extraEnv({ internalOrigin }),
  };

  const server = Bun.spawn({
    cmd: [
      process.execPath,
      nextBin,
      'start',
      '--hostname',
      '127.0.0.1',
      '--port',
      String(port),
    ],
    cwd: fixture,
    env: runtimeEnv,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const output: string[] = [];
  void collect(server.stdout, output);
  void collect(server.stderr, output);
  const publicHost = `public.example.test:${proxyPort}`;
  const reverseProxy = Bun.serve({
    hostname: '127.0.0.1',
    port: proxyPort,
    async fetch(request) {
      const incoming = new URL(request.url);
      const headers = new Headers(request.headers);
      headers.set('host', publicHost);
      headers.set('x-forwarded-host', publicHost);
      headers.set('x-forwarded-proto', 'http');
      try {
        const upstream = await fetch(
          `${internalOrigin}${incoming.pathname}${incoming.search}`,
          {
            method: request.method,
            headers,
            body: request.method === 'GET' || request.method === 'HEAD'
              ? undefined
              : request.body,
            redirect: 'manual',
          },
        );
        const responseHeaders = new Headers(upstream.headers);
        responseHeaders.delete('content-encoding');
        responseHeaders.delete('content-length');
        return new Response(await upstream.arrayBuffer(), {
          status: upstream.status,
          headers: responseHeaders,
        });
      } catch {
        return new Response('upstream unavailable', { status: 503 });
      }
    },
  });

  try {
    await waitForServer(`${origin}/login`, server);
    await run({ origin, internalOrigin, output });
  } catch (error) {
    console.error(output.join(''));
    throw error;
  } finally {
    reverseProxy.stop(true);
    server.kill();
    await server.exited;
  }
}

async function login(
  origin: string,
  input: {
    role?: 'admin' | 'sponsor';
    refreshState?: 'active' | 'expired' | 'invalid';
    sessionAgeSeconds?: number;
  },
) {
  const response = await fetch(`${origin}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    redirect: 'manual',
  });
  return { response, cookies: responseCookies(response) };
}

function navigate(origin: string, pathname: string, cookies: Map<string, string>) {
  return fetch(`${origin}${pathname}`, {
    headers: {
      Cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; '),
    },
    redirect: 'manual',
  });
}

async function expectProtected(response: Response, label: string) {
  const body = await response.text();
  assert(
    response.status === 200,
    `${label} returned ${response.status} (${response.headers.get('location') ?? 'no location'})`,
  );
  assert(body.includes('Protected navigation succeeded'), `${label} did not render protected page`);
}

function expectLoginRedirect(response: Response, label: string) {
  assert(
    response.status === 307,
    `${label} returned ${response.status}, expected login redirect`,
  );
  assert(
    response.headers.get('location')?.includes('/login?from='),
    `${label} did not preserve a safe login return path`,
  );
}

function assertSessionOnlyRecovery(response: Response, originalRefresh: string) {
  const cookies = responseCookies(response);
  assert(cookies.has('najm.session'), 'authoritative recovery did not set najm.session');
  assert(!cookies.has('refreshToken'), 'authoritative recovery rotated refreshToken');
  assert(originalRefresh.length > 0, 'original refresh token was unexpectedly empty');
}

function assertClearsCookie(response: Response, name: string) {
  assert(clearsCookie(response, name), `response did not clear ${name}`);
}

function clearsCookie(response: Response, name: string) {
  return setCookieHeaders(response).some((header) => (
    header.startsWith(`${name}=`)
    && (
      header.startsWith(`${name}=;`)
      || /Max-Age=0/i.test(header)
      || /Expires=Thu, 01 Jan 1970/i.test(header)
    )
  ));
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

function responseCookies(response: Response) {
  const cookies = new Map<string, string>();
  for (const header of setCookieHeaders(response)) {
    const [pair] = header.split(';', 1);
    const separator = pair!.indexOf('=');
    if (separator > 0) {
      cookies.set(pair!.slice(0, separator), pair!.slice(separator + 1));
    }
  }
  return cookies;
}

function setCookieHeaders(response: Response): string[] {
  return response.headers.getSetCookie?.()
    ?? [response.headers.get('set-cookie')].filter((value): value is string => Boolean(value));
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
