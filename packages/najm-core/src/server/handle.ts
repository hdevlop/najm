import type { Server } from './index';

/**
 * Create a Next.js / Vercel compatible request handler.
 *
 * @example
 * // app/api/[...route]/route.ts
 * import { handle } from 'najm-core';
 * import { server } from '@/server';
 *
 * export const GET = handle(server);
 * export const POST = handle(server);
 * export const PUT = handle(server);
 * export const PATCH = handle(server);
 * export const DELETE = handle(server);
 */
export function handle(server: Server): (req: Request) => Promise<Response> {
   return server.fetch;
}
