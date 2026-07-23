import { describe, expect, test } from 'bun:test';
import { withAuthMiddleware as edgeMiddleware } from '../src/client/edge';
import { withAuthMiddleware as serverMiddleware } from '../src/client/server';
import type { SessionRecoveryFailure } from '../src/client/sessionRecovery';

describe('server and edge entrypoint security parity', () => {
  test('both entrypoints reject a non-loopback internal recovery URL identically', async () => {
    expect(edgeMiddleware).toBe(serverMiddleware);

    for (const createMiddleware of [edgeMiddleware, serverMiddleware]) {
      const failures: SessionRecoveryFailure[] = [];
      const middleware = createMiddleware({
        protectedRoutes: ['/protected'],
        sessionSecret: 'entrypoint-parity-secret-entrypoint-parity-secret',
        internalRecoveryURL: 'https://attacker.example/session/recover',
        onRecoveryFailure: (failure) => failures.push(failure),
      });
      const response = await middleware(new Request(
        'https://public.example.test/protected',
        { headers: { Cookie: 'refreshToken=opaque-refresh-value' } },
      ));

      expect(response.status).toBe(307);
      expect(failures).toEqual([{ reason: 'invalid-endpoint' }]);
      const setCookie = response.headers.get('set-cookie') ?? '';
      expect(setCookie).toContain('najm.session=');
      expect(setCookie).not.toContain('refreshToken=');
      expect(JSON.stringify(failures)).not.toContain('opaque-refresh-value');
    }
  });
});
