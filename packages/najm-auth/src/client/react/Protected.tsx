import type { ReactNode } from 'react';
import { useSession } from './useSession';
import { usePermissions } from './usePermissions';

interface ProtectedProps {
  children: ReactNode;
  /** URL to redirect unauthenticated users to */
  redirectTo?: string;
  /** Callback when unauthenticated (overrides redirectTo) */
  onUnauthenticated?: () => void;
  /** Require a specific role */
  role?: string;
  /** Require a specific permission */
  permission?: string;
  /** Shown while session is loading (defaults to fallback) */
  loadingFallback?: ReactNode;
  /** Shown when access is denied (defaults to loadingFallback) */
  fallback?: ReactNode;
}

/**
 * Route-level authentication and authorization gate.
 *
 * @example
 * ```tsx
 * <Protected redirectTo="/login" loadingFallback={<Spinner />}>
 *   <DashboardPage />
 * </Protected>
 *
 * <Protected role="admin" redirectTo="/unauthorized">
 *   <AdminPage />
 * </Protected>
 * ```
 */
export function Protected({
  children,
  redirectTo,
  onUnauthenticated,
  role,
  permission,
  loadingFallback,
  fallback,
}: ProtectedProps) {
  const resolvedLoading = loadingFallback ?? fallback ?? null;
  const resolvedFallback = fallback ?? loadingFallback ?? null;

  const { isLoading, isAuthenticated } = useSession({
    required: true,
    redirectTo,
    onUnauthenticated,
  });
  const { can, hasRole } = usePermissions();

  if (isLoading) return <>{resolvedLoading}</>;
  if (!isAuthenticated) return <>{resolvedFallback}</>;
  if (role && !hasRole(role)) return <>{resolvedFallback}</>;
  if (permission && !can(permission)) return <>{resolvedFallback}</>;

  return <>{children}</>;
}
