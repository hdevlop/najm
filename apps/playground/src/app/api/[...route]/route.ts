import { withAuthCookiePersistence } from 'najm-auth/client/server';

// The Najm server owns database, cache, and external-integration setup. It is
// a request-time API surface, not a statically generated Next.js route.
export const dynamic = 'force-dynamic';

const adapt = async (request: Request): Promise<Response> => {
  const [{ handle }, { server }] = await Promise.all([
    import('najm-api'),
    import('@/server'),
  ]);
  return handle(server)(request);
};

// Only POST carries login, logout, refresh, and setup completion, so only POST
// needs the "remember me" rewrite. The wrapper also recognizes Najm's own
// credential-setup response and strips the session cookies from it.
export const POST = withAuthCookiePersistence(adapt);

export const GET = adapt;
export const PUT = adapt;
export const PATCH = adapt;
export const DELETE = adapt;
