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

export const GET = adapt;
export const POST = adapt;
export const PUT = adapt;
export const PATCH = adapt;
export const DELETE = adapt;
