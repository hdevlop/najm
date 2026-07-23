import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { REQUEST_ID, Scope, Server, createAlsToken } from '../dist/index.mjs';

class RequestScopedMarker {}

const USER = createAlsToken<any>('user');
const ROLE = createAlsToken<string>('role');
const PERMISSIONS = createAlsToken<string[]>('permissions');

describe('Server.runAs', () => {
  test('creates a script context with user identity and cleans request scope', async () => {
    const server = new Server({ isolated: true, silent: true });
    let initCalls = 0;

    (server as any).ensureInitialized = async () => {
      initCalls++;
      server.container.set(RequestScopedMarker, Scope.REQUEST);
    };

    let requestId: string | undefined;

    await server.runAs(
      { id: 'USR00', role: 'admin', permissions: ['seed:write'] },
      async () => {
        requestId = server.container.get(REQUEST_ID);

        expect(server.container.isActive()).toBe(true);
        expect(server.container.get(USER)).toEqual({
          id: 'USR00',
          role: 'admin',
          permissions: ['seed:write'],
        });
        expect(server.container.get(ROLE)).toBe('admin');
        expect(server.container.get(PERMISSIONS)).toEqual(['seed:write']);

        const marker = await server.container.resolve(RequestScopedMarker);
        expect(marker).toBeInstanceOf(RequestScopedMarker);
        expect(server.container.requestScoped.has(requestId!)).toBe(true);
      },
    );

    expect(initCalls).toBe(1);
    expect(server.container.isActive()).toBe(false);
    expect(requestId).toMatch(/^runAs:/);
    expect(server.container.requestScoped.has(requestId!)).toBe(false);
  });
});
