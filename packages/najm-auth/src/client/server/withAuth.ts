// ============================================================================
// withAuth — Server Component HOC for protected pages
// ============================================================================
//
// Wraps an async server component, resolves the session via getSession(),
// and either redirects (default) or renders a fallback when unauthenticated.
//
// @example
// ```tsx
// // app/account/page.tsx
// import { withAuth } from 'najm-auth/client/server';
//
// export default withAuth(async ({ session }) => {
//   return <h1>Hi {session.user.name}</h1>;
// });
// ```
// ============================================================================

import { getSession, type ServerSession, type GetSessionConfig } from './getSession';
import { matchPermission } from '../permissions';

export interface WithAuthOptions extends GetSessionConfig {
  /** Where to redirect unauthenticated requests (default: '/login') */
  redirectTo?: string;
  /** Optional role required to view the page */
  role?: string;
  /** Optional permission required to view the page */
  permission?: string;
}

export interface WithAuthProps<P> {
  session: ServerSession;
  props: P;
}

/**
 * Protect a server component. Redirects to `redirectTo` (default `/login`)
 * when the user is unauthenticated. Optional role/permission gates apply
 * before the wrapped component renders.
 */
export function withAuth<P extends Record<string, unknown> = Record<string, unknown>>(
  Page: (args: WithAuthProps<P>) => Promise<unknown> | unknown,
  options: WithAuthOptions = {},
) {
  const { redirectTo = '/login', role, permission, ...sessionConfig } = options;

  return async function ProtectedPage(props: P) {
    const session = await getSession(sessionConfig);

    if (!session) {
      const { redirect } = await import('next/navigation');
      redirect(redirectTo);
    }

    if (role) {
      const userRoles = session.roles ?? (session.user.role ? [session.user.role] : []);
      if (!userRoles.includes(role)) {
        const { redirect } = await import('next/navigation');
        redirect(redirectTo);
      }
    }

    if (permission) {
      const perms = session.permissions ?? session.user.permissions ?? [];
      if (!matchPermission(perms, permission)) {
        const { redirect } = await import('next/navigation');
        redirect(redirectTo);
      }
    }

    return Page({ session, props });
  };
}
