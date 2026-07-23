import type { ReactNode } from 'react';
import { useSession } from './useSession';
import { useUser } from './useUser';
import type { AuthUser } from '../types';

interface IfAuthProps {
  /** Render when authenticated — receives user */
  authenticated: (user: AuthUser) => ReactNode;
  /** Render when not authenticated */
  unauthenticated?: () => ReactNode;
  /** Render during loading */
  loading?: () => ReactNode;
}

/**
 * Render-prop component for full auth state branching.
 *
 * @example
 * ```tsx
 * <IfAuth
 *   loading={() => <Skeleton />}
 *   authenticated={(user) => <p>Welcome, {user.name}</p>}
 *   unauthenticated={() => <Link href="/login">Sign in</Link>}
 * />
 * ```
 */
export function IfAuth({ authenticated, unauthenticated, loading }: IfAuthProps) {
  const { status } = useSession();
  const user = useUser();

  if (status === 'loading') return <>{loading?.() ?? null}</>;
  if (status === 'authenticated' && user) return <>{authenticated(user)}</>;
  return <>{unauthenticated?.() ?? null}</>;
}
