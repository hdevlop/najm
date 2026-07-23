import type { ReactNode } from 'react';
import { useAuth } from './useAuth';

interface AuthBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  /** Only gate while we truly have no identity; default false. */
  requireToken?: boolean;
}

export function AuthBoundary({
  children,
  fallback = null,
  requireToken = false,
}: AuthBoundaryProps) {
  const { isAuthenticated, isLoading, accessToken } = useAuth();
  if (isLoading) return <>{fallback}</>;
  if (requireToken && isAuthenticated && !accessToken) return <>{fallback}</>;
  return <>{children}</>;
}
