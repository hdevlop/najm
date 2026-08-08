import type { Context } from 'hono';
import { createIdentityResolver, type IdentityResolver } from './resolver';

const CONTEXT_RESOLVER_KEY = 'najm.auth.identityResolver';
const defaultResolver = createIdentityResolver();

export function setRequestIdentityResolver(
  context: Context,
  resolver: IdentityResolver,
): void {
  context.set(CONTEXT_RESOLVER_KEY as never, resolver as never);
}

export function getRequestIdentityResolver(context: Context): IdentityResolver {
  try {
    return (context.get(CONTEXT_RESOLVER_KEY as never) as IdentityResolver | undefined)
      ?? defaultResolver;
  } catch {
    return defaultResolver;
  }
}
