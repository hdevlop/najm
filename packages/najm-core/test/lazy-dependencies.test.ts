import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { Server, lazyPlugin, plugin } from '../dist/index.mjs';

const CONFIG = Symbol('config');

/** Server whose logger records warnings; nothing else is logged. */
function serverWithWarnings() {
  const server = new Server({ silent: true, isolated: true });
  const warnings: string[] = [];
  (server as any).logger = {
    serverInitializing: () => {},
    serverInitialized: () => {},
    serverError: () => {},
    error: () => {},
    info: () => {},
    warn: (message: string) => warnings.push(message),
  };
  return { server, warnings };
}

const registered = (server: unknown, name: string) =>
  (server as any).registry.plugins.get(name);

describe('lazy dependencies', () => {
  test('are not created when a plugin of that name is already registered', async () => {
    let created = 0;
    const { server } = serverWithWarnings();

    server
      .use(plugin('cache').config(CONFIG, 'app').build())
      .use(plugin('auth').depends(lazyPlugin('cache', () => {
        created++;
        throw new Error('auth would reject this config');
      })).build());

    await server.init();

    expect(created).toBe(0);
    expect(registered(server, 'cache').config).toBe('app');
  });

  test('are created once and registered when the name is free', async () => {
    let created = 0;
    const cache = lazyPlugin('cache', () => {
      created++;
      return plugin('cache').config(CONFIG, 'auth').build();
    });
    const { server } = serverWithWarnings();

    server
      .use(plugin('auth').depends(cache).build())
      .use(plugin('rate').depends(cache).build());

    await server.init();

    expect(created).toBe(1);
    expect(registered(server, 'cache').config).toBe('auth');
  });

  test('plain plugin dependencies still auto-register', async () => {
    const { server } = serverWithWarnings();

    server.use(plugin('auth').depends(plugin('cookies').config(CONFIG, 'c').build()).build());
    await server.init();

    expect(registered(server, 'cookies').config).toBe('c');
  });

  test('reject a factory that builds a differently named plugin', () => {
    const { server } = serverWithWarnings();

    expect(() => server.use(
      plugin('auth').depends(lazyPlugin('cache', () => plugin('redis').build())).build(),
    )).toThrow('Lazy dependency "cache" of plugin "auth" created a plugin named "redis".');
  });

  test('warn once at startup when forwarded config is ignored', async () => {
    const { server, warnings } = serverWithWarnings();

    server
      .use(plugin('email').build())
      .use(plugin('auth').depends(
        lazyPlugin('email', () => plugin('email').build(), { forwardedConfig: 'auth({ email })' }),
      ).build());

    await server.init();
    await server.init();

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('"auth"');
    expect(warnings[0]).toContain('auth({ email })');
    expect(warnings[0]).toContain('"email" plugin is already registered');
  });

  test('do not warn when no config was forwarded, or when the lazy plugin is used', async () => {
    const { server, warnings } = serverWithWarnings();

    server
      .use(plugin('email').build())
      .use(plugin('auth').depends(
        lazyPlugin('email', () => plugin('email').build()),
        lazyPlugin('cache', () => plugin('cache').build(), { forwardedConfig: 'auth({ cache })' }),
      ).build());

    await server.init();

    expect(warnings).toEqual([]);
  });
});
