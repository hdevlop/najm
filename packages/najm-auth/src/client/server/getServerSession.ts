// ============================================================================
// getServerSession — Read session from cookies in SSR context
// ============================================================================

import type { AuthUser, ServerResponse } from '../types';

interface GetServerSessionOptions {
  /** The URL of the /auth/me endpoint */
  verifyURL: string;
  /** Cookie header string from the incoming request */
  cookie: string;
  /** Additional headers to forward (e.g., Authorization) */
  headers?: Record<string, string>;
}

interface ServerSession {
  user: AuthUser;
}

/**
 * Fetch the current user session server-side by forwarding cookies.
 * Use in Next.js Server Components, Remix loaders, etc.
 *
 * @example
 * ```ts
 * // Next.js App Router (server component)
 * import { cookies } from 'next/headers';
 * import { getServerSession } from 'najm-auth/client/server';
 *
 * export default async function DashboardPage() {
 *   const cookieStore = await cookies();
 *   const session = await getServerSession({
 *     verifyURL: 'http://localhost:3000/api/auth/me',
 *     cookie: cookieStore.toString(),
 *   });
 *   if (!session) redirect('/login');
 *   return <Dashboard user={session.user} />;
 * }
 * ```
 */
export async function getServerSession(opts: GetServerSessionOptions): Promise<ServerSession | null> {
  try {
    const res = await fetch(opts.verifyURL, {
      headers: {
        'Cookie': opts.cookie,
        'Accept': 'application/json',
        ...opts.headers,
      },
    });

    if (!res.ok) return null;

    const body = (await res.json()) as ServerResponse<AuthUser>;
    if (!body.data) return null;

    return { user: body.data };
  } catch {
    return null;
  }
}
