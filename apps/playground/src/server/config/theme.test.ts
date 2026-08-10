import 'reflect-metadata';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'bun:test';

// This suite boots the whole playground server, which the playground can only
// do from its own directory: `DATABASE_URL` defaults to `./playground.db`, so
// from the repo root every plugin opens an empty database and the first one to
// query a table fails. That is a pre-existing property of the app, not of this
// feature, so the suite states the requirement rather than working around it —
// `bun run test` and the sequential runner both use `--cwd apps/playground`.
loadPlaygroundEnv();

const RUNNABLE = existsSync(resolve(process.cwd(), process.env.DATABASE_URL ?? './playground.db'));

const loaded = RUNNABLE ? await import('../index') : null;
const { appTheme } = await import('../../../theme');
const server = loaded?.server;

function loadPlaygroundEnv(): void {
  if (process.env.JWT_ACCESS_SECRET) return;

  const envFile = resolve(import.meta.dir, '../../../.env');
  if (!existsSync(envFile)) return;

  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, '');
  }
}

// ============================================================================
// The theme plugin, against the playground's real server.
//
// `server.fetch` rather than a listening port: it exercises the same router,
// the same guards, and the same plugin wiring without binding a socket the
// sequential runner would have to keep free.
//
// The database file may or may not have the theme tables applied — the
// migration is checked in, but a developer's local `playground.db` can predate
// it. Only the public reads are asserted here, and those fall back to the
// factory values rather than touching a table, so the suite reports the plugin
// contract instead of the state of somebody's working copy.
// ============================================================================

const api = (path: string, init?: RequestInit) =>
  server!.fetch(new Request(`http://internal/api${path}`, init));

const request = (path: string, init?: RequestInit) => api(`/theme${path}`, init);

describe.skipIf(!RUNNABLE)('public reads', () => {
  test('serves the factory theme directory design at revision 1', async () => {
    const response = await request('/appearance');
    expect(response.status).toBe(200);

    const { data } = await response.json();
    expect(data.designConfig).toEqual(appTheme.appearance());
    expect(data.revision).toBe(1);
  });

  test('returns nothing but the design and the revision', async () => {
    const { data } = await (await request('/appearance')).json();
    expect(Object.keys(data).sort()).toEqual(['designConfig', 'revision']);
  });

  test('fills all four slots from the factory directory, under the /api base', async () => {
    const { data } = await (await request('/branding')).json();

    // The paths a browser will actually request: the plugin is mounted at
    // `/theme` behind the server's `/api` base, and the package builds both
    // halves. Nothing in this application names them.
    expect(data.slots).toEqual(appTheme.branding('/api/theme'));
    for (const path of Object.values(data.slots)) {
      expect(path).toStartWith('/api/theme/branding/factory/');
    }
  });

  test('serves each factory asset with its own real format', async () => {
    const { data } = await (await request('/branding')).json();

    const expected: Record<string, string> = {
      // A deliberate mix, so one run proves both formats.
      sidebarLogoExpanded: 'image/png',
      sidebarLogoCollapsed: 'image/webp',
      authLogo: 'image/webp',
      authHeroImage: 'image/png',
    };

    for (const [slot, mimeType] of Object.entries(expected)) {
      const asset = await api((data.slots[slot] as string).replace('/api', ''));
      expect(asset.status).toBe(200);
      expect(asset.headers.get('content-type')).toBe(mimeType);
      expect(asset.headers.get('cache-control')).toContain('immutable');
      expect(Number(asset.headers.get('content-length'))).toBe(appTheme.asset(slot)!.bytes);
    }
  });

  test('answers 404 for a factory name the build does not ship', async () => {
    expect((await request('/branding/factory/authLogo.0000000000000000.png')).status).toBe(404);
    expect((await request('/branding/factory/theme.json')).status).toBe(404);
  });

  test('keeps storage internals out of the public projection', async () => {
    const body = await (await request('/branding')).text();
    expect(body).not.toContain('theme-branding');
  });
});

describe.skipIf(!RUNNABLE)('authorization', () => {
  test('guards every administrative read', async () => {
    for (const path of ['/appearance/config', '/branding/config', '/presets']) {
      expect((await request(path)).status).toBe(401);
    }
  });

  test('guards every mutation', async () => {
    const cases: [string, RequestInit][] = [
      ['/appearance', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{"expectedRevision":1,"designConfig":{"theme":{}}}' }],
      ['/appearance/reset', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"expectedRevision":1}' }],
      ['/branding', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{"expectedRevision":1,"slots":{}}' }],
      ['/branding/reset', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"expectedRevision":1}' }],
      ['/branding/assets/reconcile', { method: 'POST' }],
      ['/presets', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"name":"x","designConfig":{"version":1,"theme":{}}}' }],
    ];

    for (const [path, init] of cases) {
      expect((await request(path, init)).status).toBe(401);
    }
  });

  test('does not answer 404 for a guarded route, which would leak the route table', async () => {
    // 401 says "authenticate"; 404 would say "there is nothing here", and the
    // difference is what tells an operator whether the plugin is even mounted.
    expect((await request('/appearance/config')).status).not.toBe(404);
  });
});

// ============================================================================
// Cross-package singleton identity.
//
// This is the one thing only a real application can prove. The playground maps
// `najm-storage` and `najm-mcp` through tsconfig paths to their `src`, while
// `najm-theme` ships as `dist` and resolves the same specifiers through
// `node_modules`. Two module instances, two constructors of the same name — so
// a class used as a DI token silently resolves to a *different* service than
// the one the application booted.
//
// It fails silently in both directions: theme MCP tools registered into a
// second, empty registry that nothing serves, and branding uploads wrote
// through a second storage service with none of the application's
// configuration. Every REST assertion above still passed while both were true,
// which is why these exist.
// ============================================================================

describe.skipIf(!RUNNABLE)('peer singleton identity', () => {
  test('theme MCP tools reach the registry the server actually serves', async () => {
    const response = await api('/mcp/tools');
    expect(response.status).toBe(200);

    const { tools } = (await response.json()) as { tools: { name: string }[] };
    const themeTools = tools.map((tool) => tool.name).filter((name) => name.startsWith('theme_'));

    // Registration is unconditional for the features the playground enables;
    // an empty list here means they went somewhere else.
    expect(themeTools).toContain('theme_appearance_get');
    expect(themeTools).toContain('theme_branding_get');
    expect(themeTools).toContain('theme_presets_list');
  });

  test('the theme plugin holds the application storage service, not its own', async () => {
    const { Container } = await import('najm-core');
    const { StorageService } = await import('najm-storage');

    const container = Container.getInstance();
    const applicationStorage = await container.resolve(StorageService);

    // The symbol is the contract: `storage()` aliases it to its own class, and
    // resolving it from anywhere must land on that one instance.
    const viaToken = await container.resolve(Symbol.for('najm:storage:service'));
    expect(viaToken).toBe(applicationStorage);

    // Reaching into the service's private field on purpose. The public surface
    // cannot distinguish "wrote the file" from "wrote the file somewhere the
    // application will never serve", and that distinction is the whole bug.
    const assets = (await container.resolve('BrandingAssetService')) as { storage: unknown };
    expect(assets.storage).toBe(applicationStorage);
  });

  test('the registry the theme resolves is the one holding every other plugin tool', async () => {
    const { Container } = await import('najm-core');
    const { McpRegistryService } = await import('najm-mcp');

    const container = Container.getInstance();
    const applicationRegistry = await container.resolve(McpRegistryService);
    const viaToken = await container.resolve(Symbol.for('najm:mcp:registry'));

    expect(viaToken).toBe(applicationRegistry);
    expect(applicationRegistry.tools.some((tool) => tool.name.startsWith('theme_'))).toBe(true);
  });
});
