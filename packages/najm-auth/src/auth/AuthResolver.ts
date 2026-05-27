import { APP, Container, DI, Inject, LOGGER, Meta, Service } from 'najm-core';
import type { Hono } from 'hono';
import type { LoggerService } from 'najm-core';
import { USER, ROLE, PERMISSIONS } from 'najm-guard';
import { TokenService } from '../tokens/TokenService';
import { UserService } from '../users/UserService';

@Service()
@Meta({ layer: 'plugin', order: 30 })
export class AuthResolver {
  @DI() private container!: Container;
  @Inject(APP) private app!: Hono;
  @Inject(LOGGER) private log!: LoggerService;

  async resolve(token: string): Promise<{ user: any; role?: string; permissions?: string[] } | false> {
    if (!token) return false;

    try {
      const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
      const tokenService = await this.container.resolve(TokenService);
      const user = await tokenService.getUser(authHeader);
      if (!user) return false;

      return {
        user,
        role: user.role,
        permissions: user.permissions,
      };
    } catch (error) {
      this.log.warn('Token verification failed', error);
      return false;
    }
  }

  /**
   * Resolve the current user from the refresh cookie (cookie-only flow,
   * e.g. Next.js Server Components calling /auth/me with just the cookie).
   *
   * Read-only: does NOT rotate the refresh token. Rotation is reserved for
   * the /auth/refresh handler. Mutating here races with /auth/refresh when
   * requests are concurrent.
   */
  async resolveFromCookie(): Promise<{ user: any; role?: string; permissions?: string[] } | false> {
    try {
      const tokenService = await this.container.resolve(TokenService);
      const userId = await tokenService.resolveUserFromCookie();
      if (!userId) return false;

      const userService = await this.container.resolve(UserService);
      const user = await userService.getById(userId);
      if (!user) return false;

      return {
        user,
        role: (user as any).role,
        permissions: (user as any).permissions,
      };
    } catch (error) {
      this.log.warn('Cookie verification failed', error);
      return false;
    }
  }

  async activate(): Promise<void> {
    this.app.use('*', async (c: any, next: any) => {
      const raw = c.req.header('authorization') ?? '';
      const token = raw.replace(/^Bearer\s+/i, '').trim();

      // Try Bearer token first, then fall back to refresh cookie
      const result = token
        ? (await this.resolve(token)) || (await this.resolveFromCookie())
        : await this.resolveFromCookie();

      if (result) {
          if (this.container.isActive()) {
            this.container.set(USER, result.user);
            if (result.role !== undefined) this.container.set(ROLE, result.role);
            if (result.permissions !== undefined) this.container.set(PERMISSIONS, result.permissions);
          } else {
            const als = (this.container as any).store?.als;

            if (als && typeof als.getStore === 'function') {
              const previousStore = als.getStore();
              const nextStore = new Map<string, any>(previousStore);

              nextStore.set(USER.key, result.user);
              if (result.role !== undefined) nextStore.set(ROLE.key, result.role);
              if (result.permissions !== undefined) nextStore.set(PERMISSIONS.key, result.permissions);

              als.store = nextStore;

              try {
                await next();
                return;
              } finally {
                als.store = previousStore;
              }
            }
          }
        }

      await next();
    });
  }
}
