import { APP, Container, DI, Inject, LOGGER, Meta, Service } from 'najm-core';
import type { Hono } from 'hono';
import type { LoggerService } from 'najm-core';
import { USER, ROLE, PERMISSIONS } from 'najm-guard';
import { TokenService } from '../tokens/TokenService';
import { CookieManager } from './CookieManager';
import { AuthService } from './AuthService';

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

  async resolveFromSessionCookie(): Promise<{ user: any; role?: string; permissions?: string[] } | false> {
    try {
      const cookieManager = await this.container.resolve(CookieManager);
      const session = cookieManager.getSessionCookie();
      if (!session) return false;

      // Mirror the DB-backed paths: USER carries role/permissions so the
      // AuthUser contract holds regardless of which path resolved.
      return {
        user: { ...session.user, permissions: session.permissions },
        role: session.user.role ?? session.roles[0],
        permissions: session.permissions,
      };
    } catch (error) {
      this.log.warn('Session cookie verification failed', error);
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
      const user = await tokenService.getUserFromCookie();
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

      // A presented Bearer token is authoritative: it goes through full
      // verification (blacklist, session version) and must not be shadowed
      // by a stale session cookie. The signed short-lived session cookie is
      // the zero-I/O hot path for cookie-only requests (e.g. SSR reads);
      // its staleness is bounded by session.maxAge.
      const result = token
        ? (await this.resolve(token)) || (await this.resolveFromCookie())
        : (await this.resolveFromSessionCookie()) || (await this.resolveFromCookie());

      if (result) {
        if (this.container.isActive()) {
          this.container.set(USER, result.user);
          if (result.role !== undefined) this.container.set(ROLE, result.role);
          if (result.permissions !== undefined) this.container.set(PERMISSIONS, result.permissions);
        } else {
          const store: Record<string, unknown> = {
            [USER.key]: result.user,
          };
          if (result.role !== undefined) store[ROLE.key] = result.role;
          if (result.permissions !== undefined) store[PERMISSIONS.key] = result.permissions;

          return await this.container.run(store, next);
        }
      }

      await next();
    });
  }

  async onReady(): Promise<void> {
    const authService = await this.container.resolve(AuthService);
    await authService.warmupPasswordHash();
  }
}
