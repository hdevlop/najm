import { DI, Inject, INJECTION_TYPES, Meta, Service, type Container } from 'najm-core';
import type { Context, Next } from 'hono';
import { AUTH_CONFIG } from '../auth.tokens';
import type { AuthConfig } from '../types';
import { setRequestIdentityResolver } from '../identity/requestResolver';

/**
 * Publishes this server's identity resolver to request-local state before rate
 * limiting. Isolated Najm servers own separate service/config instances, so one
 * `auth()` call cannot replace another server's country preset.
 */
@Service()
@Meta({ layer: 'plugin', order: 14 })
export class AuthIdentityContextService {
  @DI() private container!: Container;

  constructor(@Inject(AUTH_CONFIG) private config: AuthConfig) {}

  async configure(): Promise<void> {
    this.container.setInjection({
      type: INJECTION_TYPES.MIDDLEWARE,
      scope: 'global',
      name: 'auth-identity-context',
      order: 14,
      handler: async (context: Context, next: Next) => {
        setRequestIdentityResolver(context, this.config.identity.resolve);
        return next();
      },
    });
  }
}
