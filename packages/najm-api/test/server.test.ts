import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { Server, type NajmPlugin } from 'najm-core';
import { getEffectiveGuards } from 'najm-guard';
import { AuthGuard } from 'najm-auth';
import { createNajmServer, type NajmServerOptions } from '../src/server';
import { createNajmServer as fromRoot } from '../src/index';

const jwt = { accessSecret: 'a'.repeat(40), refreshSecret: 'b'.repeat(40) };
const withAuth = { email: { provider: { provider: 'memory' } } as any, auth: { dialect: 'pg', jwt } as any };
class FakeRedis {}

/** The plugins `createNajmServer` registers, in order. */
function registered(options: NajmServerOptions): NajmPlugin[] {
  const seen: NajmPlugin[] = [];
  const use = Server.prototype.use;
  Server.prototype.use = function (plugin: NajmPlugin) { seen.push(plugin); return use.call(this, plugin); };
  try {
    createNajmServer({ server: { isolated: true, silent: true }, ...options });
  } finally {
    Server.prototype.use = use;
  }
  return seen;
}
const named = (plugins: NajmPlugin[], name: string) => plugins.find(plugin => plugin.name === name)!;

describe('createNajmServer', () => {
  test('is exported from the root entry', () => {
    expect(fromRoot).toBe(createNajmServer);
  });

  test('registers the common plugins in dependency order, then the app plugins', () => {
    const extra = { name: 'app-extra' } as NajmPlugin;
    const plugins = registered({
      cors: true, database: { default: {} as any }, cache: { Redis: FakeRedis as any }, i18n: true, validation: {},
      rateLimit: {}, email: { env: {}, defaultProvider: 'console' }, auth: { dialect: 'pg', jwt } as any,
      mcp: { name: 'app', version: '1' }, storage: { guards: [] }, plugins: [extra],
    });
    expect(plugins.map(plugin => plugin.name)).toEqual([
      'cors', 'database', 'cache', 'i18n', 'validation', 'rate-limit', 'events', 'email',
      'guards', 'auth', 'mcp', 'storage', 'app-extra',
    ]);
  });

  test('registers only what is set, plus events', () => {
    expect(registered({}).map(plugin => plugin.name)).toEqual(['events']);
    expect(registered({ events: false })).toEqual([]);
  });

  test('with auth, a route that declares no guard asks for sign-in', () => {
    const config = named(registered(withAuth), 'guards').config;
    class Unguarded { read() {} }
    expect(getEffectiveGuards(Unguarded, 'read', config).map(guard => guard.guardClass)).toContain(AuthGuard);
  });

  test('an explicit guards option replaces the sign-in default', () => {
    const config = named(registered({ ...withAuth, guards: { default: [] } }), 'guards').config;
    expect(config).toEqual({ default: [] });
    expect(registered({ ...withAuth, guards: false }).map(p => p.name)).not.toContain('guards');
  });

  test('cache: memory without a URL, Redis required in production, memory during a build', () => {
    expect(named(registered({ production: false, cache: { Redis: FakeRedis as any } }), 'cache').config.driver).toBe('memory');
    expect(() => registered({ production: true, cache: { Redis: FakeRedis as any } })).toThrow('REDIS_URL is required');
    const build = named(registered({ production: true, buildPhase: true, cache: { Redis: FakeRedis as any } }), 'cache');
    expect(build.config).toMatchObject({ driver: 'memory', required: false });
  });

  test('rate limits: one trusted proxy in production, none and skipped locally', () => {
    const production = named(registered({ production: true, rateLimit: {} }), 'rate-limit').config;
    expect(production).toMatchObject({ trustedProxyHops: 1, onUnresolvedClient: 'shared' });
    expect(production.skip).toBeUndefined();

    const local = named(registered({ production: false, rateLimit: {} }), 'rate-limit').config;
    expect(local).toMatchObject({ trustedProxyHops: 0, onUnresolvedClient: 'skip' });
    expect(local.skip({} as any)).toBe(true);

    const proxied = named(registered({ production: false, rateLimit: { trustedProxyHops: 2 } }), 'rate-limit').config;
    expect(proxied.trustedProxyHops).toBe(2);
    expect(proxied.skip).toBeUndefined();
  });

  test('email from the app\'s env reads', () => {
    const config = named(registered({
      email: { env: { EMAIL_DEFAULT_FROM: 'school@example.test' }, defaultProvider: 'console' },
    }), 'email').config;
    expect(config.defaultFrom).toBe('school@example.test');
  });

  test('a function slot builds the plugin and keeps its place', () => {
    const custom = { name: 'email' } as NajmPlugin;
    const plugins = registered({ cors: true, email: () => custom, auth: { dialect: 'pg', jwt } as any });
    expect(plugins.map(plugin => plugin.name)).toEqual(['cors', 'events', 'email', 'guards', 'auth']);
    expect(named(plugins, 'email')).toBe(custom);
  });

  test('sets the route prefix', () => {
    const server = createNajmServer({ server: { isolated: true, silent: true }, base: '/api', events: false });
    expect(server).toBeInstanceOf(Server);
  });
});

