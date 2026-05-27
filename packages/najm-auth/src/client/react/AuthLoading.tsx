import type { ReactNode } from 'react';
import { useSession } from './useSession';

interface AuthLoadingProps {
  children: ReactNode;
}

/**
 * Renders children only during the initial session check.
 * Useful for spinners/skeletons before auth state is known.
 *
 * @example
 * ```tsx
 * <AuthLoading>
 *   <Spinner />
 * </AuthLoading>
 * <SignedIn>...</SignedIn>
 * <SignedOut>...</SignedOut>
 * ```
 */
export function AuthLoading({ children }: AuthLoadingProps) {
  const { status } = useSession();
  if (status !== 'loading') return null;
  return <>{children}</>;
}
