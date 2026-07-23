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
const port = 31_000 + Math.floor(Math.random() * 1_000);
const proxyPort = 32_000 + Math.floor(Math.random() * 1_000);
const internalOrigin = `http://127.0.0.1:${port}`;
const origin = `http://127.0.0.1:${proxyPort}`;
const buildSessionSecret = 'build-only-next16-secret-at-least-32-characters';
const runtimeSessionSecret = 'runtime-next16-secret-at-least-32-characters';
const distDir = '.next-integration';
const sharedEnv = {
  ...process.env,
  HOSTNAME: '127.0.0.1',
  NODE_ENV: 'production',
  PORT: String(port),
  NAJM_NEXT_DIST_DIR: distDir,
};
const buildEnv = { ...sharedEnv, JWT_ACCESS_SECRET: buildSessionSecret };
const runtimeEnv = {
  ...sharedEnv,
  JWT_ACCESS_SECRET: runtimeSessionSecret,
  RUNTIME_SESSION_SECRET: runtimeSessionSecret,
  NAJM_AUTH_INTERNAL_URL: `${internalOrigin}/api/auth/session/recover`,
};

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
const reverseProxy = Bun.serve({
  hostname: '127.0.0.1',
  port: proxyPort,
  async fetch(request) {
    const incoming = new URL(request.url);
    const headers = new Headers(request.headers);
    headers.set('host', `127.0.0.1:${proxyPort}`);
    headers.set('x-forwarded-host', `127.0.0.1:${proxyPort}`);
    headers.set('x-forwarded-proto', 'http');
    try {
      const upstream = await fetch(`${internalOrigin}${incoming.pathname}${incoming.search}`, {
        method: request.method,
        headers,
        body: request.method === 'GET' || request.method === 'HEAD'
          ? undefined
          : request.body,
        redirect: 'manual',
      });
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

  const login = await fetch(`${origin}/api/auth/login`, {
    method: 'POST',
    redirect: 'manual',
  });
  assert(login.status === 200, `login failed with ${login.status}`);
  const cookies = responseCookies(login);
  assert(cookies.has('refreshToken'), 'login response did not set refreshToken');
  assert(cookies.has('najm.session'), 'login response did not set najm.session');

  const navigation = await fetch(`${origin}/protected`, {
    headers: {
      Cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; '),
    },
    redirect: 'manual',
  });
  const body = await navigation.text();
  assert(
    navigation.status === 200,
    `protected navigation returned ${navigation.status} (${navigation.headers.get('location') ?? 'no location'})`,
  );
  assert(body.includes('Protected navigation succeeded'), 'protected page was not rendered');
  assert(
    responseCookies(navigation).has('najm.session'),
    'authoritative recovery did not persist a new session cookie',
  );

  console.log('Next.js 16 + Bun production proxy login/navigation: PASS');
} catch (error) {
  console.error(output.join(''));
  throw error;
} finally {
  reverseProxy.stop(true);
  server.kill();
  await server.exited;
  rmSync(join(fixture, distDir), { recursive: true, force: true });
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
  const values = response.headers.getSetCookie?.()
    ?? [response.headers.get('set-cookie')].filter((value): value is string => Boolean(value));
  const cookies = new Map<string, string>();
  for (const header of values) {
    const [pair] = header.split(';', 1);
    const separator = pair!.indexOf('=');
    if (separator > 0) {
      cookies.set(pair!.slice(0, separator), pair!.slice(separator + 1));
    }
  }
  return cookies;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
