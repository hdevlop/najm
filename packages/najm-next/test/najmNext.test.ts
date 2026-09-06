import { afterAll, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  DEFAULT_DIST_DIR,
  NajmNextConfigError,
  assertNextCompatible,
  compareVersions,
  createNajmServiceWorker,
  createNajmNextConfig,
  defineNajmNextConfig,
  detectServiceWorkers,
  findWorkspaceRoot,
  parseDevOrigins,
  resetCompatibilityWarning,
  resolveDistDir,
  serviceWorkerHeaders,
} from '../src/index';

const roots: string[] = [];

function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), 'najm-next-'));
  roots.push(dir);
  return dir;
}

function write(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, 'utf8');
}

function workspace(): string {
  const repo = scratch();
  write(join(repo, 'package.json'), '{"name":"repo","workspaces":["apps/*"]}');
  const dir = join(repo, 'apps', 'web');
  write(join(dir, 'package.json'), '{"name":"web"}');
  return dir;
}

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

describe('findWorkspaceRoot', () => {
  test('stops at the nearest workspace declaration, not an outer lockfile', () => {
    const outer = scratch();
    write(join(outer, 'bun.lock'), '');
    write(join(outer, 'package.json'), '{"name":"home"}');

    const repo = join(outer, 'repo');
    write(join(repo, 'package.json'), '{"name":"repo","workspaces":["apps/*"]}');

    const app = join(repo, 'apps', 'web');
    write(join(app, 'package.json'), '{"name":"web"}');

    expect(findWorkspaceRoot(app)).toBe(repo);
  });

  test('accepts the object form of workspaces', () => {
    const repo = scratch();
    write(join(repo, 'package.json'), '{"name":"repo","workspaces":{"packages":["packages/*"]}}');
    const app = join(repo, 'apps', 'web');
    write(join(app, 'package.json'), '{"name":"web"}');

    expect(findWorkspaceRoot(app)).toBe(repo);
  });

  test('falls back to a lockfile when nothing declares workspaces', () => {
    const repo = scratch();
    write(join(repo, 'package-lock.json'), '{}');
    const app = join(repo, 'app');
    mkdirSync(app, { recursive: true });

    expect(findWorkspaceRoot(app)).toBe(repo);
  });

  test('ignores a malformed manifest instead of throwing', () => {
    const outer = scratch();
    write(join(outer, 'bun.lock'), '');
    const repo = join(outer, 'repo');
    write(join(repo, 'package.json'), 'not json');
    const app = join(repo, 'app');
    mkdirSync(app, { recursive: true });

    expect(findWorkspaceRoot(app)).toBe(outer);
  });
});

describe('resolveDistDir', () => {
  test('defaults to .next', () => {
    expect(resolveDistDir({})).toBe(DEFAULT_DIST_DIR);
    expect(resolveDistDir({ NAJM_NEXT_DIST_DIR: '  ' })).toBe(DEFAULT_DIST_DIR);
  });

  test('accepts a relative override', () => {
    expect(resolveDistDir({ NAJM_NEXT_DIST_DIR: '.next-e2e' })).toBe('.next-e2e');
  });

  test('rejects paths that leave the app directory', () => {
    expect(() => resolveDistDir({ NAJM_NEXT_DIST_DIR: '../build' })).toThrow(NajmNextConfigError);
    expect(() => resolveDistDir({ NAJM_NEXT_DIST_DIR: '/tmp/build' })).toThrow(NajmNextConfigError);
    expect(() => resolveDistDir({ NAJM_NEXT_DIST_DIR: 'C:\\build' })).toThrow(NajmNextConfigError);
  });
});

describe('parseDevOrigins', () => {
  test('is empty unless the environment opts in', () => {
    expect(parseDevOrigins(undefined)).toEqual([]);
    expect(parseDevOrigins('')).toEqual([]);
  });

  test('splits, normalizes, and dedupes', () => {
    expect(parseDevOrigins('127.0.0.1, http://192.168.1.13:3000  192.168.1.13')).toEqual([
      '127.0.0.1',
      '192.168.1.13',
    ]);
  });

  test('keeps wildcard subdomains but refuses a bare wildcard', () => {
    expect(parseDevOrigins('*.local-origin.dev')).toEqual(['*.local-origin.dev']);
    expect(() => parseDevOrigins('*')).toThrow(NajmNextConfigError);
  });

  test('refuses an unusable origin', () => {
    expect(() => parseDevOrigins('https://')).toThrow(NajmNextConfigError);
  });
});

describe('service workers', () => {
  test('emits headers only for files that exist', () => {
    const app = scratch();
    expect(detectServiceWorkers(app)).toEqual([]);
    expect(serviceWorkerHeaders(app)).toEqual([]);

    write(join(app, 'public', 'sw.js'), '');
    expect(detectServiceWorkers(app)).toEqual(['sw.js']);

    const [rule] = serviceWorkerHeaders(app);
    expect(rule?.source).toBe('/sw.js');
    expect(rule?.headers.map((header) => header.key)).toEqual([
      'Content-Type',
      'Cache-Control',
      'Content-Security-Policy',
      'Service-Worker-Allowed',
    ]);
  });

  test('serves a zero-config privacy-safe worker route', async () => {
    const response = (await import('../src/pwa')).GET();
    const worker = await response.text();

    expect(response.headers.get('content-type')).toBe('application/javascript; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('no-cache, no-store, must-revalidate');
    expect(response.headers.get('service-worker-allowed')).toBe('/');
    expect(worker).toContain('request.mode !== "navigate"');
    expect(worker).toContain('requestUrl.origin !== self.location.origin');
    expect(worker).not.toContain('cache.put');
    expect(worker).not.toContain('"/api/"');
  });

  test('pre-caches only explicit app shell assets and scopes cleanup to its cache id', async () => {
    const GET = createNajmServiceWorker({
      cacheId: 'kafil',
      cacheVersion: 'v2',
      offlineUrl: '/offline.html',
      precache: ['/icons/kafil-192.png', '/offline.html'],
    });
    const worker = await GET().text();

    expect(worker).toContain('const CACHE_PREFIX = "najm-pwa:kafil:"');
    expect(worker).toContain('const CACHE_NAME = CACHE_PREFIX + "v2"');
    expect(worker).toContain('const PRECACHE = ["/offline.html","/icons/kafil-192.png"]');
    expect(worker).toContain('key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME');
    expect(worker).toContain('PRECACHE.includes(requestPath) && request.mode !== "navigate"');
  });

  test('escapes inline fallback copy and rejects cross-origin shell paths', async () => {
    const GET = createNajmServiceWorker({
      offlineDocument: { title: '<School & Home>' },
    });
    const worker = await GET().text();

    expect(worker).toContain('&lt;School &amp; Home&gt;');
    expect(() => createNajmServiceWorker({ offlineUrl: 'https://example.com/offline' })).toThrow(
      'same-origin absolute path',
    );
    expect(() => createNajmServiceWorker({ precache: ['//cdn.example.com/icon.png'] })).toThrow(
      'same-origin absolute path',
    );
  });

  test('adds typed push handling without changing the privacy-safe fetch behavior', async () => {
    const GET = createNajmServiceWorker({
      cacheId: 'push-app',
      push: {
        defaultTitle: 'Example App',
        notificationPath: '/inbox',
        icon: '/icons/app.png',
        badge: '/icons/badge.png',
      },
    });
    const worker = await GET().text();

    expect(worker).toContain('addEventListener("push"');
    expect(worker).toContain('addEventListener("notificationclick"');
    expect(worker).toContain('const PUSH_NOTIFICATION_PATH = "/inbox"');
    expect(worker).toContain('data: { notificationId: payload.notificationId }');
    expect(worker).toContain('Object.keys(payload).every((key) => PUSH_KEYS.has(key))');
    expect(worker).toContain('payload.notificationId.length > 100');
    expect(worker).toContain('payload.title.length > 120');
    expect(worker).toContain('payload.body.length > 300');
    expect(worker).toContain('url.searchParams.set("focus", notificationId)');
    expect(worker).toContain('new URL(client.url).origin !== self.location.origin');
    expect(worker).not.toContain('data: { notificationId: payload.notificationId, title');
    expect(worker).toContain('request.mode !== "navigate"');
    expect(worker).not.toContain('cache.put');
  });

  test('executes bounded push display and same-origin click behavior', async () => {
    const GET = createNajmServiceWorker({
      push: {
        defaultTitle: 'Example App',
        notificationPath: '/inbox',
        icon: '/icons/app.png',
        badge: '/icons/badge.png',
      },
    });
    const worker = await GET().text();
    const handlers = new Map<string, (event: any) => void>();
    const displayed: Array<{ title: string; options: Record<string, unknown> }> = [];
    const navigated: string[] = [];
    const focused: string[] = [];
    const mockSelf = {
      addEventListener: (type: string, handler: (event: any) => void) => handlers.set(type, handler),
      location: { origin: 'https://app.example' },
      registration: {
        showNotification: async (title: string, options: Record<string, unknown>) => {
          displayed.push({ title, options });
        },
      },
      clients: {
        matchAll: async () => [
          {
            url: 'https://app.example/current',
            navigate: async (url: string) => navigated.push(url),
            focus: async () => focused.push('existing'),
          },
        ],
        openWindow: async (url: string) => focused.push(url),
      },
    };
    new Function('self', 'caches', worker)(mockSelf, {});

    let pushWork: Promise<unknown> | undefined;
    handlers.get('push')?.({
      data: {
        json: () => ({ notificationId: 'notification-1', title: '', body: 'Body' }),
      },
      waitUntil: (work: Promise<unknown>) => {
        pushWork = work;
      },
    });
    await pushWork;
    expect(displayed).toEqual([
      {
        title: 'Example App',
        options: {
          body: 'Body',
          data: { notificationId: 'notification-1' },
          icon: '/icons/app.png',
          badge: '/icons/badge.png',
        },
      },
    ]);

    handlers.get('push')?.({
      data: { json: () => ({ notificationId: 'notification-2', title: 'Title', body: '', url: '/private' }) },
      waitUntil: () => {
        throw new Error('invalid payload must not schedule work');
      },
    });
    expect(displayed).toHaveLength(1);

    let clickWork: Promise<unknown> | undefined;
    handlers.get('notificationclick')?.({
      notification: {
        close: () => undefined,
        data: { notificationId: 'notification-1' },
      },
      waitUntil: (work: Promise<unknown>) => {
        clickWork = work;
      },
    });
    await clickWork;
    expect(navigated).toEqual(['https://app.example/inbox?focus=notification-1']);
    expect(focused).toEqual(['existing']);
  });

  test('rejects unsafe push configuration before emitting a worker', () => {
    expect(() =>
      createNajmServiceWorker({
        push: { defaultTitle: 'App', notificationPath: 'https://example.com/inbox' },
      }),
    ).toThrow('same-origin absolute path');
    expect(() =>
      createNajmServiceWorker({
        push: { defaultTitle: '', notificationPath: '/inbox' },
      }),
    ).toThrow('must contain 1-120 characters');
    expect(() =>
      createNajmServiceWorker({
        push: { defaultTitle: 'App', notificationPath: '/inbox', icon: '//cdn.example.com/icon.png' },
      }),
    ).toThrow('same-origin absolute path');
  });
});

describe('compatibility', () => {
  test('compares versions', () => {
    expect(compareVersions('16.2.10', '15.3.0')).toBe(1);
    expect(compareVersions('15.2.9', '15.3.0')).toBe(-1);
    expect(compareVersions('16.2.10', '16.2.10')).toBe(0);
  });

  test('skips the check when next cannot be resolved', () => {
    expect(assertNextCompatible(scratch())).toBeNull();
  });

  test('warns once past the tested major', () => {
    resetCompatibilityWarning();
    const app = scratch();
    write(join(app, 'package.json'), '{"name":"app"}');
    write(
      join(app, 'node_modules', 'next', 'package.json'),
      '{"name":"next","version":"18.0.0","main":"index.js"}',
    );
    write(join(app, 'node_modules', 'next', 'index.js'), '');

    const warnings: string[] = [];
    const warn = (message: string) => warnings.push(message);
    expect(assertNextCompatible(app, warn)).toBe('18.0.0');
    expect(assertNextCompatible(app, warn)).toBe('18.0.0');
    expect(warnings).toHaveLength(1);
    resetCompatibilityWarning();
  });

  test('throws below the supported floor', () => {
    const app = scratch();
    write(join(app, 'package.json'), '{"name":"app"}');
    write(
      join(app, 'node_modules', 'next', 'package.json'),
      '{"name":"next","version":"14.2.0","main":"index.js"}',
    );
    write(join(app, 'node_modules', 'next', 'index.js'), '');

    expect(() => assertNextCompatible(app)).toThrow(NajmNextConfigError);
  });
});

describe('createNajmNextConfig', () => {
  test('pins the workspace root for Turbopack and file tracing', () => {
    const dir = workspace();
    const config = createNajmNextConfig({}, dir, {});
    const root = findWorkspaceRoot(dir);

    expect(config.turbopack?.root).toBe(root);
    expect(config.outputFileTracingRoot).toBe(root);
    expect(config.poweredByHeader).toBe(false);
    expect(config.distDir).toBe(DEFAULT_DIST_DIR);
    expect(config.serverExternalPackages).toEqual(['reflect-metadata']);
    expect(config.experimental?.externalDir).toBe(true);
    expect(config.allowedDevOrigins).toBeUndefined();
  });

  test('reads the dist dir and dev origins from the environment', () => {
    const dir = workspace();
    const config = createNajmNextConfig({}, dir, {
      NAJM_NEXT_DIST_DIR: '.next-e2e',
      NAJM_NEXT_DEV_ORIGINS: '192.168.1.13',
    });

    expect(config.distDir).toBe('.next-e2e');
    expect(config.allowedDevOrigins).toEqual(['192.168.1.13']);
  });

  test('omits headers when no service worker is present', () => {
    expect(createNajmNextConfig({}, workspace(), {}).headers).toBeUndefined();
  });

  test('composes app headers after the service-worker rules', async () => {
    const dir = workspace();
    write(join(dir, 'public', 'sw.js'), '');

    const config = createNajmNextConfig(
      { headers: async () => [{ source: '/x', headers: [{ key: 'x-app', value: '1' }] }] },
      dir,
      {},
    );

    const rules = await config.headers!();
    expect(rules.map((rule) => rule.source)).toEqual(['/sw.js', '/x']);
  });

  test('merges overrides without dropping preset defaults', () => {
    const dir = workspace();
    const config = createNajmNextConfig(
      {
        serverExternalPackages: ['sharp', 'reflect-metadata'],
        images: { formats: ['image/webp'] },
        turbopack: { resolveExtensions: ['.ts'] },
        experimental: { taint: true },
        basePath: '/app',
      },
      dir,
      {},
    );

    expect(config.serverExternalPackages).toEqual(['reflect-metadata', 'sharp']);
    expect(config.images?.minimumCacheTTL).toBe(2_678_400);
    expect(config.images?.formats).toEqual(['image/webp']);
    expect(config.turbopack?.root).toBe(findWorkspaceRoot(dir));
    expect(config.turbopack?.resolveExtensions).toEqual(['.ts']);
    expect(config.experimental?.externalDir).toBe(true);
    expect(config.experimental?.taint).toBe(true);
    expect(config.basePath).toBe('/app');
  });

  test('defineNajmNextConfig returns the same shape', () => {
    expect(defineNajmNextConfig().poweredByHeader).toBe(false);
  });
});
